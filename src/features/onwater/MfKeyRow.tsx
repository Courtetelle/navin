import { useSignals } from '@preact/signals-react/runtime';
import { useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { toast, updateSettings } from '../../state/index.ts';

import { windConfig, windWatchStart } from './windWatch.ts';

/**
 * The Météo-France API key of the wind alerts: with it, the official French
 * stations are read besides the OpenWindMap beacons.
 * @returns The row.
 */
export function MfKeyRow() {
  useSignals();
  const tr = useTr();
  const key = windConfig().mfKey;
  const input = useRef<HTMLInputElement>(null);
  const save = () => {
    const value = input.current?.value.trim() ?? '';
    buzz();
    input.current?.blur();
    updateSettings((settings) => {
      settings.windAlert = { ...settings.windAlert, mfKey: value };
    });
    windWatchStart();
    toast(
      value
        ? 'Clé Météo-France enregistrée · stations françaises lues'
        : 'Clé Météo-France retirée',
    );
  };
  return (
    <form
      className="field sea-center"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="cf">
        <label htmlFor="mfKey">{tr('🇫🇷 Clé API Météo-France')}</label>
        <div className="sea-center-row">
          <input
            className="text"
            id="mfKey"
            ref={input}
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={tr('Aucune clé')}
            defaultValue={key}
            key={key}
          />
          <Button className="btn" type="submit">
            {tr('Enregistrer')}
          </Button>
        </div>
      </div>
      <HelpText>
        Facultatif. Gratuite sur portail-api.meteofrance.fr : créer un compte,
        s’abonner à l’API « Données Publiques Observation », puis générer une
        clé de type « API Key » et la coller ici. Sans clé, seules les balises
        OpenWindMap sont lues hors de Suisse.
      </HelpText>
    </form>
  );
}
