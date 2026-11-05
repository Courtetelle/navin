/* Shapes of the other persisted records (boats, people, logs, templates); see types.ts. */

import type { CruiseInfo } from './types.ts';

/** One checklist item. */
export interface ChecklistItem {
  id: string;
  label: string;
  /**
   * Special action (`'sheet'`, `'releves'`).
   * @default undefined
   */
  action?: string;
  /**
   * Value unit (`''`, `'%'`, `'L'`, `'kWh'`, `'V'`, `'h'`, `'bar'`, `'°C'`, `'nb'`).
   * @default undefined
   */
  unit?: string;
  /**
   * Day-sheet key where the value is written.
   * @default undefined
   */
  key?: string;
  /**
   * Explanation shown under the item.
   * @default undefined
   */
  note?: string;
  [key: string]: unknown;
}

/** A named extra checklist of a boat or cruise (`owner.ckLists[]`, items in `owner['ckx_' + id]`). */
export interface ChecklistDefinition {
  id: string;
  name: string;
  /** @default undefined */
  cats?: string[];
  [key: string]: unknown;
}

/** A saved previous version of a boat sheet (`boat.hist[]`). */
export interface BoatVersion {
  at: string;
  from: string;
  info: CruiseInfo;
}

/** A boat (`ldb.boats[]`). */
export interface Boat {
  id: string;
  info: CruiseInfo;
  /** @default undefined */
  checklist?: ChecklistItem[];
  /** @default undefined */
  checklistDep?: ChecklistItem[];
  /** @default undefined */
  checklistX?: ChecklistItem[];
  /** @default undefined */
  checklistDepX?: ChecklistItem[];
  /** @default undefined */
  ckLists?: ChecklistDefinition[];
  /** @default undefined */
  hist?: BoatVersion[];
  /**
   * Custom fields `{ id, label, after }`, values in `info['x_' + id]`.
   * @default undefined
   */
  custom?: Array<{ id: string; label: string; after?: string }>;
  /**
   * Renamed field labels: key → label.
   * @default undefined
   */
  alias?: Record<string, string>;
  [key: string]: unknown;
}

/** A crew member card (`ldb.members[]`), keyed by `MEMBER_FIELDS` keys. */
export interface Member {
  id: string;
  /** @default undefined */
  prenom?: string;
  /** @default undefined */
  nom?: string;
  /** @default undefined */
  sexe?: string;
  [key: string]: unknown;
}

/** One line of a saved crew composition. */
export interface CrewSetLine {
  memberId: string;
  /** @default undefined */
  fonction?: string;
  [key: string]: unknown;
}

/** A saved crew composition (`ldb.crewSets[]`). */
export interface CrewSet {
  id: string;
  /**
   * Unique identifier `EQ001`…
   * @default undefined
   */
  ident?: string;
  /** @default undefined */
  name?: string;
  crew: CrewSetLine[];
  /**
   * ISO creation time.
   * @default undefined
   */
  at?: string;
  /**
   * ISO time of the last change.
   * @default undefined
   */
  mod?: string;
  /**
   * Signature of name + crew at the last save (detects changes).
   * @default undefined
   */
  _sig?: string;
  [key: string]: unknown;
}

/** A map mark (`ldb.marks[]`). */
export interface Mark {
  id: string;
  /** Sequence number (name = `M` + 3 digits). */
  n: number;
  name: string;
  at: string;
  lat: number;
  lon: number;
  depth: string;
  note: string;
  [key: string]: unknown;
}
