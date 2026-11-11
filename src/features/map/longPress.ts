import type { LatLng, LeafletMouseEvent, Map as LeafletMap } from 'leaflet';

import { buzz } from '../../lib/dom.ts';
import { addMark, toast } from '../../state/index.ts';

import { depthAt } from './isobath.ts';
import { leaflet } from './leaflet.ts';
import { extrasOf, whileMapLive } from './mapExtras.ts';
import {
  drawGotoLine,
  drawMarks,
  marksMaps,
  marksRedraw,
} from './marksDraw.ts';
import { crossAttach, longPressDone } from './tapCross.ts';
import { tracker } from './trackerState.ts';

/** Position the tracker shows at its next opening (« 🗺 Voir » of a mark). */
export const marksFly: { position: [number, number] | null } = {
  position: null,
};

/**
 * Attach the long press menu and draw the marks on a new map (legacy `lpAttach`).
 * @param map - Leaflet map.
 */
export function lpAttach(map: LeafletMap): void {
  marksMaps.add(map);
  map.on('unload', () => marksMaps.delete(map));
  const container = map.getContainer();
  const { signal } = extrasOf(map).controller;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let start: { x: number; y: number } | null = null;
  let pointers = 0;
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  container.addEventListener(
    'pointerdown',
    (event) => {
      pointers++;
      const onControl = (event.target as Element).closest?.(
        '.leaflet-control, .leaflet-popup',
      );
      if (pointers > 1 || onControl) {
        cancel();
        return;
      }
      const from = { x: event.clientX, y: event.clientY };
      start = from;
      cancel();
      timer = setTimeout(() => {
        timer = undefined;
        buzz();
        const box = container.getBoundingClientRect();
        const point = leaflet().point(from.x - box.left, from.y - box.top);
        longPressDone();
        markHere(map.containerPointToLatLng(point));
      }, 650);
    },
    { signal },
  );
  container.addEventListener(
    'pointermove',
    (event) => {
      if (!timer || !start) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) {
        cancel();
      }
    },
    { signal },
  );
  const release = () => {
    pointers = Math.max(0, pointers - 1);
    cancel();
  };
  for (const name of ['pointerup', 'pointercancel', 'pointerleave']) {
    container.addEventListener(name, release, { signal });
  }
  map.on('contextmenu', (event: LeafletMouseEvent) => {
    const original = event.originalEvent as PointerEvent | undefined;
    if (original?.pointerType === 'touch') return;
    longPressDone();
    markHere(event.latlng);
  });
  // A short tap: the cross of the menus of the point.
  crossAttach(map);
  map.on('movestart zoomstart', cancel);
  map.whenReady(() => {
    // During `load` Leaflet does not know its bounds yet.
    whileMapLive(
      map,
      () => {
        drawMarks(map);
        drawGotoLine(map);
      },
      0,
    );
    const { position } = marksFly;
    if (position) {
      marksFly.position = null;
      whileMapLive(
        map,
        () => {
          map.setView(position, 15);
          if (tracker.current) tracker.current.follow = false;
        },
        300,
      );
    }
  });
}

/**
 * A long press saves the point at once as a new mark.
 * @param at - The point pressed.
 */
function markHere(at: LatLng): void {
  const mark = addMark(at.lat, at.lng, depthAt(at.lat, at.lng));
  marksRedraw();
  toast(`📌 Marque ${mark.name} enregistrée`);
}
