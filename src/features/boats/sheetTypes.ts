import type { CruisePhoto } from '../onwater/index.ts';

/** One line of a sheet table: label and value. */
export type SheetRow = readonly [label: string, value: string];

/** A titled table of a sheet. */
export interface SheetSection {
  title: string;
  rows: readonly SheetRow[];
}

/** A checklist of a sheet. */
export interface SheetChecklist {
  name: string;
  items: ReadonlyArray<{ label: string; ok: boolean }>;
}

/** A line of the journal part. */
export interface SheetLogRow {
  /** Local time. */
  time: string;
  /** Events. */
  what: string;
  /** Details, on a second line. */
  more?: string;
}

/** What `sheetData` gathers about one day (legacy `sheetData`). */
export interface SheetContent {
  title: string;
  sections: readonly SheetSection[];
  /** Observations, one paragraph. */
  obs: string;
  checks: readonly SheetChecklist[];
  /** Data URL of the signature. */
  sig: string | null | undefined;
  /** Name of the signatory. */
  sigName: string;
  /** The sheet still needs the engine hours, diesel level or signature. */
  missing: boolean;
}

/** The sheet once reduced to the parts chosen by the user (legacy `pickSheet`). */
export interface PickedSheet extends SheetContent {
  showObs: boolean;
  extract: readonly SheetLogRow[];
  extractTitle: string;
  photos: readonly CruisePhoto[];
  /** Day whose track is drawn, null without a map. */
  traceK: string | null;
}

/** What `sheetPng` draws: a day sheet, or any titled tables (crew list). */
export interface SheetImageContent {
  title: string;
  sections: readonly SheetSection[];
  checks: readonly SheetChecklist[];
  /**
   * Observations.
   * @default ''
   */
  obs?: string;
  /**
   * Draw the observations.
   * @default true
   */
  showObs?: boolean;
  /**
   * Data URL of the signature.
   * @default undefined
   */
  sig?: string | null;
  /**
   * Name of the signatory.
   * @default ''
   */
  sigName?: string;
  /**
   * Day whose track is drawn.
   * @default null
   */
  traceK?: string | null;
  /**
   * Journal lines.
   * @default []
   */
  extract?: readonly SheetLogRow[];
  /**
   * Title of the journal lines.
   * @default 'Extrait du journal'
   */
  extractTitle?: string;
  /**
   * Photos.
   * @default []
   */
  photos?: readonly CruisePhoto[];
  /**
   * Title of the photos.
   * @default 'Photos'
   */
  photosTitle?: string;
  /**
   * No « 3 · » before the first checklist.
   * @default false
   */
  noNum?: boolean;
}
