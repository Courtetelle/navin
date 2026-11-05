import { useSignals } from '@preact/signals-react/runtime';
import { useEffect } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { dayKey, fmtTime } from '../../lib/format.ts';
import { windTxt } from '../../lib/wind.ts';
import { BFT_KN } from '../../model/lists.ts';
import { ensureDay, getDay, state } from '../../state/index.ts';

import type { WindAlertAction } from './windAlertClick.ts';
import { windAlertClick } from './windAlertClick.ts';
import type { WindConfig } from './windLogic.ts';
import { flashColor, seaTxt, windValue } from './windLogic.ts';
import { windTestRunning } from './windTest.ts';
import type { WindWatch } from './windTypes.ts';
import { windConfig, windMuted, windWatchLast } from './windWatch.ts';

/** Props of {@link WindAlert}. */
export interface WindAlertProps {
  /**
   * Hide the test button (settings).
   * @default false
   */
  noTest?: boolean;
  /**
   * Keep the explanations visible (outside `#view`).
   * @default false
   */
  keep?: boolean;
}

const FORCES = [4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Wind alert block: on / off, basis, mute until the end of the track, last
 * reading, colour legend and test (legacy `windAlertHtml`).
 * @param props - Context.
 * @returns The `.wind-alert` block.
 */
export function WindAlert({ noTest = false, keep = false }: WindAlertProps) {
  useSignals();
  const tr = useTr();
  const config = windConfig();
  const today = dayKey(new Date());
  useEffect(() => ensureDay(today), [today]);
  const stored = state.data.cruise.value
    ? (getDay(today).windWatch as WindWatch | undefined)
    : null;
  const watch = stored || windWatchLast.value;
  const muted = windMuted();
  const running = windTestRunning.value;
  const muteText = muted
    ? '🔕 Alertes coupées jusqu’à la fin de la trace · toucher pour les remettre'
    : '🔕 Pas d’alertes jusqu’à la fin de la trace en cours';
  return (
    <div className="wind-alert">
      <p className="keep-help nav-hint">
        {tr(
          'Les alertes de vent surveillent le vent dès que l’appli est allumée, quel que soit l’écran.',
        )}
      </p>
      <ButtonRow className="row c2">
        <Button
          className={config.on ? 'btn on' : 'btn'}
          data-walert="toggle"
          onClick={click('toggle')}
        >
          {tr(`🔔 Alertes de vent : ${config.on ? 'OUI' : 'NON'}`)}
        </Button>
        <Button className="btn" data-walert="basis" onClick={click('basis')}>
          {tr(
            `Seuils sur : ${config.basis === 'gust' ? 'rafales' : 'vent moyen'}`,
          )}
        </Button>
      </ButtonRow>
      {config.on ? (
        <ButtonRow className="row">
          <Button
            className={muted ? 'btn on danger' : 'btn'}
            data-walert="mute"
            onClick={click('mute')}
          >
            {tr(muteText)}
          </Button>
        </ButtonRow>
      ) : null}
      {config.on && watch ? (
        <WatchLine watch={watch} config={config} keep={keep} />
      ) : null}
      {watch?.waveH == null ? null : (
        <p className="keep-help">
          {tr('🌊 État de la mer prévu ici : ')}
          <b>{seaTxt(watch)}</b>
          {tr(' (modèle Open-Meteo Marine)')}
        </p>
      )}
      <div className="wind-legend">
        {FORCES.map((force, index) => (
          <span key={force}>
            <i style={{ background: flashColor(index) }} />
            {force} Bf · {BFT_KN[force - 1]}
            {force < 12 ? `–${(BFT_KN[force] as number) - 1}` : '+'} nd
          </span>
        ))}
      </div>
      <HelpText keep={keep} nextIsRow={!noTest}>
        En Suisse : stations MeteoSwiss. Ailleurs : modèle de prévision le plus
        fin de la région, à la position du bateau. Deux bips et deux flashs de
        couleur avec le vent exact (nœuds et Beaufort) à chaque nouveau degré
        Beaufort dès 4 Bf (11 nd), de plus en plus aigus et forts. Rappel toutes
        les 15 min. Appli ouverte et écran allumé seulement.
      </HelpText>
      {noTest ? null : (
        <ButtonRow className="row">
          <Button
            className={running ? 'btn danger' : 'btn'}
            data-walert="test"
            onClick={click('test')}
          >
            {tr(running ? '⏹ Arrêter le test' : '▶ Test des alertes de vent')}
          </Button>
        </ButtonRow>
      )}
    </div>
  );
}

function click(action: WindAlertAction): () => void {
  return () => {
    buzz();
    windAlertClick(action);
  };
}

function WatchLine({
  watch,
  config,
  keep,
}: {
  watch: WindWatch;
  config: WindConfig;
  keep: boolean;
}) {
  const wind = windTxt(Math.round(windValue(watch.top, config.basis)));
  const time = fmtTime(new Date(watch.top.t));
  if (watch.src === 'model') {
    const names = watch.names ? watch.names.join(' et ') : watch.top.name;
    const strongest = watch.n > 1 ? ', le plus fort retenu' : '';
    const head = `Prévision à la position du bateau (${names}${strongest}) : `;
    const lowered = watch.bias
      ? ` Seuils abaissés de ${watch.bias} nd (${watch.region}) : les modèles sous-estiment les accélérations entre les îles.`
      : '';
    return (
      <HelpText keep={keep} text={`${head}${wind}, ${time}.${lowered}`}>
        {head}
        <b>{wind}</b>, {time}.{lowered}
      </HelpText>
    );
  }
  const head = `Le plus fort autour (${watch.n} station${watch.n > 1 ? 's' : ''} MeteoSwiss à moins de ${config.radius} km) : `;
  return (
    <HelpText keep={keep} text={`${head}${wind} à ${watch.top.name}, ${time}.`}>
      {head}
      <b>{wind}</b> à {watch.top.name}, {time}.
    </HelpText>
  );
}
