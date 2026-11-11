/** A `.asc` file inside a zip: read as a stream. */
interface ZipAscEntry {
  name: string;
  size: number;
  stream: () => ReadableStream<Uint8Array>;
}

interface RawEntry {
  name: string;
  method: number;
  compressed: number;
  size: number;
  offset: number;
}

const END_RECORD = 0x06_05_4b_50;
const ZIP64_LOCATOR = 0x07_06_4b_50;
const CENTRAL_RECORD = 0x02_01_4b_50;
const UNSET32 = 0xff_ff_ff_ff;

/**
 * List the `.asc` files of a zip through its central directory, zip64 included,
 * without reading the whole file (legacy `zipAscEntries`).
 * @param file - The zip.
 * @returns Its `.asc` and `.txt` entries.
 */
export async function zipAscEntries(file: File): Promise<ZipAscEntry[]> {
  const read = async (from: number, to: number) =>
    new Uint8Array(await file.slice(from, to).arrayBuffer());
  const tailLength = Math.min(file.size, 70_000);
  const tail = await read(file.size - tailLength, file.size);
  const view = new DataView(tail.buffer);
  let end = -1;
  for (let index = tail.length - 22; index >= 0; index--) {
    if (view.getUint32(index, true) === END_RECORD) {
      end = index;
      break;
    }
  }
  if (end < 0) throw new Error('Zip illisible');
  let count = view.getUint16(end + 10, true);
  let directorySize = view.getUint32(end + 12, true);
  let directoryOffset = view.getUint32(end + 16, true);
  if (directoryOffset === UNSET32 || count === 0xff_ff) {
    const locator = end - 20;
    if (locator >= 0 && view.getUint32(locator, true) === ZIP64_LOCATOR) {
      const record = Number(view.getBigUint64(locator + 8, true));
      const zip64 = await read(record, record + 56);
      const zipView = new DataView(zip64.buffer);
      count = Number(zipView.getBigUint64(32, true));
      directorySize = Number(zipView.getBigUint64(40, true));
      directoryOffset = Number(zipView.getBigUint64(48, true));
    }
  }
  const directory = await read(
    directoryOffset,
    directoryOffset + directorySize,
  );
  const raw = readDirectory(directory, count);
  const entries: ZipAscEntry[] = [];
  for (const entry of raw) {
    // eslint-disable-next-line no-await-in-loop -- each local header is a small read of the same file
    const header = await read(entry.offset, entry.offset + 30);
    const headerView = new DataView(header.buffer);
    const start =
      entry.offset +
      30 +
      headerView.getUint16(26, true) +
      headerView.getUint16(28, true);
    entries.push({
      name: entry.name,
      size: entry.size || entry.compressed * 5,
      stream: () => entryStream(file, entry, start),
    });
  }
  return entries;
}

function readDirectory(directory: Uint8Array, count: number): RawEntry[] {
  const view = new DataView(directory.buffer);
  const entries: RawEntry[] = [];
  let position = 0;
  for (
    let index = 0;
    index < count && position + 46 <= directory.length;
    index++
  ) {
    if (view.getUint32(position, true) !== CENTRAL_RECORD) break;
    const nameLength = view.getUint16(position + 28, true);
    const extraLength = view.getUint16(position + 30, true);
    const commentLength = view.getUint16(position + 32, true);
    const nameStart = position + 46;
    const name = new TextDecoder().decode(
      directory.subarray(nameStart, nameStart + nameLength),
    );
    const sizes = readSizes(
      view,
      position,
      nameStart + nameLength,
      extraLength,
    );
    position = nameStart + nameLength + extraLength + commentLength;
    if (!/\.(?:asc|txt)$/i.test(name) || /(?:^|\/)\._/.test(name)) continue;
    entries.push({
      name: name.split('/').pop() ?? name,
      method: sizes.method,
      compressed: sizes.compressed,
      size: sizes.size,
      offset: sizes.offset,
    });
  }
  return entries;
}

function readSizes(
  view: DataView,
  record: number,
  extraStart: number,
  extraLength: number,
) {
  let compressed = view.getUint32(record + 20, true);
  let size = view.getUint32(record + 24, true);
  let offset = view.getUint32(record + 42, true);
  const extraEnd = extraStart + extraLength;
  for (let field = extraStart; field < extraEnd;) {
    const id = view.getUint16(field, true);
    const fieldSize = view.getUint16(field + 2, true);
    if (id === 1) {
      let value = field + 4;
      if (size === UNSET32) {
        size = Number(view.getBigUint64(value, true));
        value += 8;
      }
      if (compressed === UNSET32) {
        compressed = Number(view.getBigUint64(value, true));
        value += 8;
      }
      if (offset === UNSET32) offset = Number(view.getBigUint64(value, true));
    }
    field += 4 + fieldSize;
  }
  return {
    method: view.getUint16(record + 10, true),
    compressed,
    size,
    offset,
  };
}

function entryStream(
  file: File,
  entry: RawEntry,
  start: number,
): ReadableStream<Uint8Array> {
  const raw = file.slice(start, start + entry.compressed).stream();
  if (entry.method === 0) return raw;
  if (entry.method !== 8 || typeof DecompressionStream === 'undefined') {
    throw new Error(
      'Décompression impossible sur cet appareil : décompressez le zip dans Fichiers',
    );
  }
  return raw.pipeThrough(new DecompressionStream('deflate-raw'));
}
