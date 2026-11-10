import { useSignals } from '@preact/signals-react/runtime';
import { useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { lastKnownPos, toast, updateSettings } from '../../state/index.ts';

import { mfCheck } from './coastStations.ts';
import { seaPlace } from './externals.ts';
import { checkText } from './mfCheckText.ts';
import { windConfig, windWatchStart } from './windWatch.ts';

/**
 * The Météo-France API key of the wind alerts: with it, the official French
 * stations are read besides the OpenWindMap beacons. Saving tries the key.
 * @returns The row.
 */
export function MfKeyRow() {
  useSignals();
  const tr = useTr();
  const key = windConfig().mfKey;
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const value = input.current?.value.trim() ?? '';
    buzz();
    input.current?.blur();
    updateSettings((settings) => {
      settings.windAlert = { ...settings.windAlert, mfKey: value };
    });
    windWatchStart();
    if (!value) {
      setResult('');
      toast('Clé Météo-France retirée');
      return;
    }
    setBusy(true);
    setResult('Vérification de la clé auprès de Météo-France…');
    const place = lastKnownPos() ?? seaPlace();
    const text = checkText(await mfCheck(value, place));
    setBusy(false);
    setResult(text);
    toast(text.split(' · ', 1)[0] ?? text);
  };
  return (
    <form
      className="field sea-center"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
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
          <Button className="btn" type="submit" disabled={busy}>
            {tr(busy ? 'Vérification…' : 'Enregistrer')}
          </Button>
        </div>
      </div>
      {result ? (
        <p className="keep-help mf-check" role="status">
          {tr(result)}
        </p>
      ) : null}
      <HelpText>
        Facultatif. Gratuite sur portail-api.meteofrance.fr : créer un compte,
        s’abonner à l’API « Données Publiques Observation », puis générer une
        clé de type « API Key » et la coller ici. Enregistrer vérifie la clé.
        Sans clé, seules les balises OpenWindMap sont lues hors de Suisse.
      </HelpText>
    </form>
  );
}
