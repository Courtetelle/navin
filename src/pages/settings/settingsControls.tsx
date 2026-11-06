import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { state } from '../../state/index.ts';

import { changeSetting } from './settingsState.ts';

const AUTO_RATES = [
  [0.5, 'Peu', '≈ 1 / 2 h'],
  [1, 'Normal', '≈ 1 / h'],
  [2, 'Détaillé', '≈ 2 / h'],
] as const;

/** Props of {@link OptionButtons}. */
interface OptionButtonsProps {
  /** Setting changed. */
  settingKey: string;
  /** Values offered. */
  values: readonly number[];
  /** Unit written after the value. */
  unit: string;
}

/**
 * A row of four numeric choices (legacy `opt`).
 * @param props - Setting, values and unit.
 * @returns The row.
 */
function OptionButtons({ settingKey, values, unit }: OptionButtonsProps) {
  useSignals();
  const tr = useTr();
  const current = state.preferences.settings.value[settingKey];
  return (
    <ButtonRow className="row c4">
      {values.map((value) => (
        <Button
          key={value}
          className={current === value ? 'btn on' : 'btn'}
          data-s={settingKey}
          data-v={value}
          onClick={() => {
            changeSetting((settings) => {
              settings[settingKey] = value;
            });
          }}
        >
          {tr(`${value}${unit}`)}
        </Button>
      ))}
    </ButtonRow>
  );
}

/**
 * Keep the screen on (legacy `wake`).
 * @returns The row.
 */
export function WakeRow() {
  useSignals();
  const tr = useTr();
  const { wake } = state.preferences.settings.value;
  const recording = !wake && state.view.tracking.value;
  return (
    <ButtonRow>
      <Button
        className={wake ? 'btn on' : 'btn'}
        id="wakeBtn"
        onClick={() => {
          changeSetting((settings) => {
            settings.wake = !settings.wake;
          });
        }}
      >
        {tr(
          `${wake ? 'Désactiver' : 'Activer'} l’écran allumé en continu${recording ? ' (allumé tant que la trace s’enregistre)' : ''}`,
        )}
      </Button>
    </ButtonRow>
  );
}

/**
 * Automatic log rate and course change (legacy `auto`).
 * @returns The two settings.
 */
export function AutoLogRows() {
  useSignals();
  const tr = useTr();
  const { autoPerHour } = state.preferences.settings.value;
  return (
    <>
      <HelpText nextIsRow>
        Journal automatique : entrées entre le départ et l’arrivée
      </HelpText>
      <ButtonRow className="row c3">
        {AUTO_RATES.map(([rate, label, sub]) => (
          <Button
            key={rate}
            className={autoPerHour === rate ? 'btn on' : 'btn'}
            data-s="autoPerHour"
            data-v={rate}
            onClick={() => {
              changeSetting((settings) => {
                settings.autoPerHour = rate;
              });
            }}
          >
            {tr(label)}
            <small>{tr(sub)}</small>
          </Button>
        ))}
      </ButtonRow>
      <HelpText nextIsRow>Changement de cap noté au-delà de…</HelpText>
      <OptionButtons settingKey="autoTurn" values={[20, 30, 45, 60]} unit="°" />
    </>
  );
}

/**
 * Distance of the Go to arrival signal (legacy `gotoArr`).
 * @returns The setting.
 */
export function GotoArrivalRows() {
  return (
    <>
      <HelpText nextIsRow>Go to : signal d’arrivée à moins de…</HelpText>
      <OptionButtons
        settingKey="gotoArrive"
        values={[30, 50, 100, 200]}
        unit=" m"
      />
    </>
  );
}

/**
 * Take over the last entry (legacy `prefill`).
 * @returns The row.
 */
export function PrefillRow() {
  useSignals();
  const tr = useTr();
  const { prefill } = state.preferences.settings.value;
  return (
    <ButtonRow>
      <Button
        className={prefill ? 'btn on' : 'btn'}
        id="prefillBtn"
        onClick={() => {
          changeSetting((settings) => {
            settings.prefill = !settings.prefill;
          });
        }}
      >
        {tr(`Reprendre la dernière entrée : ${prefill ? 'OUI' : 'NON'}`)}
      </Button>
    </ButtonRow>
  );
}

/**
 * Add the model weather to automatic entries (legacy `wx`).
 * @returns The row.
 */
export function WeatherRow() {
  useSignals();
  const tr = useTr();
  const { autoWeather } = state.preferences.settings.value;
  return (
    <ButtonRow>
      <Button
        className={autoWeather ? 'btn on' : 'btn'}
        id="wxBtn"
        onClick={() => {
          changeSetting((settings) => {
            settings.autoWeather = !settings.autoWeather;
          });
        }}
      >
        {tr(
          `Météo du modèle ajoutée avec du réseau : ${autoWeather ? 'OUI' : 'NON'}`,
        )}
      </Button>
    </ButtonRow>
  );
}
