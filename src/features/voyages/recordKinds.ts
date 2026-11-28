/*
 * The four kinds of records of a cruise or outing (Corban, 27/11): Traces
 * (each trace on its own), Routes, Routages and
 * Marques. Each cruise shows its own under « Enregistrements »; data shows
 * them all.
 */

import { buzz } from '../../lib/dom.ts';
import { fmtShortDate } from '../../lib/format.ts';
import { go } from '../../shell/router.ts';
import {
  removeMark,
  removeRoute,
  renameMark,
  renameRoute,
  renameTrace,
  setMarkVoyage,
  setTraceVoyage,
  state,
} from '../../state/index.ts';
import { marksFly } from '../map/longPress.ts';
import { editRoute } from '../map/routeEditor.ts';
import { fitRouting, showRouting } from '../map/routingShown.ts';
import {
  removeRouting,
  renameRouting,
  savedRoutings,
  setRoutingVoyage,
} from '../map/routingState.ts';
import { showTrace } from '../map/traceActions.ts';
import { drawTrkList } from '../map/traceList.ts';
import type { LakeTrack } from '../map/trackStats.ts';
import { allLakeTracks } from '../map/trackStats.ts';
import { tracker } from '../map/trackerState.ts';
import { showZoomOnMap } from '../map/zoomShown.ts';
import { deleteTrace } from '../prep/index.ts';

import type { VoyageRecords } from './voyageRecords.ts';
import { setRouteVoyage, traceOrigin } from './voyageRecords.ts';

/** A kind of record. */
export type RecordKind = 'nav' | 'route' | 'routing' | 'mark';

/** What a kind is called, in a cruise and in data. */
export interface RecordKindInfo {
  kind: RecordKind;
  icon: string;
  title: string;
  /** Its tile in data. */
  all: string;
  /** The view of data that lists them all. */
  allView: string;
  /** Its list in {@link VoyageRecords}. */
  list: keyof VoyageRecords;
  /** One of them, for the counts. */
  one: string;
}

/** The four kinds, in the order of the tiles. */
export const RECORD_KINDS: readonly RecordKindInfo[] = [
  {
    kind: 'nav',
    icon: '🛰',
    title: 'Traces',
    all: 'Toutes les traces',
    allView: 'traces',
    list: 'traces',
    one: 'trace',
  },
  {
    kind: 'route',
    icon: '✏️',
    title: 'Routes',
    all: 'Toutes les routes',
    allView: 'routes',
    list: 'routes',
    one: 'route',
  },
  {
    kind: 'routing',
    icon: '⛵',
    title: 'Routages',
    all: 'Tous les routages',
    allView: 'routings',
    list: 'routings',
    one: 'routage',
  },
  {
    kind: 'mark',
    icon: '📌',
    title: 'Marques',
    all: 'Toutes les marques',
    allView: 'marks',
    list: 'marks',
    one: 'marque',
  },
];

/**
 * A kind by its name.
 * @param kind - The name, from the view argument.
 * @returns The kind, Traces when unknown.
 */
export function recordKind(kind: string | null | undefined): RecordKindInfo {
  const found = RECORD_KINDS.find((item) => item.kind === kind);
  if (found) return found;
  const [traces] = RECORD_KINDS;
  if (!traces) throw new Error('no record kind');
  return traces;
}

function traceById(id: string): LakeTrack | undefined {
  return allLakeTracks().find((track) => track.id === id);
}

/** One record as a line: its name and date. */
export interface RecordLine {
  id: string;
  name: string;
  when: string;
  /** Its name can be changed here. */
  renamable: boolean;
}

function day(iso: string | number | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : fmtShortDate(date);
}

/**
 * The records of one kind as lines.
 * @param kind - The kind.
 * @param records - The records.
 * @returns The lines, newest first.
 */
export function recordLines(
  kind: RecordKind,
  records: VoyageRecords,
): RecordLine[] {
  switch (kind) {
    case 'nav': {
      return records.traces.map((track) => ({
        id: track.id,
        name: track.name,
        when: day(traceOrigin(track).first),
        renamable: true,
      }));
    }
    case 'route': {
      return records.routes.map((route) => ({
        id: route.id,
        name: route.name,
        when: day(route.at),
        renamable: true,
      }));
    }
    case 'routing': {
      return records.routings.map((routing) => ({
        id: routing.id,
        name: routing.shown.name || routing.summary,
        when: day(routing.departMs),
        renamable: true,
      }));
    }
    case 'mark': {
      return records.marks.map((mark) => ({
        id: mark.id,
        name: mark.note ? `${mark.name} · ${mark.note}` : mark.name,
        when: day(mark.at),
        renamable: true,
      }));
    }
    default: {
      return [];
    }
  }
}

/**
 * Put a record into a cruise or outing, or take it out.
 * @param kind - Its kind.
 * @param id - Its id.
 * @param voyage - The cruise or outing, or undefined.
 */
export function moveRecord(
  kind: RecordKind,
  id: string,
  voyage: string | undefined,
): void {
  switch (kind) {
    case 'nav': {
      const track = traceById(id);
      if (!track) return;
      const { cruise, first } = traceOrigin(track);
      setTraceVoyage(cruise, first, voyage);
      return;
    }
    case 'route': {
      setRouteVoyage(id, voyage);
      return;
    }
    case 'routing': {
      setRoutingVoyage(id, voyage);
      return;
    }
    case 'mark': {
      setMarkVoyage(id, voyage);
      break;
    }
    default:
  }
}

/**
 * Give a record a new name.
 * @param kind - Its kind (not a navigation).
 * @param id - Its id.
 * @param name - The name.
 */
export function renameRecord(kind: RecordKind, id: string, name: string): void {
  const text = name.trim();
  if (!text) return;
  switch (kind) {
    case 'nav': {
      renameTrace(id, text);
      drawTrkList();
      return;
    }
    case 'route': {
      renameRoute(id, text);
      return;
    }
    case 'routing': {
      renameRouting(id, text);
      return;
    }
    case 'mark': {
      renameMark(id, text);
      break;
    }
    default:
  }
}

/**
 * Delete a record: it goes to the Poubelle for 30 days.
 * @param kind - Its kind.
 * @param id - Its id.
 */
export function deleteRecord(kind: RecordKind, id: string): void {
  switch (kind) {
    case 'nav': {
      if (deleteTrace(id)) drawTrkList();
      return;
    }
    case 'route': {
      removeRoute(id);
      return;
    }
    case 'routing': {
      removeRouting(id);
      return;
    }
    case 'mark': {
      removeMark(id);
      break;
    }
    default:
  }
}

/**
 * Open a record: the trace on the map of NavIn, the route in its
 * editor, the routing or the mark on the map.
 * @param kind - Its kind.
 * @param id - Its id.
 */
export function openRecord(kind: RecordKind, id: string): void {
  buzz();
  switch (kind) {
    case 'nav': {
      const track = traceById(id);
      if (!track) return;
      showTrace(track);
      showZoomOnMap();
      return;
    }
    case 'route': {
      editRoute(id);
      return;
    }
    case 'routing': {
      const saved = savedRoutings.peek().find((item) => item.id === id);
      if (!saved) return;
      showRouting(saved.shown);
      go('tracker');
      setTimeout(() => {
        const map = tracker.current?.map;
        if (map) fitRouting(map);
      }, 700);
      return;
    }
    case 'mark': {
      const mark = state.data.marks.peek().find((item) => item.id === id);
      if (!mark) return;
      marksFly.position = [mark.lat, mark.lon];
      go('tracker');
      showZoomOnMap();
      break;
    }
    default:
  }
}
