import type { Boat } from '../../model/types.ts';
import {
  crewSetDate,
  crewSetName,
  memberFieldsX,
  memberName,
  state,
} from '../../state/index.ts';

import {
  allLakeTracks,
  boatDocs,
  boatInfoRows,
  trackStats,
} from './crossDomain.ts';
import type { PublishableBoat } from './listItems.ts';
import { boatItems, crewItems, peopleItems } from './listItems.ts';
import {
  checklistBaseItems,
  markItems,
  sosLogItems,
  traceItems,
} from './listRecordItems.ts';
import type { ListKind, PublishItem } from './types.ts';

/** Title of each list. */
export const LIST_TITLES: Readonly<Record<ListKind, string>> = {
  people: 'Les coéquipiers·ères',
  crews: 'Équipages',
  boats: 'Mes bateaux',
  traces: 'Mes traces',
  marks: 'Mes marques',
  ckbases: 'Bases de check-list',
  soslogs: 'Logs SOS',
};

/** What the elements of each list are called. */
export const ITEM_LABELS: Readonly<Record<ListKind, string>> = {
  people: 'Fiches',
  crews: 'Équipages',
  boats: 'Bateaux',
  traces: 'Traces',
  marks: 'Marques',
  ckbases: 'Bases',
  soslogs: 'Logs',
};

const { boats, ckLib, crewSets, marks, members, sosLogs } = state.data;

const ITEM_BUILDERS: Readonly<Record<ListKind, () => PublishItem[]>> = {
  people: () => peopleItems(members.value, memberFieldsX(), memberName),
  crews: () =>
    crewItems(crewSets.value, members.value, {
      nameOf: crewSetName,
      dateOf: crewSetDate,
      memberNameOf: memberName,
    }),
  boats: () => boatItems(boats.value.map((boat) => publishableBoat(boat))),
  traces: () => traceItems(publishableTracks()),
  marks: () => markItems(marks.value),
  ckbases: () => checklistBaseItems(ckLib.value),
  soslogs: () => sosLogItems(sosLogs.value),
};

const WITH_EXTRA_SENDS: ReadonlySet<ListKind> = new Set([
  'people',
  'boats',
  'soslogs',
  'crews',
]);

/**
 * Whether a list has sends of its own in the Partager window.
 * @param kind - List kind.
 * @returns Whether the « Autres envois » part shows.
 */
export function hasExtraSends(kind: ListKind): boolean {
  return WITH_EXTRA_SENDS.has(kind);
}

/**
 * Whether the Partager row of a list is shown.
 * @param kind - List kind.
 * @returns Whether the list has elements or sends of its own.
 */
export function listHasContent(kind: ListKind): boolean {
  return hasExtraSends(kind) || listItems(kind).length > 0;
}

/**
 * The elements of a list, from the current data.
 * @param kind - List kind.
 * @returns The elements.
 */
export function listItems(kind: ListKind): PublishItem[] {
  return ITEM_BUILDERS[kind]();
}

function publishableBoat(boat: Boat): PublishableBoat {
  const documents = boatDocs(boat);
  return {
    id: boat.id,
    name: boat.info.boat || 'Bateau',
    sections: boatInfoRows(boat),
    hasThumb:
      Boolean(boat.thumb) &&
      documents.some((document) => document.id === boat.thumb),
    photos: documents.filter((document) => !document.pdf),
  };
}

function publishableTracks() {
  return allLakeTracks().map((entry) => {
    const stats = trackStats(entry.track);
    return {
      id: entry.id,
      name: entry.name,
      start: stats.start as number,
      end: stats.end as number,
      nm: stats.nm,
      max: stats.max,
    };
  });
}
