/*
 * The Poubelle (Paramètres › 🗑 Poubelle, Corban 27/11/2026): every record
 * deleted, here or on another device of the skipper, is kept 30 days and can
 * be taken back one by one, to the list it came from. Its content waits in the
 * photo database (a navigation can be large), its line in `ldb.trash`.
 */

import { effect, signal } from '@preact/signals-react';

import { fmtShortDate } from '../../lib/format.ts';
import type { AlertRecord } from '../../model/alertLog.ts';
import type { NavRoute } from '../../model/routes.ts';
import type {
  Boat,
  CrewSet,
  CruiseMeta,
  Mark,
  Member,
  SosLog,
} from '../../model/types.ts';
import type { Voyage } from '../../model/voyages.ts';
import {
  ALERT_MOST,
  alertLog,
  hooks,
  mergeAlerts,
  mergeBoats,
  mergeMarks,
  mergeMembers,
  mergeRoutes,
  state,
  updateCrewSets,
  updateSosLogs,
  updateVoyageStore,
} from '../../state/index.ts';
import {
  TRASH_PREFIX,
  binnedPhotos,
  dropPhoto,
  emptyPhotoBin,
  getPhoto,
  keepPhotos,
  putPhoto,
} from '../../storage/photos.ts';
import { store } from '../../storage/store.ts';
import type { SavedRouting } from '../map/routingState.ts';
import { mergeRoutings, savedRoutings } from '../map/routingState.ts';

/** What can go to the Poubelle (the kinds the synchronisation follows). */
export type TrashKind =
  | 'cruises'
  | 'voyages'
  | 'boats'
  | 'members'
  | 'crewSets'
  | 'marks'
  | 'routes'
  | 'routings'
  | 'sosLogs'
  | 'alerts';

/** One record of the Poubelle. */
export interface TrashLine {
  /** `kind:id`. */
  key: string;
  kind: TrashKind;
  id: string;
  /** Its name, as the list showed it. */
  label: string;
  /** When it was deleted (ms). */
  at: number;
}

/** A record is kept this long. */
export const TRASH_MS = 30 * 24 * 3600 * 1000;
const KEY = 'ldb.trash';

/** Where each kind goes back to, for the Poubelle. */
export const TRASH_PLACES: Readonly<Record<TrashKind, string>> = {
  cruises: 'Navigations',
  voyages: 'data › Croisières',
  boats: 'data › Bateaux',
  members: 'data › Équipages, fiches',
  crewSets: 'data › Équipages',
  marks: 'Marques',
  routes: 'Routes',
  routings: 'Routages',
  sosLogs: 'Journal SOS',
  alerts: 'Journal des alertes',
};

/** The records of the Poubelle, newest first. */
export const trashLines = signal<readonly TrashLine[]>(
  store.get<TrashLine[]>(KEY, []),
);

/** Told when a record comes back (the synchronisation brings it back everywhere). */
let onRestored: ((kind: TrashKind, id: string) => void) | null = null;

/**
 * Who is told when a record comes back.
 * @param listener - The listener.
 */
export function whenRestored(
  listener: (kind: TrashKind, id: string) => void,
): void {
  onRestored = listener;
}

function save(next: readonly TrashLine[]): void {
  trashLines.value = next;
  store.set(KEY, next);
}

/**
 * Put a deleted record in the Poubelle.
 * @param kind - Its kind.
 * @param id - Its id.
 * @param label - Its name.
 * @param content - What brings it back.
 */
export function throwAway(
  kind: TrashKind,
  id: string,
  label: string,
  content: unknown,
): void {
  const key = `${kind}:${id}`;
  const line: TrashLine = {
    key,
    kind,
    id,
    label: label || 'Sans nom',
    at: Date.now(),
  };
  save([line, ...trashLines.peek().filter((item) => item.key !== key)]);
  void putPhoto(`${TRASH_PREFIX}${key}`, JSON.stringify(content)).catch(
    () => undefined,
  );
}

/**
 * Take a record back from the Poubelle, to its list.
 * @param key - `kind:id`.
 * @returns Whether it came back.
 */
export async function restoreTrash(key: string): Promise<boolean> {
  const line = trashLines.peek().find((item) => item.key === key);
  if (!line) return false;
  const raw = await getPhoto(`${TRASH_PREFIX}${key}`);
  if (typeof raw !== 'string') return false;
  const content = JSON.parse(raw) as unknown;
  // Its own line goes first, so the watch does not think it new.
  save(trashLines.peek().filter((item) => item.key !== key));
  putBack(line.kind, content);
  keepPhotos(binnedPhotos().filter((id) => raw.includes(id)));
  await dropPhoto(`${TRASH_PREFIX}${key}`);
  onRestored?.(line.kind, line.id);
  return true;
}

function putBack(kind: TrashKind, content: unknown): void {
  switch (kind) {
    case 'cruises': {
      const { meta, keys } = content as {
        meta: CruiseMeta;
        keys: Record<string, unknown>;
      };
      for (const [key, value] of Object.entries(keys)) store.set(key, value);
      const { data } = state;
      if (!data.index.peek().some((line) => line.id === meta.id)) {
        data.index.value = [...data.index.peek(), meta];
        store.set('ldb.index', data.index.value);
      }
      return;
    }
    case 'voyages': {
      const voyage = content as Voyage;
      updateVoyageStore((draft) => {
        if (!draft.list.some((item) => item.id === voyage.id)) {
          draft.list.push(voyage);
        }
      });
      return;
    }
    case 'boats': {
      mergeBoats([content as Boat]);
      return;
    }
    case 'members': {
      mergeMembers([content as Member]);
      return;
    }
    case 'crewSets': {
      const set = content as CrewSet;
      updateCrewSets((sets) => {
        if (!sets.some((item) => item.id === set.id)) sets.push(set);
      });
      return;
    }
    case 'marks': {
      mergeMarks([content as Mark]);
      return;
    }
    case 'routes': {
      mergeRoutes([content as NavRoute]);
      return;
    }
    case 'routings': {
      mergeRoutings([content as SavedRouting]);
      return;
    }
    case 'sosLogs': {
      const log = content as SosLog;
      updateSosLogs((logs) => {
        if (!logs.some((item) => item.id === log.id)) logs.push(log);
      });
      return;
    }
    case 'alerts': {
      mergeAlerts([content as AlertRecord]);
      break;
    }
    default:
  }
}

/**
 * Forget the records kept more than 30 days, and free the photos of the bin.
 * @param now - Current time.
 * @returns When done.
 */
export async function emptyOldTrash(now = Date.now()): Promise<void> {
  const old = trashLines.peek().filter((line) => now - line.at > TRASH_MS);
  if (old.length > 0) {
    save(trashLines.peek().filter((line) => now - line.at <= TRASH_MS));
    /* eslint-disable no-await-in-loop -- one IndexedDB delete at a time */
    for (const line of old) await dropPhoto(`${TRASH_PREFIX}${line.key}`);
    /* eslint-enable no-await-in-loop */
  }
  await emptyPhotoBin(now);
}

/* ---------- The watch of the lists ---------- */

interface Watched<Item> {
  kind: TrashKind;
  items: () => readonly Item[];
  idOf: (item: Item) => string;
  labelOf: (item: Item) => string;
}

function memberName(member: Member): string {
  return [member.prenom, member.nom]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(' ');
}

function watched(): Array<Watched<never>> {
  const { data } = state;
  const lists: Array<Watched<never>> = [
    {
      kind: 'voyages',
      items: () => data.voyageStore.value.list,
      idOf: (voyage: Voyage) => voyage.id,
      labelOf: (voyage: Voyage) => voyage.name,
    },
    {
      kind: 'boats',
      items: () => data.boats.value,
      idOf: (boat: Boat) => boat.id,
      labelOf: (boat: Boat) => boat.info.boat ?? '',
    },
    {
      kind: 'members',
      items: () => data.members.value,
      idOf: (member: Member) => member.id,
      labelOf: memberName,
    },
    {
      kind: 'crewSets',
      items: () => data.crewSets.value,
      idOf: (set: CrewSet) => set.id,
      labelOf: (set: CrewSet) => set.name || set.ident || '',
    },
    {
      kind: 'marks',
      items: () => data.marks.value,
      idOf: (mark: Mark) => mark.id,
      labelOf: (mark: Mark) => mark.name ?? '',
    },
    {
      kind: 'routes',
      items: () => data.routes.value,
      idOf: (route: NavRoute) => route.id,
      labelOf: (route: NavRoute) => route.name ?? '',
    },
    {
      kind: 'routings',
      items: () => savedRoutings.value,
      idOf: (item: SavedRouting) => item.id,
      labelOf: (item: SavedRouting) => item.shown.name ?? '',
    },
    {
      kind: 'sosLogs',
      items: () => data.sosLogs.value,
      idOf: (log: SosLog) => log.id,
      labelOf: (log: SosLog) =>
        `SOS ${log.start ? fmtShortDate(new Date(log.start)) : ''}`.trim(),
    },
    {
      kind: 'alerts',
      items: () => alertLog.value,
      idOf: (alert: AlertRecord) => alert.id,
      labelOf: (alert: AlertRecord) =>
        `${alert.title} · ${fmtShortDate(new Date(alert.t))}`,
    },
  ] as unknown as Array<Watched<never>>;
  return lists;
}

/**
 * Watch the lists: what leaves one goes to the Poubelle, what comes back
 * (from another device) leaves it. Started once the data is loaded.
 */
export function watchTrash(): void {
  hooks.cruiseGone = (id, keys) => {
    const meta = state.data.index.peek().find((line) => line.id === id);
    if (!meta) return;
    throwAway('cruises', id, meta.name, { meta, keys });
  };
  for (const list of watched()) watchList(list);
  // A navigation brought back by another device leaves the Poubelle.
  effect(() => {
    const ids = new Set(state.data.index.value.map((line) => line.id));
    const back = trashLines
      .peek()
      .filter((line) => line.kind === 'cruises' && ids.has(line.id));
    if (back.length > 0) forget(back);
  });
  void emptyOldTrash();
}

function watchList<Item>({ kind, items, idOf, labelOf }: Watched<Item>): void {
  let before = new Map<string, Item>();
  let first = true;
  effect(() => {
    const now = items();
    const next = new Map(now.map((item) => [idOf(item), item] as const));
    if (!first) {
      // The oldest alerts beyond the limit of the journal are not deleted.
      const capped = kind === 'alerts' && now.length >= ALERT_MOST;
      for (const [id, item] of before) {
        if (next.has(id) || capped) continue;
        throwAway(kind, id, labelOf(item), item);
      }
      const back = trashLines
        .peek()
        .filter(
          (line) =>
            line.kind === kind && next.has(line.id) && !before.has(line.id),
        );
      if (back.length > 0) forget(back);
    }
    first = false;
    before = next;
  });
}

function forget(lines: readonly TrashLine[]): void {
  const keys = new Set(lines.map((line) => line.key));
  save(trashLines.peek().filter((line) => !keys.has(line.key)));
  for (const key of keys) void dropPhoto(`${TRASH_PREFIX}${key}`);
}
