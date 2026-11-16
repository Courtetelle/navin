import { useSignals } from '@preact/signals-react/runtime';
import type { LayerGroup } from 'leaflet';
import { useEffect } from 'react';

import { leaflet } from '../../features/map/leaflet.ts';
import { tracker } from '../../features/map/trackerState.ts';
import { lakeWarnState } from '../../features/onwater/lakeWarnWatch.ts';
import type { LakeWarning } from '../../features/onwater/lakeWarnings.ts';
import {
  lakeSpot,
  lakeWarningText,
  lightOf,
  litWarnings,
} from '../../features/onwater/lakeWarnings.ts';
import { buzz } from '../../lib/dom.ts';
import { lightBand } from '../../shell/lightBand.ts';
import { go } from '../../shell/router.ts';

/** The map of NavIn is looked for this often until it is built. */
const WAIT_MS = 500;
/** A press this long on a light opens the list of the lights. */
const LONG_MS = 600;

function escapeText(text: string): string {
  return text.replaceAll(/[&<>"']/gu, (char) => `&#${char.codePointAt(0)};`);
}

/**
 * One warning light on the map: flashing at its rhythm; a touch says the
 * warning in its bubble, a long press opens the list of the lights with its
 * band blinking three times (as a mark in its list).
 * @param layer - The layer of the lights.
 * @param warning - The warning in force.
 * @param spot - Where its lamp stands.
 */
function addLight(
  layer: LayerGroup,
  warning: LakeWarning,
  spot: { lat: number; lon: number },
): void {
  const L = leaflet();
  const { perMinute } = lightOf(warning.level);
  let long = false;
  let pressing: ReturnType<typeof setTimeout> | undefined;
  const marker = L.marker([spot.lat, spot.lon], {
    icon: L.divIcon({
      className: 'lake-light-wrap',
      html: `<div class="lake-light" style="--blink:${60 / perMinute}s"></div>`,
      iconSize: [0, 0],
    }),
    keyboard: false,
    title: warning.name,
    zIndexOffset: 900,
  })
    .bindPopup(
      `<b>🚨 ${escapeText(lakeWarningText(warning))}</b><br>${escapeText(warning.text)}<br><small>Avis de MétéoSuisse · appui long : la liste des feux</small>`,
      { maxWidth: 280 },
    )
    .on('popupopen', () => {
      // A long press goes to the list: no bubble then.
      if (long) marker.closePopup();
    })
    .addTo(layer);
  const element = marker.getElement();
  element?.addEventListener('pointerdown', () => {
    long = false;
    clearTimeout(pressing);
    pressing = setTimeout(() => {
      long = true;
      buzz();
      marker.closePopup();
      go('weather', 'lakelights');
      lightBand(`lake:${warning.name}`, true);
    }, LONG_MS);
  });
  const release = () => clearTimeout(pressing);
  for (const name of ['pointerup', 'pointercancel', 'pointerleave']) {
    element?.addEventListener(name, release);
  }
}

/**
 * The warning lights of MeteoSwiss on the NavIn map: a lamp in the middle of
 * each lake whose warning is in force, flashing as those on the shore (40 a
 * minute for strong wind, 90 for a storm). A touch says the warning; a
 * long press opens the list of the lights, its band blinking.
 * @returns Nothing: it draws on the map.
 */
export function LakeWarningsOnMap() {
  useSignals();
  const { warnings, at } = lakeWarnState.value;
  useEffect(() => {
    let layer: LayerGroup | null = null;
    let wait: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    const draw = () => {
      if (closed) return;
      const map = tracker.current?.map;
      if (!map) {
        wait = setTimeout(draw, WAIT_MS);
        return;
      }
      layer = leaflet().layerGroup().addTo(map);
      for (const warning of litWarnings(warnings, Date.now())) {
        const spot = lakeSpot(warning.name);
        if (!spot) continue;
        addLight(layer, warning, spot);
      }
    };
    draw();
    return () => {
      closed = true;
      clearTimeout(wait);
      layer?.remove();
    };
  }, [warnings, at]);
  return null;
}
