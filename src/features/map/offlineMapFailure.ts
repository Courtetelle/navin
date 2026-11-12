/** Why a map file could not be kept on this device. */
type FailureKind =
  /** Not a PMTiles archive at all. */
  | 'not-pmtiles'
  /** A PMTiles archive of pictures (raster), not of vector tiles. */
  | 'raster'
  /** Vector tiles of a kind NavIn does not draw (MLT). */
  | 'format'
  /** The file could not be read to its end: not downloaded, or gone. */
  | 'unreadable'
  /** The device has no room left for it. */
  | 'no-room'
  /** The device refused to write it, for another reason. */
  | 'storage';

const BYTES_PER_MB = 1_000_000;

/** A map import that failed, and why. */
export class OfflineMapFailure extends Error {
  readonly kind: FailureKind;
  /** Size of the map, in bytes. */
  readonly need: number;
  /** Room left on the device, in bytes, when the browser tells it. */
  readonly free: number | null;

  constructor(
    kind: FailureKind,
    need: number,
    free: number | null = null,
    cause?: unknown,
  ) {
    super(kind, { cause });
    this.name = 'OfflineMapFailure';
    this.kind = kind;
    this.need = need;
    this.free = free;
  }
}

/** Names browsers give to a file they cannot read (not there, not allowed). */
const READ_ERRORS = new Set([
  'NotReadableError',
  'NotFoundError',
  'NotAllowedError',
  'SecurityError',
  'AbortError',
]);

/**
 * Whether an error comes from reading the chosen file, not from its content.
 * @param error - The error.
 * @returns It is a read error.
 */
export function isReadError(error: unknown): boolean {
  return error instanceof Error && READ_ERRORS.has(error.name);
}

/**
 * Whether an error of the device's storage means it is full.
 * @param error - The error.
 * @returns It says the room is used up.
 */
export function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'QuotaExceededError' ||
    /quota|space|disk/iu.test(error.message)
  );
}

const mb = (bytes: number): number =>
  Math.max(1, Math.round(bytes / BYTES_PER_MB));

/** What to tell the sailor, for each reason but the lack of room. */
const TEXTS: Record<Exclude<FailureKind, 'no-room'>, string> = {
  'not-pmtiles': 'Ce fichier n’est pas une carte .pmtiles',
  raster:
    'Cette carte est faite d’images (raster) : NavIn ne lit que les cartes .pmtiles vectorielles',
  format:
    'Cette carte vectorielle est au format MLT : NavIn ne lit que le format MVT',
  unreadable:
    'Fichier illisible ou incomplet : dans kDrive, enregistrez-le d’abord « Sur mon iPhone », puis importez-le de là',
  storage:
    'L’appareil a refusé d’enregistrer la carte : fermez NavIn, rouvrez-la depuis son icône et réessayez',
};

/**
 * What to tell the sailor when an import fails.
 * @param error - The error of the import.
 * @returns The sentence shown.
 */
export function failureText(error: unknown): string {
  if (!(error instanceof OfflineMapFailure)) {
    const name = error instanceof Error ? error.name : 'erreur';
    return `Import impossible (${name}) : réessayez, ou envoyez-moi ce message`;
  }
  if (error.kind === 'no-room') {
    return error.free === null
      ? `Pas assez de place sur cet appareil pour cette carte de ${mb(error.need)} Mo`
      : `Pas assez de place : la carte fait ${mb(error.need)} Mo, il reste ${Math.floor(Math.max(0, error.free) / BYTES_PER_MB)} Mo pour NavIn`;
  }
  return TEXTS[error.kind];
}
