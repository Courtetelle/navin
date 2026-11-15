import { useSignals } from '@preact/signals-react/runtime';
import { useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { state, toast, updateSettings } from '../../state/index.ts';

import { metarReadings } from './euStations.ts';

/** A place with airports around, to try the relay. */
const SAMPLE = { lat: 50.8, lon: -1.3 };

/**
 * The address of the relay of NavIn (a Cloudflare Worker of the skipper):
 * with it, the METAR of the airports and the NOAA buoys and lightships are
 * read too. Saving tries it.
 * @returns The row.
 */
export function RelayRow() {
  useSignals();
  const tr = useTr();
  const saved = state.preferences.settings.value.windAlert?.relayUrl;
  const relay = typeof saved === 'string' ? saved : '';
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const value = input.current?.value.trim() ?? '';
    buzz();
    input.current?.blur();
    updateSettings((settings) => {
      settings.windAlert = { ...settings.windAlert, relayUrl: value };
    });
    if (!value) {
      setResult('');
      toast('Relais retiré');
      return;
    }
    setBusy(true);
    setResult('Essai du relais…');
    const readings = await metarReadings(SAMPLE, 60, 3, value).catch(() => []);
    setBusy(false);
    setResult(
      readings.length > 0
        ? `Relais en service : ${readings.length} aéroport(s) lu(s) à l’essai.`
        : 'Le relais ne répond pas : vérifiez son adresse.',
    );
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
        <label htmlFor="relayUrl">{tr('🛰 Relais des METAR et bouées')}</label>
        <div className="sea-center-row">
          <input
            className="text"
            id="relayUrl"
            ref={input}
            type="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="https://navin-relay.….workers.dev"
            defaultValue={relay}
            key={relay}
          />
          <Button className="btn" type="submit" disabled={busy}>
            {tr(busy ? 'Essai…' : 'Enregistrer')}
          </Button>
        </div>
      </div>
      {result ? (
        <p className="keep-help mf-check" role="status">
          {tr(result)}
        </p>
      ) : null}
      <HelpText>
        Facultatif. Le petit relais de NavIn, installé gratuitement sur un
        compte Cloudflare (Workers), lit les METAR des aéroports et les bouées
        et bateaux-feux de la NOAA (Manche, mer du Nord, Atlantique), dont les
        serveurs ne se laissent pas lire par une page web. Coller ici son
        adresse.
      </HelpText>
    </form>
  );
}
