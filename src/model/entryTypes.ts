/* Shapes of logbook entries and positions; see types.ts. */

/** A geographic position as stored in entries (`text` = position typed by hand). */
export interface Position {
  lat: number;
  lon: number;
  /**
   * Free-text position (replaces the coordinates in displays).
   * @default undefined
   */
  text?: string;
  /**
   * GPS accuracy in metres.
   * @default undefined
   */
  acc?: number;
  [key: string]: unknown;
}

/** A timestamped position (`at` = ISO time of the fix). */
export interface Fix {
  lat: number;
  lon: number;
  /**
   * ISO time of the fix.
   * @default undefined
   */
  at?: string;
  [key: string]: unknown;
}

/** Values of one logbook entry, keyed by `FIELDS` keys (`v` of an entry). */
export interface EntryValues {
  /** @default undefined */
  quart?: string;
  /** @default undefined */
  loch?: number | string;
  /** @default undefined */
  pos?: Position;
  /** @default undefined */
  sog?: number | string;
  /** @default undefined */
  hdg?: number | string;
  /** @default undefined */
  cog?: number | string;
  /** @default undefined */
  allure?: string;
  /** @default undefined */
  awa?: number | string;
  /** @default undefined */
  rpm?: number | string;
  /** @default undefined */
  visi?: string;
  /** @default undefined */
  twd?: number | string;
  /** @default undefined */
  tws?: number | string;
  /** @default undefined */
  mer?: string;
  /** @default undefined */
  vagues?: number | string;
  /** @default undefined */
  feux?: string;
  /** @default undefined */
  baro?: number | string;
  /** @default undefined */
  gv?: string;
  /** @default undefined */
  avant?: string;
  /** @default undefined */
  evt?: string[];
  /** @default undefined */
  note?: string;
  /**
   * Weather source label set by the weather fill.
   * @default undefined
   */
  wxSrc?: string;
  /**
   * Photo ids attached to the entry.
   * @default undefined
   */
  photos?: string[];
  [key: string]: unknown;
}

/** One logbook entry (`cruise.entries[]`). */
export interface Entry {
  id: string;
  /** ISO time. */
  t: string;
  v: EntryValues;
  /**
   * Created by the GPS tracker.
   * @default undefined
   */
  auto?: boolean;
  /**
   * Weather still to fetch.
   * @default undefined
   */
  needWx?: boolean;
  /**
   * Weather filled from the network.
   * @default undefined
   */
  wx?: boolean;
  /**
   * Origin of the wind values (`'trace'` = instruments during the track).
   * @default undefined
   */
  windSrc?: string;
  [key: string]: unknown;
}

/** The unsaved logbook form (`ldb.draft.<cruiseId>`). */
export interface Draft {
  /** ISO time of the entry being written. */
  t: string;
  v: EntryValues;
  /**
   * Values carried over from the previous entry.
   * @default false
   */
  prefilled?: boolean;
  /**
   * Id of the entry being edited (absent for a new entry).
   * @default undefined
   */
  id?: string;
  /**
   * Time set by hand (stops following the clock).
   * @default undefined
   */
  tManual?: boolean;
  [key: string]: unknown;
}
