import { useSignals } from '@preact/signals-react/runtime';
import { useRef, useState } from 'react';

import RELAY_CODE from '../../../proxy/navin-relay.js?raw';
import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { state, toast, updateSettings } from '../../state/index.ts';

import { KeyAccount } from './KeyAccount.tsx';
import { KeyGuide } from './KeyGuide.tsx';
import { KeyQr } from './KeyQr.tsx';
import { metarReadings } from './euStations.ts';
import { relayRecords } from './relayRecord.ts';

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
    const recording = readings.length > 0 ? await relayRecords() : null;
    setBusy(false);
    setResult(
      readings.length > 0
        ? `Relais en service : ${readings.length} aéroport(s) lu(s) à l’essai. ${
            recording?.recording
              ? `Enregistrement actif : 24 h des stations gardées, NavIn fermé, pour tous les appareils. ${
                  recording.reads.length > 0
                    ? `Le relais lit lui-même : ${recording.reads.join(', ')}.`
                    : 'Météo-France NavIn fermé : étape 12 du guide.'
                }`
              : 'Enregistrement pas encore installé (étapes 8 à 11 du guide).'
          }`
        : 'Le relais ne répond pas : vérifiez son adresse.',
    );
  };
  return (
    <div className="field sea-center key-row">
      <form
        className="key-form"
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
      </form>
      <KeyQr id="relay" value={relay} />
      <Button
        type="button"
        className="btn key-guide-open relay-code"
        onClick={() => {
          buzz();
          navigator.clipboard
            .writeText(RELAY_CODE)
            .then(() =>
              toast(
                'Code du relais copié : le coller sur Cloudflare (« Modifier le code »)',
              ),
            )
            .catch(() => toast('Copie impossible sur cet appareil'));
        }}
      >
        📋 Copier le code du relais
        <small>
          à coller sur Cloudflare, dans « Modifier le code » du Worker
        </small>
      </Button>
      <KeyGuide id="relay" name="Cloudflare" what="l’adresse du relais" />
      <KeyAccount
        id="relay"
        name="Cloudflare"
        url="https://dash.cloudflare.com"
      />
      <HelpText>
        Facultatif. Le petit relais de NavIn, installé gratuitement sur un
        compte Cloudflare (Workers), lit pour NavIn ce que les serveurs ne
        laissent pas lire par une page web : les METAR des aéroports, les bouées
        et bateaux-feux de la NOAA, la Croatie (DHMZ), les Pays-Bas
        (Rijkswaterstaat), la Norvège (Frost, avec son identifiant) et les feux
        d’avis des lacs suisses (MétéoSuisse). Il garde aussi 24 h des stations
        pour tous les appareils. Coller ici son adresse ; après une mise à jour
        de NavIn qui l’annonce, recoller son code.
      </HelpText>
    </div>
  );
}
