import type { Control, Map as LeafletMap } from 'leaflet';

import { buzz } from '../../lib/dom.ts';
import { herePos, toast } from '../../state/index.ts';

import { backToGps } from './gpsZone.ts';
import { leaflet } from './leaflet.ts';
import { locateAction, toggleOrientation } from './mapOrientation.ts';
import { setFollow, tracker } from './trackerState.ts';

const LOCATE_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M21 3 3 10.5l7.5 3 3 7.5z" fill="currentColor"/></svg>';

/**
 * The « my position » arrow of a map (legacy `addFullscreenControl`, whose
 * full-screen button is gone: the map already fills the screen).
 * @param map - Leaflet map.
 */
export function addFullscreenControl(map: LeafletMap): void {
  addButton(
    map,
    'leaflet-bar map-full-btn map-locate-btn',
    'Recentrer sur ma position',
    LOCATE_ICON,
    (button) => locate(map, button),
  );
}

function addButton(
  map: LeafletMap,
  className: string,
  title: string,
  icon: string,
  onClick: (button: HTMLAnchorElement) => void,
): void {
  const L = leaflet();
  const control = new L.Control({ position: 'topleft' }) as Control;
  control.onAdd = () => {
    const button = L.DomUtil.create('a', className);
    button.href = '#';
    button.setAttribute('role', 'button');
    button.title = title;
    button.innerHTML = icon;
    L.DomEvent.on(button, 'click', (event) => {
      L.DomEvent.stop(event);
      onClick(button);
    });
    L.DomEvent.disableClickPropagation(button);
    return button;
  };
  map.addControl(control);
}

function locate(map: LeafletMap, button: HTMLAnchorElement): void {
  buzz();
  // A second tap, with the boat in the middle, changes the orientation.
  const handle = tracker.current?.map === map ? tracker.current : null;
  const boat = handle?.me?.getLatLng();
  if (handle && locateAction(handle.follow, Boolean(boat)) === 'orient') {
    toggleOrientation(map);
    return;
  }
  // The arrow leaves the place chosen with NavIn: back on the GPS.
  backToGps();
  const center = (lat: number, lon: number) => {
    map.setView([lat, lon], Math.max(map.getZoom(), 14));
  };
  if (tracker.current?.map === map) setFollow(true);
  const known = herePos() ?? (boat ? { lat: boat.lat, lon: boat.lng } : null);
  if (known) center(known.lat, known.lon);
  if (!navigator.geolocation) {
    if (!known) toast('GPS indisponible');
    return;
  }
  button.classList.add('busy');
  navigator.geolocation.getCurrentPosition(
    (position) => {
      button.classList.remove('busy');
      center(position.coords.latitude, position.coords.longitude);
    },
    () => {
      button.classList.remove('busy');
      if (!known) toast('Position GPS introuvable');
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15_000 },
  );
}
