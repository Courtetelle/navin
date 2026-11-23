import { Compression, TileType, zxyToTileId } from 'pmtiles';

/** A tile to write: its place and its content (a vector tile, unpacked). */
export interface TileToWrite {
  z: number;
  x: number;
  y: number;
  data: Uint8Array<ArrayBuffer>;
}

/** What the file says of itself. */
export interface ArchiveInfo {
  south: number;
  west: number;
  north: number;
  east: number;
  minZoom: number;
  maxZoom: number;
  /** Written in the metadata. */
  name: string;
  attribution: string;
}

interface Entry {
  tileId: number;
  offset: number;
  length: number;
  runLength: number;
}

const HEADER_BYTES = 127;
/** A reader takes the header and the root directory in the first 16 KiB. */
const ROOT_MAX = 16_384 - HEADER_BYTES;
const LEAF_ENTRIES = 4096;

function e7(value: number): number {
  return Math.round(value * 1e7);
}

function varint(out: number[], value: number): void {
  let rest = value;
  while (rest >= 0x80) {
    out.push((rest % 0x80) | 0x80);
    rest = Math.floor(rest / 0x80);
  }
  out.push(rest);
}

/**
 * A directory of the PMTiles format (version 3), not compressed.
 * @param entries - Its entries, by tile id.
 * @returns Its bytes.
 */
export function serializeDirectory(
  entries: readonly Entry[],
): Uint8Array<ArrayBuffer> {
  const out: number[] = [];
  varint(out, entries.length);
  let last = 0;
  for (const entry of entries) {
    varint(out, entry.tileId - last);
    last = entry.tileId;
  }
  for (const entry of entries) varint(out, entry.runLength);
  for (const entry of entries) varint(out, entry.length);
  let previous: Entry | null = null;
  for (const entry of entries) {
    // 0: right after the previous one, as the format writes it.
    if (previous && entry.offset === previous.offset + previous.length) {
      varint(out, 0);
    } else {
      varint(out, entry.offset + 1);
    }
    previous = entry;
  }
  return Uint8Array.from(out);
}

/** The root directory, and the leaves it points to when it is too big. */
function directories(entries: readonly Entry[]): {
  root: Uint8Array<ArrayBuffer>;
  leaves: Uint8Array<ArrayBuffer>;
} {
  const whole = serializeDirectory(entries);
  if (whole.length <= ROOT_MAX) {
    return { root: whole, leaves: new Uint8Array() };
  }
  const parts: Array<Uint8Array<ArrayBuffer>> = [];
  const rootEntries: Entry[] = [];
  let offset = 0;
  for (let start = 0; start < entries.length; start += LEAF_ENTRIES) {
    const chunk = entries.slice(start, start + LEAF_ENTRIES);
    const leaf = serializeDirectory(chunk);
    rootEntries.push({
      tileId: (chunk[0] as Entry).tileId,
      offset,
      length: leaf.length,
      runLength: 0,
    });
    parts.push(leaf);
    offset += leaf.length;
  }
  const leaves = new Uint8Array(offset);
  let at = 0;
  for (const part of parts) {
    leaves.set(part, at);
    at += part.length;
  }
  return { root: serializeDirectory(rootEntries), leaves };
}

function header(
  info: ArchiveInfo,
  sizes: {
    root: number;
    metadata: number;
    leaves: number;
    data: number;
    tiles: number;
  },
): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(HEADER_BYTES);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('PMTiles'), 0);
  view.setUint8(7, 3);
  const u64 = (at: number, value: number) => {
    view.setUint32(at, value % 2 ** 32, true);
    view.setUint32(at + 4, Math.floor(value / 2 ** 32), true);
  };
  const rootAt = HEADER_BYTES;
  const metadataAt = rootAt + sizes.root;
  const leavesAt = metadataAt + sizes.metadata;
  const dataAt = leavesAt + sizes.leaves;
  u64(8, rootAt);
  u64(16, sizes.root);
  u64(24, metadataAt);
  u64(32, sizes.metadata);
  u64(40, leavesAt);
  u64(48, sizes.leaves);
  u64(56, dataAt);
  u64(64, sizes.data);
  u64(72, sizes.tiles);
  u64(80, sizes.tiles);
  u64(88, sizes.tiles);
  view.setUint8(96, 1);
  view.setUint8(97, Compression.None);
  view.setUint8(98, Compression.None);
  view.setUint8(99, TileType.Mvt);
  view.setUint8(100, info.minZoom);
  view.setUint8(101, info.maxZoom);
  view.setInt32(102, e7(info.west), true);
  view.setInt32(106, e7(info.south), true);
  view.setInt32(110, e7(info.east), true);
  view.setInt32(114, e7(info.north), true);
  view.setUint8(118, info.maxZoom);
  view.setInt32(119, e7((info.west + info.east) / 2), true);
  view.setInt32(123, e7((info.south + info.north) / 2), true);
  return bytes;
}

/**
 * Put vector tiles into one PMTiles file (version 3, nothing compressed),
 * the format of the map files NavIn imports.
 * @param tiles - The tiles; empty ones are left out.
 * @param info - Limits, zooms and names of the map.
 * @returns The file.
 */
export function writePmtiles(
  tiles: readonly TileToWrite[],
  info: ArchiveInfo,
): Blob {
  const sorted = tiles
    .filter((tile) => tile.data.length > 0)
    .map((tile) => ({ tile, id: zxyToTileId(tile.z, tile.x, tile.y) }))
    .toSorted((first, second) => first.id - second.id);
  const entries: Entry[] = [];
  let offset = 0;
  for (const { tile, id } of sorted) {
    const previous = entries.at(-1);
    if (previous?.tileId === id) continue;
    entries.push({
      tileId: id,
      offset,
      length: tile.data.length,
      runLength: 1,
    });
    offset += tile.data.length;
  }
  const kept = new Set(entries.map((entry) => entry.tileId));
  const { root, leaves } = directories(entries);
  const metadata = new TextEncoder().encode(
    JSON.stringify({
      name: info.name,
      attribution: info.attribution,
      generator: 'NavIn',
    }),
  );
  const parts: BlobPart[] = [
    header(info, {
      root: root.length,
      metadata: metadata.length,
      leaves: leaves.length,
      data: offset,
      tiles: entries.length,
    }),
    root,
    metadata,
    leaves,
  ];
  for (const { tile, id } of sorted) {
    if (!kept.delete(id)) continue;
    parts.push(tile.data);
  }
  return new Blob(parts, { type: 'application/octet-stream' });
}
