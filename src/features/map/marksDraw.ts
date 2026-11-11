import type { Map as LeafletMap } from 'leaflet';

import { fmtShortDate, fmtUtc } from '../../lib/format.ts';
import { fmtPos } from '../../lib/geo.ts';
import type { Mark } from '../../model/types.ts';
import { go } from '../../shell/router.ts';
import { pinSvg } from '../../shell/topbar/tabIcons.ts';
import { herePos, state } from '../../state/index.ts';

import { escapeHtml } from './escapeHtml.ts';
import { gotoTarget, setGoto } from './goto.ts';
import { leaflet } from './leaflet.ts';
import { extrasOf, isMapLive } from './mapExtras.ts';
import { relativeHtml } from './relativeText.ts';

/** Maps with the long press menu, marks and Go to line. */
export const marksMaps = new Set<LeafletMap>();

/**
 * Draw the Go to line on a map (legacy `drawGotoLine`).
 * @param map - Leaflet map.
 */
export function drawGotoLine(map: LeafletMap): void {
  const L = leaflet();
  const extras = extrasOf(map);
  extras.gotoLine?.remove();
  extras.gotoLine = null;
  const target = gotoTarget.value;
  if (!target) return;
  const me = herePos();
  const end: [number, number] = [target.lat, target.lon];
  const circle = L.circleMarker(end, {
    radius: 9,
    color: '#ff00aa',
    weight: 3,
    fillOpacity: 0.2,
  });
  const line = me
    ? [
        L.polyline([[me.lat, me.lon], end], {
          color: '#ff00aa',
          weight: 3,
          dashArray: '8 6',
        }),
      ]
    : [];
  extras.gotoLine = L.layerGroup([...line, circle]).addTo(map);
}

/**
 * Draw the marks on a map (legacy `drawMarks`).
 * @param map - Leaflet map.
 */
export function drawMarks(map: LeafletMap): void {
  const L = leaflet();
  const extras = extrasOf(map);
  extras.marks?.remove();
  const markers = state.data.marks.value.map((mark) =>
    L.marker([mark.lat, mark.lon], {
      icon: L.divIcon({
        className: 'mark-ic',
        // The pin of the app, its point on the mark.
        html: `<span class="mark-pin">${pinSvg('')}</span><b>${escapeHtml(mark.name)}</b>`,
        iconSize: [80, 24],
        iconAnchor: [7, 20],
      }),
    }).bindPopup(() => markPopup(mark)),
  );
  extras.marks = L.layerGroup(markers).addTo(map);
}

/** Redraw the marks and the Go to line on the maps on screen (legacy `marksRedraw`). */
export function marksRedraw(): void {
  for (const map of marksMaps) {
    if (!isMapLive(map)) continue;
    drawMarks(map);
    drawGotoLine(map);
  }
}

/** Redraw the Go to line on the maps on screen. */
export function drawGotoLines(): void {
  for (const map of marksMaps) {
    if (isMapLive(map)) drawGotoLine(map);
  }
}

function markPopup(mark: Mark): HTMLElement {
  const box = document.createElement('div');
  box.className = 'lp-menu';
  const moment = new Date(mark.at);
  const note = mark.note ? ` · ${escapeHtml(mark.note)}` : '';
  const when = `${escapeHtml(fmtShortDate(moment))} ${escapeHtml(fmtUtc(moment))}`;
  const depth = mark.depth ? `<div>🌊 ${escapeHtml(mark.depth)}</div>` : '';
  box.innerHTML = `<b>📌 ${escapeHtml(mark.name)}</b>${note}<br><small>${when}</small><div>📍 ${escapeHtml(fmtPos(mark))}</div>${depth}<div>🧭 ${relativeHtml(mark)}</div><div class="lp-btns"><button class="btn primary">🎯 Go to</button><button class="btn">📒 Mes marques</button></div>`;
  const [gotoButton, marksButton] = box.querySelectorAll('button');
  gotoButton?.addEventListener('click', () => {
    setGoto({ lat: mark.lat, lon: mark.lon, name: mark.name });
  });
  marksButton?.addEventListener('click', () => go('marks'));
  return box;
}
