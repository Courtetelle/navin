import { textOf } from '../../lib/format.ts';
import { crewSetName, memberName, state } from '../../state/index.ts';

import type { FunctionEntry, PlaceEntry } from './searchIndex.ts';
import { functionEntries, matches, placeEntries } from './searchIndex.ts';

/** What a hit opens. */
type HitKind = 'function' | 'place' | 'boat' | 'member' | 'crew' | 'mark';

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
}

const ICONS: Record<HitKind, string> = {
  function: '',
  place: '📍',
  boat: '⛵',
  member: '👤',
  crew: '👥',
  mark: '◆',
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
      placeholder: 'Nom d’un bateau…',
      kinds: ['boat'],
      online: false,
    };
  }
  if (view === 'people' || view === 'crew') {
    return {
      title: 'Co-équipiers',
      placeholder: 'Nom d’un co-équipier…',
      kinds: ['member'],
      online: false,
    };
  }
  if (view === 'crews') {
    return {
      title: 'Équipages',
      placeholder: 'Nom d’un équipage…',
      kinds: ['crew'],
      online: false,
    };
  }
  if (view === 'marks') {
    return {
      title: 'Marques',
      placeholder: 'Nom d’une marque…',
      kinds: ['mark'],
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
  if (kind === 'boat') {
    return matches(query, state.data.boats.value, (boat) =>
      textOf(boat.info.boat),
    ).map((boat) => ({
      kind,
      key: `b-${boat.id}`,
      label: `${icon} ${boat.info.boat || 'Bateau'}`,
      id: boat.id,
    }));
  }
  if (kind === 'member') {
    return matches(query, state.data.members.value, memberName).map(
      (member) => ({
        kind,
        key: `m-${member.id}`,
        label: `${icon} ${memberName(member)}`,
        id: member.id,
      }),
    );
  }
  if (kind === 'crew') {
    return matches(query, state.data.crewSets.value, crewSetName).map(
      (set) => ({
        kind,
        key: `c-${set.id}`,
        label: `${icon} ${crewSetName(set)}`,
        id: set.id,
      }),
    );
  }
  return matches(query, state.data.marks.value, (mark) => mark.name).map(
    (mark) => ({
      kind,
      key: `k-${mark.id}`,
      label: `${icon} ${mark.name}`,
      id: mark.id,
      place: { name: mark.name, lat: mark.lat, lon: mark.lon },
    }),
  );
}

const ALL_KINDS: readonly HitKind[] = [
  'function',
  'boat',
  'member',
  'crew',
  'mark',
  'place',
];

/**
 * The suggestions of a search: first what the screen looks for, then
 * everything else of the app (functions, boats, cards, crews, marks, places).
 * @param query - Words typed.
 * @param context - What the screen looks for.
 * @returns The hits of the screen, then the others.
 */
export function searchHits(
  query: string,
  context: SearchContext,
): { here: SearchHit[]; everywhere: SearchHit[] } {
  const here = context.kinds.flatMap((kind) => hitsOf(kind, query));
  const seen = new Set(here.map((hit) => hit.key));
  const everywhere = ALL_KINDS.flatMap((kind) => hitsOf(kind, query)).filter(
    (hit) => !seen.has(hit.key),
  );
  return { here, everywhere };
}
