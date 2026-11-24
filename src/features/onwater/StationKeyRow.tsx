import { useSignals } from '@preact/signals-react/runtime';
import { useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { state, toast, updateSettings } from '../../state/index.ts';

import { CopyKeyButton } from './CopyKeyButton.tsx';
import { KeyAccount } from './KeyAccount.tsx';
import { KeyGuide } from './KeyGuide.tsx';
import { KeyQr } from './KeyQr.tsx';
import type { WindReading } from './windTypes.ts';

/** The key is tried again after this long when nothing came. */
const RETRY_MS = 3000;

/** What a key row needs to know of its network. */
interface StationKey {
  /** Where the key is kept in `settings.windAlert`. */
  setting: 'aemetKey' | 'metOfficeKey' | 'frostKey';
  /** The account of its site (`aemet`, `metoffice`). */
  account: string;
  /** Name of the network. */
  name: string;
  /** No account on its site: only the mail that receives the key. */
  mailOnly: boolean;
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
      let readings = await station.read(station.sample, value);
      // These servers often refuse a first request: once more before saying
      // the key reads nothing.
      if (readings.length === 0) {
        setResult(`${station.name} n’a rien rendu : nouvel essai…`);
        await new Promise((resolve) => {
          setTimeout(resolve, RETRY_MS);
        });
        readings = await station.read(station.sample, value);
      }
      setResult(
        readings.length > 0
          ? `Clé acceptée : ${readings.length} station(s) lue(s) autour de l’essai.`
          : `Aucune station lue avec cette clé : vérifiez-la sur le site de ${station.name}, ou réessayez plus tard.`,
      );
    } catch {
      setResult(`${station.name} n’a pas répondu : réessayez plus tard.`);
    }
    setBusy(false);
  };
  const id = `${station.account}Key`;
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
            <CopyKeyButton value={key} />
          </div>
        </div>
        {result ? (
          <p className="keep-help mf-check" role="status">
            {tr(result)}
          </p>
        ) : null}
      </form>
      <KeyQr
        id={
          station.setting === 'aemetKey'
            ? 'aemet'
            : station.setting === 'frostKey'
              ? 'frost'
              : 'metoffice'
        }
        value={key}
      />
      <KeyGuide id={station.account} name={station.name} />
      <KeyAccount
        id={station.account}
        name={station.name}
        url={station.url}
        mailOnly={station.mailOnly}
      />
      <HelpText>{station.help}</HelpText>
    </div>
  );
}
