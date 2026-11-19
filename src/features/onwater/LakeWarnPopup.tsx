import { useSignals } from '@preact/signals-react/runtime';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '../../components/shared/Button.tsx';
import { screenLanguage } from '../../i18n/langState.ts';
import { translateMessage } from '../../i18n/translate.ts';
import { go } from '../../shell/router.ts';
import { state } from '../../state/index.ts';
import { openListPublish } from '../publish/index.ts';

import { BubbleActions } from './BubbleActions.tsx';
import { lakeWarnPop } from './lakeWarnPop.ts';
import { lightOf, whenText } from './lakeWarnings.ts';
import { lightningPop } from './lightningPop.ts';
import { leaveBubble, windPopup } from './windOverlayState.ts';

function translate(text: string): string {
  return translateMessage(text, screenLanguage.value);
}

const time = (t: number) => whenText(t, Date.now());

/**
 * The warning lights of a lake switched on: a big bubble with a lamp that
 * flashes as those on the shore (40 a minute for strong wind, 90 for a
 * storm), the lake, until when, and what MeteoSwiss says; 👁 the screen of
 * the warning lights, 🗺 the map, 📤 Partager.
 * @returns The portal, or nothing.
 */
export function LakeWarnPopup() {
  useSignals();
  // One bubble at a time: this one waits until the wind and lightning ones
  // are closed.
  // In a sea zone (Atlantique, Méditerranée) no warning of the lakes.
  const atSea = state.view.zoneSimV.value === 'mer';
  const pop =
    windPopup.value || lightningPop.value || atSea ? null : lakeWarnPop.value;
  if (!pop) return null;
  const { warnings, test, alertId } = pop;
  const strongest = warnings[0];
  if (!strongest) return null;
  const light = lightOf(strongest.level);
  const style = {
    '--blink': `${60 / light.perMinute}s`,
  } as CSSProperties;
  return createPortal(
    <div
      id="lakeWarnPop"
      className={`wind-pop lake-warn-pop no-print${light.perMinute >= 90 ? ' lake-storm' : ''}`}
      role="alertdialog"
      style={style}
      onClick={(event) => {
        event.stopPropagation();
        lakeWarnPop.value = null;
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('.lw-map')) go('tracker');
      }}
    >
      {light.perMinute >= 90 ? (
        <div className="lw-screen-flash" aria-hidden="true" />
      ) : null}
      <div className="wp-box">
        {test ? <div className="lp-test">{translate('TEST')}</div> : null}
        <div className="lw-lamp" aria-hidden="true" />
        {warnings.map((warning) => {
          const { words, perMinute } = lightOf(warning.level);
          return (
            <div key={warning.name} className="lw-lake">
              <div className="wp-big">
                {translate(`${warning.name} · ${words}`)}
              </div>
              <div className="wp-name">
                {translate(`feux ${perMinute} éclats/min`)}
              </div>
              <div className="wp-other">
                {translate(
                  `de ${time(warning.onset)} à ${time(warning.expires)}`,
                )}
              </div>
              {warning.text ? (
                <div className="wp-desc">{translate(warning.text)}</div>
              ) : null}
            </div>
          );
        })}
        <BubbleActions
          detailLabel="Voir les feux d’avis des lacs"
          onDetail={() => {
            lakeWarnPop.value = null;
            leaveBubble(
              () => {
                lakeWarnPop.value = pop;
              },
              'weather',
              'lakelights',
            );
          }}
          onShare={
            alertId
              ? (format) => {
                  lakeWarnPop.value = null;
                  openListPublish('alerts', alertId, format);
                }
              : undefined
          }
          translate={translate}
        >
          <Button
            className="btn primary lw-map"
            noUiEdit
            aria-label={translate('Voir sur la carte')}
            title={translate('Voir sur la carte')}
          >
            🗺
          </Button>
        </BubbleActions>
        <div className="wp-close">{translate('Toucher pour fermer')}</div>
      </div>
    </div>,
    document.body,
  );
}
