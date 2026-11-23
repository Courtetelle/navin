import type { Map as LeafletMap } from 'leaflet';

import { herePos } from '../../state/index.ts';

import { whileMapLive } from './mapExtras.ts';
import { drawGotoLine, drawMarks, marksMaps } from './marksDraw.ts';
import { drawRouting } from './routingShown.ts';
import { crossAttach } from './tapCross.ts';
import { tracker } from './trackerState.ts';
import { showZoom } from './zoomShown.ts';

/**
 * Position the tracker shows at its next opening (a mark touched), with my
 * position too after a Go to.
 */
export const marksFly: {
  position: [number, number] | null;
  withMe?: boolean;
} = {
  position: null,
};

/**
 * Attach the cross of a tap and draw the marks on a new map (legacy
 * `lpAttach`); no mark by a long press any more.
 * @param map - Leaflet map.
 */
export function lpAttach(map: LeafletMap): void {
  marksMaps.add(map);
  map.on('unload', () => marksMaps.delete(map));
  // No mark by a long press on the map any more: a mark is saved from the
  // cross of a short tap (and the pin of the boat).
  // A short tap: the cross of the menus of the point.
  crossAttach(map);
  // The map moved with the fingers: ＋ and − for 3 s after the last move.
  map.on('dragstart drag dragend', showZoom);
  map.whenReady(() => {
    // During `load` Leaflet does not know its bounds yet.
    whileMapLive(
      map,
      () => {
        drawMarks(map);
        drawGotoLine(map);
        drawRouting(map);
      },
      0,
    );
    const { position, withMe } = marksFly;
    if (position) {
      marksFly.position = null;
      marksFly.withMe = false;
      whileMapLive(
        map,
        () => {
          const me = withMe ? herePos() : null;
          if (me) {
            // A Go to: the mark and the boat, both on the screen.
            map.fitBounds([position, [me.lat, me.lon]], {
              padding: [70, 70],
              maxZoom: 15,
            });
          } else {
            map.setView(position, 15);
          }
          if (tracker.current) tracker.current.follow = false;
        },
        300,
      );
    }
  });
}
