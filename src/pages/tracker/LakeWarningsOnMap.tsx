import { useSignals } from '@preact/signals-react/runtime';
import type { LayerGroup } from 'leaflet';
import { useEffect } from 'react';

import { leaflet } from '../../features/map/leaflet.ts';
import { tracker } from '../../features/map/trackerState.ts';
import { lakeWarnState } from '../../features/onwater/lakeWarnWatch.ts';
import {
  lakeSpot,
  lakeWarningText,
  lightOf,
  litWarnings,
} from '../../features/onwater/lakeWarnings.ts';

/** The map of NavIn is looked for this often until it is built. */
const WAIT_MS = 500;

function escapeText(text: string): string {
  return text.replaceAll(/[&<>"']/gu, (char) => `&#${char.codePointAt(0)};`);
}

/**
 * The warning lights of MeteoSwiss on the NavIn map: a lamp in the middle of
 * each lake whose warning is in force, flashing as those on the shore (40 a
 * minute for strong wind, 90 for a storm). A touch says the warning.
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
      const L = leaflet();
      layer = L.layerGroup().addTo(map);
      for (const warning of litWarnings(warnings, Date.now())) {
        const spot = lakeSpot(warning.name);
        if (!spot) continue;
        const { perMinute } = lightOf(warning.level);
        L.marker([spot.lat, spot.lon], {
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
            `<b>🚨 ${escapeText(lakeWarningText(warning))}</b><br>${escapeText(warning.text)}<br><small>Avis de MétéoSuisse</small>`,
            { maxWidth: 280 },
          )
          .addTo(layer);
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
