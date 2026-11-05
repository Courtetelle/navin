import { signal } from '@preact/signals-react';

import type {
  Boat,
  ChecklistBase,
  CrewSet,
  Cruise,
  CruiseMeta,
  Draft,
  Mark,
  Member,
  MobLog,
  SeaTemplate,
  SosLog,
  TaskTemplate,
  UiEdit,
} from '../model/types.ts';

/** State of the PréP flow (legacy `prep`, not persisted). */
export interface PrepState {
  step: number;
  /** @default undefined */
  type?: string | null;
  /** @default undefined */
  duree?: string | null;
  /** @default undefined */
  boatId?: string | null;
  /** @default undefined */
  boatName?: string;
  /** @default undefined */
  cruiseId?: string;
  /** @default undefined */
  sub?: string | null;
  /** @default undefined */
  fresh?: boolean;
  /** @default undefined */
  fill?: boolean;
  /** @default undefined */
  reach?: unknown;
  [key: string]: unknown;
}

/** One use of a boat or crew in the PréP flow (`ldb.prepUse`). */
export interface PrepUse {
  id: string;
  /** Purpose or type the item was used for. */
  p: string;
  at: string;
}

/** Usage history of boats and crews (`ldb.prepUse`). */
export interface PrepUseLog {
  boat: PrepUse[];
  crew: PrepUse[];
  [key: string]: PrepUse[];
}

/**
 * Domain records. Each signal mirrors one legacy global; it is loaded by
 * `initState()` and written back through the entity actions (same `ldb.*`
 * keys, same JSON shapes, same moments as legacy).
 */
export const data = {
  /** Cruise index (`ldb.index`). */
  index: signal<CruiseMeta[]>([]),
  /** Open cruise (`ldb.cruise.<id>`, its id in `ldb.current`). */
  cruise: signal<Cruise | null>(null),
  /** Unsaved logbook form of the open cruise (`ldb.draft.<id>`). */
  draft: signal<Draft | null>(null),
  /** Boats (`ldb.boats`). */
  boats: signal<Boat[]>([]),
  /** Crew member cards (`ldb.members`). */
  members: signal<Member[]>([]),
  /** Saved crew compositions (`ldb.crewSets`). */
  crewSets: signal<CrewSet[]>([]),
  /** Map marks (`ldb.marks`). */
  marks: signal<Mark[]>([]),
  /** Automatic SOS logs (`ldb.sosLogs`). */
  sosLogs: signal<SosLog[]>([]),
  /** Checklist bases (`ldb.ckLib`). */
  ckLib: signal<ChecklistBase[]>([]),
  /** Sea checklist template (`ldb.tpl.mer`). */
  seaTpl: signal<SeaTemplate>({}),
  /** Aboard task rotation template (`ldb.taskTpl`). */
  taskTpl: signal<TaskTemplate | null>(null),
  /** Button customizations (`ldb.uiEdits`). */
  uiEdits: signal<Record<string, UiEdit>>({}),
  /** PréP flow state (not persisted). */
  prep: signal<PrepState | null>(null),
  /** Boat and crew usage order of the PréP flow (`ldb.prepUse`). */
  prepUse: signal<PrepUseLog>({ boat: [], crew: [] }),
  /** Independent PréP paths of the three lake purposes (`ldb.prepPaths`). */
  prepPaths: signal<Record<string, unknown>>({}),
  /** Man-overboard logs kept on the phone when no cruise is open (`ldb.mobLogs`); see `mobLogs()`. */
  mobLogs: signal<MobLog[]>([]),
};
