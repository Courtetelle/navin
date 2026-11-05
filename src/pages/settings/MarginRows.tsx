import { useSignals } from '@preact/signals-react/runtime';
import type { ChangeEvent } from 'react';
import { useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useMarquee } from '../../components/shared/useMarquee.ts';
import { useTr } from '../../i18n/useTr.ts';
import { marginVal, roundStep } from '../../lib/boatValues.ts';
import { num } from '../../lib/format.ts';
import type { MarginKey } from '../../model/settings.ts';
import { state, updateSettings } from '../../state/index.ts';

import { changeSetting, settingsRedraws } from './settingsState.ts';

const MARGINS: ReadonlyArray<readonly [string, MarginKey, string, string]> = [
  ['setPP', 'piedPilote', 'Pied de pilote', '(m)'],
  ['setMH', 'margeHaut', 'Marge de hauteur', '(m)'],
  ['setCP', 'coquePct', 'Longueur de coque : réduction', '(%)'],
];
const ROUNDINGS: ReadonlyArray<readonly [string, string]> = [
  ['arrProf', 'Arrondi de la sonde min. selon traceur'],
  ['arrHaut', 'Arrondi de la hauteur de passage min.'],
];
const STEPS = [
  [0, 'exact'],
  [0.1, '0,1'],
  [0.5, '0,5'],
  [1, '1'],
] as const;

function changeMargin(key: string, event: ChangeEvent<HTMLInputElement>): void {
  const text = event.target.value;
  const value = num(text);
  if (text.trim() === '') {
    updateSettings((settings) => {
      Reflect.deleteProperty(settings, key);
    });
  } else if (value != null && value >= 0) {
    updateSettings((settings) => {
      settings[key] = value;
    });
  }
}

/**
 * Rules of the automatic calculations of the boat sheets (legacy `margins`).
 * @returns The margins and roundings.
 */
export function MarginRows() {
  useSignals();
  const tr = useTr();
  const settings = state.preferences.settings.value;
  const redraw = settingsRedraws.value;
  return (
    <>
      <HelpText nextIsRow>
        Règles des calculs automatiques dans les données des bateaux (une valeur
        saisie à la main dans la fiche reste prioritaire, en rouge).
      </HelpText>
      <div className="set-rows">
        {MARGINS.map(([id, key, label, unit]) => (
          <div className="cf" key={id}>
            <label htmlFor={id}>
              {tr(`${label} `)}
              <span className="u">{tr(unit)}</span>
            </label>
            <MarginInput
              key={redraw}
              id={id}
              marginKey={key}
              value={String(marginVal(settings, key)).replace('.', ',')}
            />
          </div>
        ))}
      </div>
      {ROUNDINGS.map(([key, label]) => (
        <RoundingRow key={key} settingKey={key} label={label} />
      ))}
    </>
  );
}

interface MarginInputProps {
  id: string;
  marginKey: MarginKey;
  /** Text shown when the field is drawn; typing does not redraw it. */
  value: string;
}

function MarginInput({ id, marginKey, value }: MarginInputProps) {
  const input = useRef<HTMLInputElement>(null);
  useMarquee(input);
  return (
    <input
      className="text"
      id={id}
      ref={input}
      data-margin={marginKey}
      type="text"
      inputMode="decimal"
      defaultValue={value}
      onChange={(event) => changeMargin(marginKey, event)}
    />
  );
}

function RoundingRow({
  settingKey,
  label,
}: {
  settingKey: string;
  label: string;
}) {
  useSignals();
  const tr = useTr();
  const step = roundStep(state.preferences.settings.value, settingKey);
  return (
    <>
      <HelpText nextIsRow>{`${label} : vers le haut, en mètres`}</HelpText>
      <ButtonRow className="row c4">
        {STEPS.map(([value, text]) => (
          <Button
            key={value}
            className={step === value ? 'btn on' : 'btn'}
            data-s={settingKey}
            data-v={value}
            onClick={() => {
              changeSetting((settings) => {
                settings[settingKey] = value;
              });
            }}
          >
            {tr(text)}
          </Button>
        ))}
      </ButtonRow>
    </>
  );
}
