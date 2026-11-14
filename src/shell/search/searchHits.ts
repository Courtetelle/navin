import { textOf } from '../../lib/format.ts';
import { crewSetName, memberName, state } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import type { RecordLine } from './recordText.ts';
import {
  anyLines,
  boatLines,
  crewLines,
  foundIn,
  linesText,
  markLines,
  memberLines,
} from './recordText.ts';
import type { FunctionEntry, PlaceEntry } from './searchIndex.ts';
import { functionEntries, matches, placeEntries } from './searchIndex.ts';

/** What a hit opens. */
type HitKind =
  | 'function'
  | 'place'
  | 'boat'
  | 'member'
  | 'crew'
  | 'mark'
  | 'trace'
  | 'soslog'
  | 'cruise'
  | 'ckbase';

/** One suggestion of the search. */
export interface SearchHit {
  kind: HitKind;
  /** Unique key. */
  key: string;
  /** Text shown, with its icon. */
  label: string;
  /** Id of the record, the view of a function. */
  id: string;
  /** Where a place or a mark is. */
  place?: PlaceEntry;
  /** The list a band is found in: it opens there, the band lit. */
  view?: string;
}

const ICONS: Record<HitKind, string> = {
  function: '',
  place: '📍',
  boat: '⛵',
  member: '👤',
  crew: '👥',
  mark: '◆',
  trace: '🛰',
  soslog: '🆘',
  cruise: '⛵',
  ckbase: '✅',
};

/** What the search of a screen looks for first. */
export interface SearchContext {
  /** Name of what is searched, shown above the hits. */
  title: string;
  /** Placeholder of the field. */
  placeholder: string;
  kinds: readonly HitKind[];
  /** Places are also asked to the network. */
  online: boolean;
}

/** The other lists: their title and what they hold. */
const LISTS: Readonly<Record<string, { title: string; kind: HitKind }>> = {
  traces: { title: 'Mes traces', kind: 'trace' },
  soslogs: { title: 'les logs SOS', kind: 'soslog' },
  cruises: { title: 'Mes navigations', kind: 'cruise' },
  ckbases: { title: 'les check-lists', kind: 'ckbase' },
};

const MAP_VIEWS = new Set(['tracker', 'map', 'cartes', 'meteo', 'weather']);

/**
 * What the magnifier looks for on a screen: a place on the map, a name in
 * the boats, the crew cards or the crews, a mark in the marks.
 * @param view - The screen.
 * @returns The context.
 */
export function searchContext(view: string): SearchContext {
  if (view === 'boats') {
    return {
      title: 'Bateaux',
      placeholder: 'Recherche dans Mes bateaux',
      kinds: ['boat'],
      online: false,
    };
  }
  if (view === 'people' || view === 'crew') {
    return {
      title: 'Co-équipiers',
      placeholder: 'Recherche dans Mes co-équipiers',
      kinds: ['member'],
      online: false,
    };
  }
  if (view === 'crews') {
    return {
      title: 'Équipages',
      placeholder: 'Recherche dans Mes équipages',
      kinds: ['crew'],
      online: false,
    };
  }
  if (view === 'marks') {
    return {
      title: 'Marques',
      placeholder: 'Recherche dans Mes marques',
      kinds: ['mark'],
      online: false,
    };
  }
  const list = LISTS[view];
  if (list) {
    return {
      title: list.title,
      placeholder: `Recherche dans ${list.title}`,
      kinds: [list.kind],
      online: false,
    };
  }
  if (MAP_VIEWS.has(view)) {
    return {
      title: 'Lieux',
      placeholder: 'Un lieu, un port, un pays…',
      kinds: ['place', 'mark'],
      online: true,
    };
  }
  return {
    title: 'Fonctions',
    placeholder: 'Une fonction, un nom, un lieu…',
    kinds: ['function'],
    online: false,
  };
}

function hitsOf(kind: HitKind, query: string): SearchHit[] {
  const icon = ICONS[kind];
  if (kind === 'function') {
    return matches(
      query,
      functionEntries(),
      (entry: FunctionEntry) => `${entry.title} ${entry.sub}`,
    ).map((entry) => ({
      kind,
      key: `f-${entry.key}`,
      label: entry.title,
      id: entry.key,
    }));
  }
  if (kind === 'place') {
    return matches(query, placeEntries(), (entry) => entry.name).map(
      (place) => ({
        kind,
        key: `p-${place.name}`,
        label: `${icon} ${place.name}`,
        id: place.name,
        place,
      }),
    );
  }
  if (kind === 'trace' || kind === 'cruise') {
    return inRecords(
      query,
      state.data.index.value,
      (meta) => anyLines([meta, storedCruise(meta.id)]),
      (meta) => textOf(meta.name),
    ).map(([meta, where]) => ({
      kind,
      key: `${kind}-${meta.id}`,
      label: shown(icon, textOf(meta.name) || 'Navigation', where),
      id: meta.id,
      view: kind === 'trace' ? 'traces' : 'cruises',
    }));
  }
  if (kind === 'soslog') {
    return inRecords(query, state.data.sosLogs.value, anyLines, (log) =>
      sosLogName(log.start, log.boat),
    ).map(([log, where]) => ({
      kind,
      key: `s-${log.id}`,
      label: shown(icon, sosLogName(log.start, log.boat), where),
      id: log.id,
      view: 'soslogs',
    }));
  }
  if (kind === 'ckbase') {
    return inRecords(
      query,
      state.data.ckLib.value,
      anyLines,
      (base) => base.name,
    ).map(([base, where]) => ({
      kind,
      key: `l-${base.id}`,
      label: shown(icon, base.name, where),
      id: base.id,
      view: 'ckbases',
    }));
  }
  if (kind === 'boat') {
    return inRecords(query, state.data.boats.value, boatLines, (boat) =>
      textOf(boat.info.boat),
    ).map(([boat, where]) => ({
      kind,
      key: `b-${boat.id}`,
      label: shown(icon, boat.info.boat || 'Bateau', where),
      id: boat.id,
    }));
  }
  if (kind === 'member') {
    return inRecords(
      query,
      state.data.members.value,
      memberLines,
      memberName,
    ).map(([member, where]) => ({
      kind,
      key: `m-${member.id}`,
      label: shown(icon, memberName(member), where),
      id: member.id,
    }));
  }
  if (kind === 'crew') {
    return inRecords(
      query,
      state.data.crewSets.value,
      crewLines,
      crewSetName,
    ).map(([set, where]) => ({
      kind,
      key: `c-${set.id}`,
      label: shown(icon, crewSetName(set), where),
      id: set.id,
    }));
  }
  return inRecords(
    query,
    state.data.marks.value,
    markLines,
    (mark) => mark.name,
  ).map(([mark, where]) => ({
    kind,
    key: `k-${mark.id}`,
    label: shown(icon, mark.name, where),
    id: mark.id,
    place: { name: mark.name, lat: mark.lat, lon: mark.lon },
  }));
}

/**
 * Records holding every word typed, in their name, the content of a field
 * or its title; the name first.
 * @param query - Words typed.
 * @param records - The records.
 * @param linesOf - The fields of a record.
 * @param nameOf - The name of a record.
 * @returns The records found, each with where the words were found.
 */
function inRecords<T>(
  query: string,
  records: readonly T[],
  linesOf: (record: T) => RecordLine[],
  nameOf: (record: T) => string,
): Array<[T, string]> {
  const lines = new Map<T, RecordLine[]>();
  const found = matches(query, records, (record) => {
    const own = linesOf(record);
    lines.set(record, own);
    return `${nameOf(record)} ${linesText(own)}`;
  });
  return found.map((record) => [
    record,
    foundIn(query, nameOf(record), lines.get(record) ?? []),
  ]);
}

/** Stored outings, read once per change. */
const cruises = new Map<string, { stamp: string; cruise: unknown }>();

function storedCruise(id: string): unknown {
  const meta = state.data.index.value.find((one) => one.id === id);
  const stamp = `${textOf(meta?.updated)}${textOf(meta?.created)}`;
  const kept = cruises.get(id);
  if (kept?.stamp === stamp) return kept.cruise;
  const cruise = store.get<unknown>(`ldb.cruise.${id}`, null);
  cruises.set(id, { stamp, cruise });
  return cruise;
}

function sosLogName(start: string, boat: string): string {
  const date = new Date(start);
  const day = Number.isNaN(date.getTime())
    ? start
    : date.toLocaleString('fr-CH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
  return boat ? `${day} · ${boat}` : day;
}

function shown(icon: string, name: string, where: string): string {
  return where ? `${icon} ${name} · ${where}` : `${icon} ${name}`;
}

/**
 * The suggestions of a search: only what the screen where it is opened
 * holds.
 * @param query - Words typed.
 * @param context - What the screen looks for.
 * @returns The hits.
 */
export function searchHits(query: string, context: SearchContext): SearchHit[] {
  return context.kinds.flatMap((kind) => hitsOf(kind, query));
}
