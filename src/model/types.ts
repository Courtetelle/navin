/*
 * Shapes of the persisted data (localStorage `ldb.*`). They mirror the legacy
 * JSON exactly; every record also accepts unknown extra keys, because legacy
 * data carries fields added over many versions.
 */

import type { Entry } from './entryTypes.ts';

/** One day sheet (`cruise.days[YYYY-MM-DD]`), keyed by `DAY_SECTIONS` keys. */
export interface Day {
  /**
   * Checklist ids done that day (lake day outings).
   * @default undefined
   */
  checkDone?: string[];
  /**
   * Checklist ids opened (orange) that day.
   * @default undefined
   */
  ckOpen?: string[];
  /**
   * Checklist values by item id.
   * @default undefined
   */
  ckVals?: Record<string, string>;
  /**
   * Keys whose value was filled automatically.
   * @default undefined
   */
  _auto?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Cruise or boat sheet values (`cruise.info`, `boat.info`), keyed by `INFO_SECTIONS` keys. */
export interface CruiseInfo {
  /** @default undefined */
  name?: string;
  /** @default undefined */
  ports?: string;
  /** @default undefined */
  du?: string;
  /** @default undefined */
  au?: string;
  /** @default undefined */
  boat?: string;
  /** @default undefined */
  model?: string;
  /** @default undefined */
  year?: string;
  /** @default undefined */
  waters?: string;
  /** @default undefined */
  contacts?: string;
  /** @default undefined */
  conso?: number | string;
  /** @default undefined */
  vMoteur?: number | string;
  /** @default undefined */
  moteurInit?: number | string;
  [key: string]: unknown;
}

/** One crew line of a cruise (`cruise.crew[]`), keyed by `CREW_FIELDS` keys. */
export interface CrewMember {
  /** @default undefined */
  nom?: string;
  /** @default undefined */
  fonction?: string;
  /** @default undefined */
  sexe?: string;
  /**
   * Id of the member card this line comes from.
   * @default undefined
   */
  memberId?: string;
  [key: string]: unknown;
}

/** A photo reference kept in a cruise (`cruise.photos[]`); the blob lives in IndexedDB. */
export interface PhotoReference {
  id: string;
  [key: string]: unknown;
}

/** Cruise type: `'lac'` for lake outings, `'mer'` (or absent) for sea cruises. */
export type CruiseType = 'lac' | 'mer';

/** A cruise / outing (`ldb.cruise.<id>`). */
export interface Cruise {
  id: string;
  /** ISO creation time. */
  created: string;
  /**
   * ISO time of the last save.
   * @default undefined
   */
  updated?: string;
  info: CruiseInfo;
  crew: CrewMember[];
  entries: Entry[];
  days: Record<string, Day>;
  /**
   * Lake outing or sea cruise.
   * @default 'mer'
   */
  type?: CruiseType;
  /**
   * Lake outing length: `'jour'` or `'croisiere'`.
   * @default undefined
   */
  duree?: string;
  /**
   * Boat of a lake outing.
   * @default undefined
   */
  boatId?: string;
  /**
   * Purpose of a lake outing (Entraînement, Location, Invitation).
   * @default undefined
   */
  purpose?: string;
  /**
   * Photo references.
   * @default undefined
   */
  photos?: PhotoReference[];
  /**
   * Checklist ids done (sea cruise and lake cruise).
   * @default undefined
   */
  checkDone?: string[];
  [key: string]: unknown;
}

/** Index line of a cruise (`ldb.index[]`). */
export interface CruiseMeta {
  id: string;
  name: string;
  created: string;
  type: CruiseType | string;
  /** @default undefined */
  duree?: string;
  [key: string]: unknown;
}

export type * from './entryTypes.ts';
export type * from './logTypes.ts';
export type * from './recordTypes.ts';
