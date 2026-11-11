import type {
  LatLng,
  LeafletMouseEvent,
  Map as LeafletMap,
  Marker,
} from 'leaflet';

import { buzz } from '../../lib/dom.ts';
import { fmtPos } from '../../lib/geo.ts';
import { addMark, toast } from '../../state/index.ts';

import { escapeHtml } from './escapeHtml.ts';
import { wxNext } from './external.ts';
import { setGoto } from './goto.ts';
import { depthAt } from './isobath.ts';
import { leaflet } from './leaflet.ts';
import { marksRedraw } from './marksDraw.ts';
import { bearingText, relativeHtml } from './relativeText.ts';
import { rulerToPoint } from './rulerTool.ts';
import { shoreNoteAt } from './shoreBands.ts';
import { setFollow, tracker } from './trackerState.ts';
import { areaNotesAt } from './vectorLayers.ts';

/** A point of the map, as the menus speak of it. */
interface Spot {
  lat: number;
  lon: number;
}

/** The four branches of the cross, clockwise from the top. */
export const CROSS_BRANCHES = ['mark', 'weather', 'goto', 'info'] as const;
/** A branch of the cross. */
export type CrossBranch = (typeof CROSS_BRANCHES)[number];

const PIN_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 2.5 21.5 9.5 19.6 10.6 16.4 13.8 16.8 18.2 15.2 19.8 11 15.6 4.8 21.8 2.2 21.8 2.2 19.2 8.4 13 4.2 8.8 5.8 7.2 10.2 7.6 13.4 4.4z" fill="#e10600" stroke="#7a0000" stroke-width="1.1" stroke-linejoin="round"/></svg>';
const WEATHER_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="4.2" fill="#f5a623"/><g stroke="#f5a623" stroke-width="1.6" stroke-linecap="round"><path d="M9 1.5v2M3.7 3.7l1.4 1.4M1.5 9h2M14.3 3.7l-1.4 1.4"/></g><path d="M7.5 19.5a4 4 0 0 1 1.2-7.8 5.2 5.2 0 0 1 9.8 1.6 3.2 3.2 0 0 1 .3 6.2z" fill="#fff" stroke="#5f6f86" stroke-width="1.4" stroke-linejoin="round"/></svg>';
/** Go To: a target, and the arrow of the dividers going into it. */
const GOTO_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="15" cy="9" r="6.5" fill="none" stroke="#0b3d91" stroke-width="1.8"/><circle cx="15" cy="9" r="2.4" fill="#0b3d91"/><path d="M2.5 21.5 12 12" stroke="#e6007e" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="3 2.4"/><path d="M13.2 10.8 7.4 12.4 11.6 16.6z" fill="#e6007e"/></svg>';
const INFO_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#1677ff"/><circle cx="12" cy="7.2" r="1.6" fill="#fff"/><path d="M12 10.6v7" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>';

const LOGOS: Record<CrossBranch, { svg: string; label: string }> = {
  mark: { svg: PIN_SVG, label: 'Marque' },
  weather: { svg: WEATHER_SVG, label: 'Météo' },
  goto: { svg: GOTO_SVG, label: 'Go To' },
  info: { svg: INFO_SVG, label: 'Infos du point' },
};

/** A tap this soon after a long press is the end of the long press. */
const AFTER_LONG_MS = 800;
let longAt = 0;

/** A long press was just made: the click that ends it opens nothing. */
export function longPressDone(): void {
  longAt = Date.now();
}

/**
 * A short tap on the map lays a cross on the point: four lines of 2 cm, not
 * meeting in the middle, a logo at the end of each (mark, weather, Go To,
 * information). A logo opens its menu; a tap beside takes the cross away.
 * The cross always stands in the middle of the map: the point touched comes
 * under it, and a finger sliding the map moves the map behind it, to aim.
 * @param map - Leaflet map.
 */
export function crossAttach(map: LeafletMap): void {
  let cross: Marker | null = null;
  const remove = () => {
    cross?.remove();
    cross = null;
  };
  map.on('click', (event: LeafletMouseEvent) => {
    if (Date.now() - longAt < AFTER_LONG_MS) return;
    if (cross) {
      remove();
      return;
    }
    // A menu open: the tap beside closes it, nothing more.
    if (map.getContainer().querySelector('.leaflet-popup')) {
      map.closePopup();
      return;
    }
    // The cross stands in the middle of the map: the point touched slides
    // under it, and the map stops following the boat.
    if (tracker.current?.map === map) setFollow(false);
    cross = layCross(map, map.getCenter(), (branch, at) => {
      remove();
      openBranch(map, branch, at);
    });
    map.panTo(event.latlng);
  });
  // The map slides under the cross: the cross keeps its place on screen.
  // Whatever moves the map (finger, zoom, glide), the cross stays in its
  // middle: the map slides behind it.
  map.on('move zoom', () => {
    cross?.setLatLng(map.getCenter());
  });
  map.on('unload', remove);
}

function layCross(
  map: LeafletMap,
  at: LatLng,
  onPick: (branch: CrossBranch, at: LatLng) => void,
): Marker {
  const L = leaflet();
  const arms = CROSS_BRANCHES.map(
    (branch) =>
      `<div class="tap-arm tap-arm-${branch}"></div><button type="button" class="tap-logo tap-logo-${branch}" data-cross="${branch}" aria-label="${LOGOS[branch].label}">${LOGOS[branch].svg}</button>`,
  ).join('');
  const marker = L.marker(at, {
    icon: L.divIcon({
      className: 'tap-cross',
      html: `<div class="tap-cross-box">${arms}</div>`,
      iconSize: [0, 0],
    }),
    keyboard: false,
    zIndexOffset: 1800,
    bubblingMouseEvents: false,
  }).addTo(map);
  const element = marker.getElement();
  if (element) {
    L.DomEvent.disableClickPropagation(element);
    element.addEventListener('click', (event) => {
      const logo = (event.target as Element).closest<HTMLElement>(
        '[data-cross]',
      );
      if (!logo) return;
      event.stopPropagation();
      buzz();
      onPick(logo.dataset.cross as CrossBranch, marker.getLatLng());
    });
  }
  buzz();
  return marker;
}

/**
 * The text sent for a point: its position and a link to see it on a map.
 * @param point - The point.
 * @returns The text of the message.
 */
export function positionMessage(point: Spot): string {
  const lat = point.lat.toFixed(5);
  const lon = point.lon.toFixed(5);
  return `Position : ${fmtPos(point)}\nhttps://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`;
}

async function sendPosition(point: Spot): Promise<void> {
  const text = positionMessage(point);
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return;
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
    }
  }
  globalThis.location.href = `sms:?&body=${encodeURIComponent(text)}`;
}

function openBranch(map: LeafletMap, branch: CrossBranch, at: LatLng): void {
  const point = { lat: at.lat, lon: at.lng };
  const depth = depthAt(at.lat, at.lng);
  const position = `<div class="lp-pos">📍 <b>${escapeHtml(fmtPos(point))}</b></div>`;
  const send =
    '<button class="btn" data-lp="send">✉️ Envoyer la position</button>';
  let body = '';
  if (branch === 'mark') {
    body = `<div class="lp-btns"><button class="btn primary" data-lp="mark">📌 Enregistrer une marque</button>${send}</div>`;
  } else if (branch === 'weather') {
    body = `<div class="lp-wx" id="lpWx">${navigator.onLine ? 'Prévision : recherche…' : 'Prévision : hors réseau'}</div><div class="lp-btns">${send}</div>`;
  } else if (branch === 'goto') {
    body = `<div>🧭 Depuis le bateau : <span>${relativeHtml(point)}</span></div><div class="lp-btns"><button class="btn primary" data-lp="goto">🎯 Go to ce point</button>${send}</div>`;
    rulerToPoint(map, at);
  } else {
    const depthText = depth
      ? `<b>${escapeHtml(depth)}</b>`
      : '<span class="muted">pas de courbe ici</span>';
    const shore = shoreNoteAt(map, at.lat, at.lng);
    const notes = [
      ...(shore ? [shore] : []),
      ...areaNotesAt(at.lat, at.lng),
    ].map((note) => `<div class="lp-shore">${note}</div>`);
    body = `<div>🌊 Profondeur : ${depthText}</div><div>🧭 Depuis le bateau : <span>${relativeHtml(point)}</span></div>${notes.join('')}<div class="lp-btns">${send}</div>`;
  }
  const popup = leaflet()
    .popup({
      maxWidth: 320,
      closeOnClick: false,
      autoPan: true,
      className: 'lp-pop',
    })
    .setLatLng(at)
    .setContent(`<div class="lp-menu">${position}${body}</div>`)
    .openOn(map);
  popup.getElement()?.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLElement>('[data-lp]');
    if (!button) return;
    buzz();
    const action = button.dataset.lp;
    if (action === 'send') void sendPosition(point);
    if (action === 'goto') {
      setGoto({ lat: point.lat, lon: point.lon, name: fmtPos(point) });
      map.closePopup(popup);
    }
    if (action === 'mark') {
      const mark = addMark(point.lat, point.lon, depth);
      marksRedraw();
      toast(`📌 Marque ${mark.name} enregistrée`);
      map.closePopup(popup);
    }
  });
  if (branch === 'weather' && navigator.onLine) showForecast(point);
}

const box = () => document.querySelector('#lpWx');

function showForecast(point: Spot): void {
  wxNext(point.lat, point.lon, 4)
    .then((forecast) => {
      const shown = box();
      if (!shown) return;
      const rows = (forecast?.rows ?? []).filter(
        (row) => row.tws !== null && row.tws !== undefined,
      );
      if (rows.length === 0) {
        shown.textContent = 'Prévision : indisponible';
        return;
      }
      const lines = rows.slice(0, 4).map((row) => {
        const hour = new Date(row.t).toLocaleTimeString('fr-CH', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const gust =
          row.gust === null || row.gust === undefined
            ? ''
            : `, rafales ${Math.round(row.gust)} nd`;
        return `<div>${hour} · <b>${Math.round(row.tws ?? 0)} nd</b> du ${bearingText(row.twd ?? 0)}${gust}</div>`;
      });
      shown.innerHTML = `💨 ${lines.join('')}<small>${escapeHtml(forecast?.src || 'prévision')}</small>`;
    })
    .catch(() => {
      const shown = box();
      if (shown) shown.textContent = 'Prévision : indisponible';
    });
}
