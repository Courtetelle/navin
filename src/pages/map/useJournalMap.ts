import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

import { loadLeaflet } from '../../features/map/leaflet.ts';
import type { MapDataResult } from '../../features/map/mapData.ts';
import { stopMapWatch } from '../../features/map/mapWatch.ts';

import type { JournalMap } from './buildJournalMap.ts';
import { buildJournalMap } from './buildJournalMap.ts';

const OFFLINE_NOTE =
  'Hors ligne : seul le fond des zones déjà affichées avec du réseau est disponible.';
const NO_LEAFLET_NOTE =
  'Carte de fond indisponible sans réseau : la trace est affichée seule.';

/** The map of the logbook, as its page sees it. */
interface JournalMapState {
  /** The map, once created. */
  journal: RefObject<JournalMap | null>;
  /** Text of `#mapNote`. */
  note: string;
  /** My position is followed. */
  following: boolean;
  /** Leaflet could not load. */
  noMap: boolean;
}

/**
 * Create the map of a period once Leaflet is there, and remove it with the page.
 * @param box - The `#map` element.
 * @param data - Line and entries of the period.
 * @returns The map and what it shows around it.
 */
export function useJournalMap(
  box: RefObject<HTMLDivElement | null>,
  data: MapDataResult,
): JournalMapState {
  const [note, setNote] = useState(navigator.onLine ? '' : OFFLINE_NOTE);
  const [following, setFollowing] = useState(false);
  const [noMap, setNoMap] = useState(false);
  const journal = useRef<JournalMap | null>(null);
  useEffect(() => {
    stopMapWatch();
    let closed = false;
    loadLeaflet()
      .then(() => {
        if (closed || !box.current) return;
        journal.current = buildJournalMap(box.current, data, {
          onNote: setNote,
          onFollow: setFollowing,
        });
      })
      .catch(() => {
        if (closed) return;
        setNoMap(true);
        setNote(NO_LEAFLET_NOTE);
      });
    return () => {
      closed = true;
      journal.current?.dispose();
      journal.current = null;
    };
  }, [box, data]);
  return { journal, note, following, noMap };
}
