import type { LatLng, LeafletMouseEvent, Map as LeafletMap } from 'leaflet';

import { buzz } from '../../lib/dom.ts';
import { fmtPos } from '../../lib/geo.ts';
import { addMark, herePos, state, toast } from '../../state/index.ts';

import { escapeHtml } from './escapeHtml.ts';
import { wxNext } from './external.ts';
import { setGoto, wantPos } from './goto.ts';
import { depthAt } from './isobath.ts';
import { leaflet } from './leaflet.ts';
import { extrasOf, whileMapLive } from './mapExtras.ts';
import {
  drawGotoLine,
  drawMarks,
  marksMaps,
  marksRedraw,
} from './marksDraw.ts';
import { bearingText, relativeHtml } from './relativeText.ts';
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
        lpMenu(map, map.containerPointToLatLng(point));
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
    lpMenu(map, event.latlng);
  });
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

function lpMenu(map: LeafletMap, at: LatLng): void {
  const L = leaflet();
  const point = { lat: at.lat, lon: at.lng };
  const depth = depthAt(at.lat, at.lng);
  wantPos(true);
  if (!herePos() && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        state.view.myPos.value = {
          lat: coords.latitude,
          lon: coords.longitude,
          sog: null,
          cog: null,
          t: Date.now(),
        };
        const relative = document.querySelector('#lpRel');
        if (relative) relative.innerHTML = relativeHtml(point);
      },
      () => undefined,
      { maximumAge: 60_000, timeout: 15_000 },
    );
  }
  const depthText = depth
    ? `<b>${escapeHtml(depth)}</b>`
    : '<span class="muted">pas de courbe ici</span>';
  const html = `<div class="lp-menu">
    <div class="lp-pos">📍 <b>${escapeHtml(fmtPos(point))}</b></div>
    <div>🌊 Profondeur : ${depthText}</div>
    <div>💨 Vent : <span id="lpWind">${navigator.onLine ? 'recherche…' : 'hors réseau'}</span></div>
    <div>🧭 Depuis ma position : <span id="lpRel">${relativeHtml(point)}</span></div>
    <div class="lp-btns"><button class="btn primary" data-lp="goto">🎯 Go to</button><button class="btn" data-lp="mark">📌 Enregistrer une marque</button></div>
  </div>`;
  const popup = L.popup({
    maxWidth: 320,
    closeOnClick: false,
    autoPan: true,
    className: 'lp-pop',
  })
    .setLatLng(at)
    .setContent(html)
    .openOn(map);
  popup.getElement()?.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLElement>('[data-lp]');
    if (!button) return;
    buzz();
    if (button.dataset.lp === 'goto') {
      setGoto({ lat: point.lat, lon: point.lon, name: fmtPos(point) });
      map.closePopup(popup);
    }
    if (button.dataset.lp === 'mark') {
      const mark = addMark(point.lat, point.lon, depth);
      marksRedraw();
      toast(`Marque ${mark.name} enregistrée`);
      map.closePopup(popup);
    }
  });
  if (navigator.onLine) showWind(point);
}

function showWind(point: { lat: number; lon: number }): void {
  wxNext(point.lat, point.lon, 1)
    .then((weather) => {
      const box = document.querySelector('#lpWind');
      if (!box) return;
      const row = weather?.rows?.[0];
      const speed = row?.tws;
      if (!row || speed === null || speed === undefined) {
        box.textContent = 'indisponible';
        return;
      }
      const gust =
        row.gust === null || row.gust === undefined
          ? ''
          : `, rafales ${Math.round(row.gust)} nd`;
      box.innerHTML = `<b>${Math.round(speed)} nd</b> du ${bearingText(row.twd ?? 0)}${gust} <small>(${escapeHtml(weather?.src || 'prévision')})</small>`;
    })
    .catch(() => {
      const box = document.querySelector('#lpWind');
      if (box) box.textContent = 'indisponible';
    });
}
