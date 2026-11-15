import { useSignals } from '@preact/signals-react/runtime';
import { useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { state, toast, updateSettings } from '../../state/index.ts';

import { KeyAccount } from './KeyAccount.tsx';
import { KeyQr } from './KeyQr.tsx';
import type { WindReading } from './windTypes.ts';

/** What a key row needs to know of its network. */
interface StationKey {
  /** Where the key is kept in `settings.windAlert`. */
  setting: 'aemetKey' | 'metOfficeKey';
  /** The account of its site (`aemet`, `metoffice`). */
  account: string;
  /** Name of the network. */
  name: string;
  /** Its flag and words on the field. */
  label: string;
  /** The site where the key is made. */
  url: string;
  /** How to get the key. */
  help: string;
  /** Read the stations with the key, around a place, to try it. */
  read: (
    center: { lat: number; lon: number },
    key: string,
  ) => Promise<WindReading[]>;
  /** A place of its country, to try the key away from it. */
  sample: { lat: number; lon: number };
}

/**
 * The key of a network of measured wind (AEMET, Met Office), saved in the
 * settings as the Météo-France one; saving tries it; the account of its
 * site under it.
 * @param props - The network.
 * @param props.station - What the row needs to know of it.
 * @returns The row.
 */
export function StationKeyRow({ station }: { station: StationKey }) {
  useSignals();
  const tr = useTr();
  const saved = state.preferences.settings.value.windAlert?.[station.setting];
  const key = typeof saved === 'string' ? saved : '';
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const value = input.current?.value.trim() ?? '';
    buzz();
    input.current?.blur();
    updateSettings((settings) => {
      settings.windAlert = { ...settings.windAlert, [station.setting]: value };
    });
    if (!value) {
      setResult('');
      toast(`Clé ${station.name} retirée`);
      return;
    }
    setBusy(true);
    setResult(`Essai de la clé auprès de ${station.name}…`);
    try {
      const readings = await station.read(station.sample, value);
      setResult(
        readings.length > 0
          ? `Clé acceptée : ${readings.length} station(s) lue(s) autour de l’essai.`
          : `Aucune station lue avec cette clé : vérifiez-la sur le site de ${station.name}.`,
      );
    } catch {
      setResult(`${station.name} n’a pas répondu : réessayez plus tard.`);
    }
    setBusy(false);
  };
  const id = `${station.account}Key`;
  return (
    <form
      className="field sea-center"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="cf">
        <label htmlFor={id}>{tr(station.label)}</label>
        <div className="sea-center-row">
          <input
            className="text"
            id={id}
            ref={input}
            // The key is a secret: pasted, never shown in clear.
            type="password"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={tr('Aucune clé')}
            defaultValue={key}
            key={key}
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
      <KeyQr
        id={station.setting === 'aemetKey' ? 'aemet' : 'metoffice'}
        value={key}
      />
      <KeyAccount id={station.account} name={station.name} url={station.url} />
      <HelpText>{station.help}</HelpText>
    </form>
  );
}
