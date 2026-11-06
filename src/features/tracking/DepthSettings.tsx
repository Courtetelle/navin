import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { frN } from '../../lib/format.ts';
import { state, updateSettings } from '../../state/index.ts';

import {
  DEPTH_SCENARIOS,
  depthAlarmSet,
  depthStart,
  depthTestStart,
  depthTestState,
} from './depthAlarm.ts';
import { depthBuzz, depthVolume } from './depthAudio.ts';
import { sondeMin } from './depthEstimate.ts';

/** Props of {@link DepthDev}. */
export interface DepthDevProps {
  /**
   * Inside the tests section of the settings, else in its own section.
   * @default false
   */
  inAlerts?: boolean;
}

const START_CHOICES = [0.5, 1, 1.5, 2];
const VOLUME_CHOICES: ReadonlyArray<[number, string]> = [
  [0.3, 'Faible'],
  [0.6, 'Moyen'],
  [1, 'Fort'],
];

/**
 * Test of the depth alarm (legacy `depthDevHtml`). Its text is read when it is
 * mounted: the settings give it a new key at each redraw.
 * @param props - Where it is shown.
 * @returns The section.
 */
export function DepthDev({ inAlerts = false }: DepthDevProps) {
  useSignals();
  const tr = useTr();
  useEffect(() => {
    depthTestState.value = '';
  }, []);
  // Written once per drawing of the screen, whatever is typed meanwhile.
  const [start] = useState(depthStart);
  const [minimum] = useState(sondeMin);
  const body = (
    <>
      {inAlerts ? null : <DepthToggle />}
      <HelpText
        text={`Sonde min. selon traceur : ${minimumText(minimum)}. L’alarme démarre ${frN(start)} m au-dessus et monte jusqu’à la sonde min. Réglages : roue dentée de NavIn. Il faut les courbes 1 à 5 m (swissBATHY3D) chargées dans la carte.`}
      >
        <>
          {tr('Sonde min. selon traceur : ', { help: true })}
          <b>{tr(minimumText(minimum), { help: true })}</b>
          {tr(
            `. L’alarme démarre ${frN(start)} m au-dessus et monte jusqu’à la sonde min. Réglages : roue dentée de NavIn. Il faut les courbes 1 à 5 m (swissBATHY3D) chargées dans la carte.`,
            { help: true },
          )}
        </>
      </HelpText>
      <ButtonRow className="row c2">
        <Button
          className="btn"
          data-depthtest="lent"
          onClick={() => {
            buzz();
            depthTestStart('lent');
          }}
        >
          {tr(`▶ ${DEPTH_SCENARIOS.lent.name}`)}
          <small>{tr('40 s')}</small>
        </Button>
        <Button
          className="btn"
          data-depthtest="vite"
          onClick={() => {
            buzz();
            depthTestStart('vite');
          }}
        >
          {tr(`▶ ${DEPTH_SCENARIOS.vite.name}`)}
          <small>{tr('20 s')}</small>
        </Button>
      </ButtonRow>
      <p className="help" id="depthTestState">
        {depthTestState.value}
      </p>
    </>
  );
  return inAlerts ? (
    <div className="depth-test">
      <h3>{tr('🧪 Tester l’alarme de profondeur')}</h3>
      {body}
    </div>
  ) : (
    <FoldSection
      className="field"
      title="🧪 Alarme de profondeur (lacs suisses)"
    >
      {body}
    </FoldSection>
  );
}

/**
 * Settings of the depth alarm (legacy `depthSetHtml`).
 * @returns The controls.
 */
export function DepthSet() {
  useSignals();
  const tr = useTr();
  const settings = state.preferences.settings.value;
  const start = depthStart();
  const volume = depthVolume();
  const chip = (key: string, value: number, label: string, current: number) => (
    <Button
      key={value}
      className={`btn ${current === value ? 'on' : ''}`}
      data-dset={key}
      data-v={value}
      onClick={() => {
        buzz();
        updateSettings((draft) => {
          draft[key] = value;
        });
      }}
    >
      {tr(label)}
    </Button>
  );
  const flash = settings.depthFlash !== false;
  const vibration = settings.depthVib !== false;
  return (
    <>
      <h3>{tr('Alarme de profondeur (lacs suisses)')}</h3>
      <DepthToggle />
      <HelpText nextIsRow>
        Démarre quand l’eau sous le bateau passe sous la sonde min. selon
        traceur + …
      </HelpText>
      <ButtonRow className="row c4">
        {START_CHOICES.map((value) =>
          chip('depthStart', value, `${frN(value)} m`, start),
        )}
      </ButtonRow>
      <HelpText nextIsRow>Volume maximum du bip</HelpText>
      <ButtonRow className="row c3">
        {VOLUME_CHOICES.map(([value, label]) =>
          chip('depthVol', value, label, volume),
        )}
      </ButtonRow>
      <ButtonRow className="row">
        <Button
          className={`btn ${flash ? 'on' : ''}`}
          data-dset="depthFlash"
          onClick={() => {
            buzz();
            updateSettings((draft) => {
              draft.depthFlash = draft.depthFlash === false;
            });
          }}
        >
          {tr(`Écran qui clignote : ${flash ? 'OUI' : 'NON'}`)}
        </Button>
      </ButtonRow>
      <ButtonRow className="row">
        <Button
          className={`btn ${vibration ? 'on' : ''}`}
          data-dset="depthVib"
          onClick={() => {
            buzz();
            updateSettings((draft) => {
              draft.depthVib = draft.depthVib === false;
            });
            if (state.preferences.settings.peek().depthVib !== false) {
              depthBuzz(1);
            }
          }}
        >
          {tr(`Vibrations : ${vibration ? 'OUI' : 'NON'}`)}
        </Button>
      </ButtonRow>
    </>
  );
}

function minimumText(minimum: number | null): string {
  return minimum === null
    ? 'pas renseignée (test avec 2,0 m)'
    : `${frN(minimum)} m`;
}

function DepthToggle() {
  useSignals();
  const tr = useTr();
  const enabled = state.preferences.settings.value.depthAlarm !== false;
  return (
    <ButtonRow className="row">
      <Button
        className={`btn ${enabled ? 'on' : ''}`}
        data-depthon="1"
        onClick={() => {
          buzz();
          updateSettings((draft) => {
            draft.depthAlarm = draft.depthAlarm === false;
          });
          if (state.preferences.settings.peek().depthAlarm === false) {
            depthAlarmSet(0);
          }
        }}
      >
        {tr(`Alarme de profondeur : ${enabled ? 'OUI' : 'NON'}`)}
      </Button>
    </ButtonRow>
  );
}
