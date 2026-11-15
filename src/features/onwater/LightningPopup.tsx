import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '../../components/shared/Button.tsx';
import { screenLanguage } from '../../i18n/langState.ts';
import { translateMessage } from '../../i18n/translate.ts';
import { go } from '../../shell/router.ts';
import { leaflet } from '../map/leaflet.ts';
import { tracker } from '../map/trackerState.ts';

import { nmToKm } from './lightning.ts';
import type { LightningPop } from './lightningPop.ts';
import { lightningPop } from './lightningPop.ts';

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
/** The screen flashes three times, as lightning. */
const FLASHES = 3;
const FLASH_MS = 160;
const DARK_MS = 260;

function translate(text: string): string {
  return translateMessage(text, screenLanguage.value);
}

/**
 * The map around the place of the alert: the storm and the boat in sight.
 * @param pop - The alert.
 */
function showOnMap(pop: LightningPop): void {
  go('tracker');
  const fit = (left: number) => {
    const map = tracker.current?.map;
    if (!map) {
      if (left > 0) setTimeout(() => fit(left - 1), 300);
      return;
    }
    const L = leaflet();
    map.fitBounds(
      L.latLng(pop.place.lat, pop.place.lon).toBounds(
        2 * nmToKm(pop.radiusNm) * 1000 * 1.2,
      ),
    );
  };
  setTimeout(() => fit(10), 100);
}

/**
 * The lightning alert: the screen flashes three times, then a big bubble
 * says how far the storm is, where, whether it comes nearer; it stays until
 * touched. « Voir sur la carte » shows the flashes around the boat.
 * @returns The portal, or nothing.
 */
export function LightningPopup() {
  useSignals();
  const pop = lightningPop.value;
  const [lit, setLit] = useState(false);
  useEffect(() => {
    if (!pop) return undefined;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    for (let index = 0; index < FLASHES; index++) {
      const start = index * (FLASH_MS + DARK_MS);
      timers.push(
        setTimeout(() => setLit(true), start),
        setTimeout(() => setLit(false), start + FLASH_MS),
      );
    }
    return () => {
      for (const timer of timers) clearTimeout(timer);
      setLit(false);
    };
  }, [pop]);
  if (!pop) return null;
  const { report, test, radiusNm } = pop;
  const nm = Math.max(1, Math.round((report.nearestKm ?? 0) / 1.852));
  const point =
    report.bearing == null ? '' : POINTS[Math.round(report.bearing / 45) % 8];
  const hour = new Date(report.at).toISOString().slice(11, 16);
  return createPortal(
    <>
      <div
        className={lit ? 'lightning-flash on' : 'lightning-flash'}
        aria-hidden="true"
      />
      <div
        id="lightningPop"
        className="wind-pop lightning-pop no-print"
        role="alertdialog"
        onClick={(event) => {
          event.stopPropagation();
          lightningPop.value = null;
          const target = event.target instanceof Element ? event.target : null;
          if (target?.closest('.lp-map')) showOnMap(pop);
        }}
      >
        <div className="wp-box">
          {test ? <div className="lp-test">{translate('TEST')}</div> : null}
          <div className="wp-big">⚡ {translate(`ORAGE à ${nm} NM`)}</div>
          {point ? (
            <div className="wp-name">{translate(`direction ${point}`)}</div>
          ) : null}
          <div className="wp-other">
            {translate(
              [
                report.strong ? 'orage actif' : 'éclairs isolés',
                report.nearer ? 'SE RAPPROCHE' : '',
              ]
                .filter(Boolean)
                .join(' · '),
            )}
          </div>
          <div className="wp-sea">
            {translate(`dans le rayon de ${radiusNm} NM autour de vous`)}
          </div>
          <div className="wp-note">
            {translate(
              `Satellite EUMETSAT MTG, image de ${hour} UTC (environ 10 min de retard). Aide indicative, pas une alerte officielle.`,
            )}
          </div>
          <Button className="btn primary lp-map" noUiEdit>
            {translate('🗺 Voir sur la carte')}
          </Button>
          <div className="wp-close">{translate('Toucher pour fermer')}</div>
        </div>
      </div>
    </>,
    document.body,
  );
}
