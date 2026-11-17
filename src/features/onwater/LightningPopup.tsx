import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '../../components/shared/Button.tsx';
import { screenLanguage } from '../../i18n/langState.ts';
import { translateMessage } from '../../i18n/translate.ts';
import { go } from '../../shell/router.ts';
import { askMapArea } from '../map/pendingArea.ts';

import { lakeWarnPop } from './lakeWarnPop.ts';
import { nmOf, nmToKm, pointAt, stormView } from './lightning.ts';
import type { LightningPop } from './lightningPop.ts';
import { lightningPop } from './lightningPop.ts';
import { windPopup } from './windOverlayState.ts';

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
  const { place, report, radiusNm } = pop;
  // The nearest flashes and the boat (or the zone) in view; LiveMétéo and
  // its circle leave the map (see LiveOnMap).
  askMapArea(
    report.nearestKm != null && report.bearing != null
      ? stormView(
          place,
          pointAt(place.lat, place.lon, report.bearing, report.nearestKm),
        )
      : { ...place, km: nmToKm(radiusNm) * 1.2 },
  );
  go('tracker');
}

/**
 * The lightning alert: the screen flashes three times, then a big bubble
 * says how far the storm is, where, whether it comes nearer; it stays until
 * touched. « Voir sur la carte » shows the flashes around the boat.
 * @returns The portal, or nothing.
 */
export function LightningPopup() {
  useSignals();
  // One bubble at a time: this one waits until the wind one is closed.
  const pop = windPopup.value ? null : lightningPop.value;
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
  const { report, test, radiusNm, reason, clear, lines } = pop;
  const nm = nmOf(report.nearestKm ?? 0);
  const hour = new Date(report.at).toISOString().slice(11, 16);
  const motion = clear ? [] : (lines ?? []);
  const title = clear
    ? 'FIN DE L’ALERTE FOUDRE'
    : `${reason === 'half' ? '2e ALERTE · ' : ''}ORAGE à ${nm} NM`;
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
          <div className="wp-big">⚡ {translate(title)}</div>
          {clear ? (
            <div className="wp-sea">
              {translate(
                `Plus d’éclairs à moins de ${radiusNm} NM depuis 30 min.`,
              )}
            </div>
          ) : (
            <>
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
                {translate(
                  reason === 'half'
                    ? `sous la moitié de votre distance d’alerte (${radiusNm / 2} NM)`
                    : `dans le rayon de ${radiusNm} NM autour de vous`,
                )}
              </div>
              {motion.length > 0 ? (
                <div className="lp-motion" data-lightning="motion">
                  {motion.map((line) => (
                    <div key={line}>{translate(line)}</div>
                  ))}
                </div>
              ) : null}
            </>
          )}
          <div className="wp-note">
            {translate(
              `Satellite EUMETSAT MTG, image de ${hour} UTC (environ 10 min de retard). Aide indicative, pas une alerte officielle.`,
            )}
          </div>
          <Button className="btn primary lp-map" noUiEdit>
            {translate('🗺 Voir sur la carte')}
          </Button>
          {lakeWarnPop.value ? (
            <div className="wp-next">
              {translate('▼ Une autre alerte suit : toucher pour la lire')}
            </div>
          ) : null}
          <div className="wp-close">{translate('Toucher pour fermer')}</div>
        </div>
      </div>
    </>,
    document.body,
  );
}
