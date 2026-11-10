import { useSignals } from '@preact/signals-react/runtime';
import { useEffect } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { buzz } from '../../lib/dom.ts';
import { dayKey, fmtTime } from '../../lib/format.ts';
import { windTxt } from '../../lib/wind.ts';
import { BFT_KN } from '../../model/lists.ts';
import { ensureDay, getDay, state } from '../../state/index.ts';

import { BoxHelp } from './BoxHelp.tsx';
import { MfKeyRow } from './MfKeyRow.tsx';
import { useBoxTr } from './useBoxTr.ts';
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
  const tr = useBoxTr(keep);
  const config = windConfig();
  const today = dayKey(new Date());
  useEffect(() => ensureDay(today), [today]);
  const stored = state.data.cruise.value
    ? (getDay(today).windWatch as WindWatch | undefined)
    : null;
  const watch = stored || windWatchLast.value;
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
      {config.on ? <MuteRow keep={keep} /> : null}
      {config.on && watch ? (
        <WatchLine watch={watch} config={config} keep={keep} />
      ) : null}
      {watch?.waveH == null ? null : (
        <p className="keep-help">
          {tr('🌊 État de la mer prévu ici : ')}
          <b>{tr(seaTxt(watch))}</b>
          {tr(' (modèle Open-Meteo Marine)')}
        </p>
      )}
      <WindLegend keep={keep} />
      <BoxHelp keep={keep} nextIsRow={!noTest}>
        Vent mesuré d’abord : stations MeteoSwiss en Suisse, ailleurs balises
        OpenWindMap et stations Météo-France (avec une clé). Sans station à
        moins de 30 km, modèle de prévision le plus fin de la région à la
        position du bateau, signalé « PRÉVISION » dans l’alerte. Deux bips et
        deux flashs de couleur avec le vent exact (nœuds et Beaufort) à chaque
        nouveau degré Beaufort dès 4 Bf (11 nd), de plus en plus aigus et forts.
        Rappel toutes les 15 min. Appli ouverte et écran allumé seulement.
      </BoxHelp>
      {noTest ? <MfKeyRow /> : <TestRow keep={keep} />}
    </div>
  );
}

function MuteRow({ keep }: { keep: boolean }) {
  useSignals();
  const tr = useBoxTr(keep);
  const muted = windMuted();
  return (
    <ButtonRow className="row">
      <Button
        className={muted ? 'btn on danger' : 'btn'}
        data-walert="mute"
        onClick={click('mute')}
      >
        {tr(
          muted
            ? '🔕 Alertes coupées jusqu’à la fin de la trace · toucher pour les remettre'
            : '🔕 Pas d’alertes jusqu’à la fin de la trace en cours',
        )}
      </Button>
    </ButtonRow>
  );
}

function WindLegend({ keep }: { keep: boolean }) {
  const tr = useBoxTr(keep);
  return (
    <div className="wind-legend">
      {FORCES.map((force, index) => (
        <span key={force}>
          <i style={{ background: flashColor(index) }} />
          {tr(legendText(force))}
        </span>
      ))}
    </div>
  );
}

function TestRow({ keep }: { keep: boolean }) {
  useSignals();
  const tr = useBoxTr(keep);
  const running = windTestRunning.value;
  return (
    <ButtonRow className="row">
      <Button
        className={running ? 'btn danger' : 'btn'}
        data-walert="test"
        onClick={click('test')}
      >
        {tr(running ? '⏹ Arrêter le test' : '▶ Test des alertes de vent')}
      </Button>
    </ButtonRow>
  );
}

function legendText(force: number): string {
  const top = force < 12 ? `–${(BFT_KN[force] as number) - 1}` : '+';
  return `${force} Bf · ${BFT_KN[force - 1]}${top} nd`;
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
  const tr = useBoxTr(keep);
  const wind = windTxt(Math.round(windValue(watch.top, config.basis)));
  const time = fmtTime(new Date(watch.top.t));
  if (watch.src === 'stations') {
    const nets = (watch.nets ?? []).join(' et ');
    const head = `Mesure, le plus fort autour (${watch.n} station${watch.n > 1 ? 's' : ''} ${nets} à moins de ${watch.radius ?? config.radius} km) : `;
    return (
      <BoxHelp
        keep={keep}
        text={`${head}${wind} à ${watch.top.name}, ${time}.`}
      >
        {tr(head, { help: true })}
        <b>{tr(wind, { help: true })}</b>
        {tr(` à ${watch.top.name}, ${time}.`, { help: true })}
      </BoxHelp>
    );
  }
  if (watch.src === 'model') {
    const names = watch.names ? watch.names.join(' et ') : watch.top.name;
    const strongest = watch.n > 1 ? ', le plus fort retenu' : '';
    const head = `PRÉVISION, pas une mesure : aucune station à moins de ${watch.radius ?? config.radius} km. Modèle à la position du bateau (${names}${strongest}) : `;
    const lowered = watch.bias
      ? ` Seuils abaissés de ${watch.bias} nd (${watch.region}) : les modèles sous-estiment les accélérations entre les îles.`
      : '';
    return (
      <BoxHelp keep={keep} text={`${head}${wind}, ${time}.${lowered}`}>
        {tr(head, { help: true })}
        <b>{tr(wind, { help: true })}</b>
        {tr(`, ${time}.${lowered}`, { help: true })}
      </BoxHelp>
    );
  }
  const head = `Le plus fort autour (${watch.n} station${watch.n > 1 ? 's' : ''} MeteoSwiss à moins de ${config.radius} km) : `;
  return (
    <BoxHelp keep={keep} text={`${head}${wind} à ${watch.top.name}, ${time}.`}>
      {tr(head, { help: true })}
      <b>{tr(wind, { help: true })}</b>
      {tr(` à ${watch.top.name}, ${time}.`, { help: true })}
    </BoxHelp>
  );
}
