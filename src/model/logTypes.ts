/* Shapes of the persisted logs, checklist bases and templates; see types.ts. */

import type { Fix } from './entryTypes.ts';
import type { ChecklistDefinition, ChecklistItem } from './recordTypes.ts';

/** One event of an SOS or man-overboard log. */
export interface LogEvent {
  t: string;
  what: string;
  /** @default undefined */
  type?: string;
  /** @default undefined */
  pos?: { lat: number; lon: number };
  [key: string]: unknown;
}

/** An automatic SOS log (`ldb.sosLogs[]`). */
export interface SosLog {
  id: string;
  start: string;
  zone: string;
  nav: string;
  boat: string;
  events: LogEvent[];
  /** @default undefined */
  last?: string;
  /** @default undefined */
  end?: string;
  /**
   * Exercise (nothing real is sent).
   * @default undefined
   */
  ex?: boolean;
  /** @default undefined */
  pos0?: Fix;
  [key: string]: unknown;
}

/** A man-overboard log (`ldb.mobLogs[]`). */
export interface MobLog {
  id: string;
  start: string;
  events: LogEvent[];
  /** @default undefined */
  end?: string;
  [key: string]: unknown;
}

/** A checklist base kept in the phone (`ldb.ckLib[]`). */
export interface ChecklistBase {
  id: string;
  name: string;
  /** @default undefined */
  cats?: string[];
  items: Array<Omit<ChecklistItem, 'id'>> | ChecklistItem[];
  /** @default undefined */
  at?: string;
  /**
   * Built-in base marker (`'brief'`, `'prise'`).
   * @default undefined
   */
  seed?: string;
  [key: string]: unknown;
}

/** The sea checklist template (`ldb.tpl.mer`). */
export interface SeaTemplate {
  /** @default undefined */
  checklistDep?: ChecklistItem[];
  /** @default undefined */
  checklist?: ChecklistItem[];
  /** @default undefined */
  ckLists?: ChecklistDefinition[];
  /** @default undefined */
  ckMeta?: Record<string, unknown>;
  /** @default undefined */
  prise2025?: boolean;
  /** @default undefined */
  briefSeeded?: boolean;
  [key: string]: unknown;
}

/** One task of the aboard rotation template. */
export interface Task {
  id: string;
  name: string;
  n: number;
  /** @default undefined */
  desc?: string;
  [key: string]: unknown;
}

/** The aboard task rotation template (`ldb.taskTpl`). */
export interface TaskTemplate {
  tasks: Task[];
  first: string;
  last: string;
  end: string;
  note: string;
  /** @default undefined */
  at?: string;
  [key: string]: unknown;
}

/** One button customization of the ✎ edit mode (`ldb.uiEdits[key]`). */
export interface UiEdit {
  /** @default undefined */
  label?: string;
  /** @default undefined */
  sub?: string;
  /** @default undefined */
  size?: string;
  /** @default undefined */
  wrap?: string;
  /** @default undefined */
  view?: string;
  /** @default undefined */
  orig?: string;
  /** @default undefined */
  origSub?: string;
  /** @default undefined */
  at?: string;
  [key: string]: unknown;
}

/** One error recorded in `ldb.errLog`. */
export interface ErrorRecord {
  t: string;
  v: string;
  view: string;
  msg: string;
  src: string;
}
