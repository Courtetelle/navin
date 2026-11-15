import { useSignals } from '@preact/signals-react/runtime';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '../../components/shared/Button.tsx';
import { screenLanguage } from '../../i18n/langState.ts';
import { translateMessage } from '../../i18n/translate.ts';
import { go } from '../../shell/router.ts';

import { lakeWarnPop } from './lakeWarnPop.ts';
import { LIGHT_MEANINGS, lightOf, whenText } from './lakeWarnings.ts';
import { lightningPop } from './lightningPop.ts';
import { windPopup } from './windOverlayState.ts';

function translate(text: string): string {
  return translateMessage(text, screenLanguage.value);
}

const time = (t: number) => whenText(t, Date.now());

/**
 * The warning lights of a lake switched on: a big bubble with a lamp that
 * flashes as those on the shore (40 a minute for strong wind, 90 for a
 * storm), the lake, until when, and what MeteoSwiss says.
 * @returns The portal, or nothing.
 */
export function LakeWarnPopup() {
  useSignals();
  // One bubble at a time: this one waits until the wind and lightning ones
  // are closed.
  const pop = windPopup.value || lightningPop.value ? null : lakeWarnPop.value;
  if (!pop) return null;
  const { warnings, test } = pop;
  const strongest = warnings[0];
  if (!strongest) return null;
  const light = lightOf(strongest.level);
  const style = {
    '--blink': `${60 / light.perMinute}s`,
  } as CSSProperties;
  return createPortal(
    <div
      id="lakeWarnPop"
      className="wind-pop lake-warn-pop no-print"
      role="alertdialog"
      style={style}
      onClick={(event) => {
        event.stopPropagation();
        lakeWarnPop.value = null;
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('.lw-map')) go('tracker');
      }}
    >
      <div className="wp-box">
        {test ? <div className="lp-test">{translate('TEST')}</div> : null}
        <div className="lw-lamp" aria-hidden="true" />
        <div className="wp-big">
          {translate(`FEUX D’AVIS · ${light.words}`)}
        </div>
        {warnings.map((warning) => {
          const { words, perMinute } = lightOf(warning.level);
          return (
            <div key={warning.name} className="lw-lake">
              <div className="wp-name">
                {translate(`${warning.name} : ${words.toLowerCase()}`)}
              </div>
              <div className="wp-other">
                {translate(
                  `feux ${perMinute} éclats/min · de ${time(warning.onset)} à ${time(warning.expires)}`,
                )}
              </div>
              {warning.text ? (
                <div className="wp-desc">{translate(warning.text)}</div>
              ) : null}
            </div>
          );
        })}
        <div className="wp-sea">
          {translate(
            strongest.level >= 3
              ? 'Rejoindre un abri sans attendre.'
              : 'Prudence : préparer le retour à la rive.',
          )}
        </div>
        <div className="lw-meanings">
          <div className="lw-meanings-title">
            {translate('Le sens des feux sur les rives')}
          </div>
          {LIGHT_MEANINGS.map((meaning) => (
            <div
              key={meaning.level}
              className={
                meaning.level === strongest.level
                  ? 'lw-meaning now'
                  : 'lw-meaning'
              }
            >
              <b>
                {translate(
                  `${meaning.perMinute} éclats/min · ${meaning.title}`,
                )}
              </b>{' '}
              {translate(`: ${meaning.text}`)}
            </div>
          ))}
          <div className="lw-meaning">
            {translate(
              'Les feux s’allument dès que MétéoSuisse émet l’avis, avant l’arrivée des rafales. Feux éteints : pas d’avis en cours, ce qui ne garantit pas un vent faible.',
            )}
          </div>
        </div>
        <div className="wp-note">
          {translate(
            'Avis de MétéoSuisse pour les lacs, ceux qui allument les feux sur les rives.',
          )}
        </div>
        <Button className="btn primary lw-map" noUiEdit>
          {translate('🗺 Voir sur la carte')}
        </Button>
        <div className="wp-close">{translate('Toucher pour fermer')}</div>
      </div>
    </div>,
    document.body,
  );
}
