import { useSignals } from '@preact/signals-react/runtime';
import { useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { seaPlace, setSeaPlace } from '../../features/map/seaCenter.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { onlinePlaces } from '../../shell/search/searchIndex.ts';
import { state, toast } from '../../state/index.ts';

/**
 * Where the sea map opens: a place typed by name, found on the network, kept
 * in the settings (Saint-Malo until then).
 * @returns The row.
 */
export function SeaCenterRow() {
  useSignals();
  const tr = useTr();
  const place = seaPlace(state.preferences.settings.value);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const search = async () => {
    const query = input.current?.value.trim() ?? '';
    if (!query || busy) return;
    buzz();
    input.current?.blur();
    setBusy(true);
    const found = await onlinePlaces(query, AbortSignal.timeout(10_000));
    setBusy(false);
    const first = found[0];
    if (!first) {
      toast('Lieu introuvable · vérifiez le nom et le réseau');
      return;
    }
    const name = first.name.split(',', 1)[0]?.trim() || query;
    setSeaPlace({ name, lat: first.lat, lon: first.lon });
    if (input.current) input.current.value = name;
    toast(`Carte en mer centrée sur ${name}`);
  };
  return (
    <form
      className="field sea-center"
      onSubmit={(event) => {
        event.preventDefault();
        void search();
      }}
    >
      <div className="cf">
        <label htmlFor="seaCenter">{tr('🌊 Centre de la carte en mer')}</label>
        <div className="sea-center-row">
          <input
            className="text"
            id="seaCenter"
            ref={input}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            defaultValue={place.name}
            key={place.name}
          />
          <Button className="btn" type="submit" disabled={busy}>
            {tr(busy ? 'Recherche…' : 'Chercher')}
          </Button>
        </div>
      </div>
      <HelpText>
        Écrivez un port ou un lieu : la carte en mer s’ouvrira dessus quand
        aucune position GPS n’est connue (réseau nécessaire pour la recherche).
      </HelpText>
    </form>
  );
}
