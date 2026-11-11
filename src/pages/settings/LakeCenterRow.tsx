import { useSignals } from '@preact/signals-react/runtime';
import { useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import {
  LAKE_PLACES,
  lakePlace,
  setLakePlace,
} from '../../features/map/lakeCenter.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { onlinePlaces } from '../../shell/search/searchIndex.ts';
import { state, toast } from '../../state/index.ts';

/** Value of the choice that opens the search by name. */
const OTHER = '…';

/**
 * Where the lake map opens: a navigable lake chosen in a list, or another
 * place typed by name and found on the network (Lake Geneva until then).
 * @returns The row.
 */
export function LakeCenterRow() {
  useSignals();
  const tr = useTr();
  const place = lakePlace(state.preferences.settings.value);
  const listed = LAKE_PLACES.some((lake) => lake.name === place.name);
  const [other, setOther] = useState(!listed);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const choose = (name: string) => {
    buzz();
    if (name === OTHER) {
      setOther(true);
      requestAnimationFrame(() => input.current?.focus());
      return;
    }
    const lake = LAKE_PLACES.find((one) => one.name === name);
    if (!lake) return;
    setOther(false);
    setLakePlace(lake);
    toast(`Carte des lacs centrée sur ${lake.name}`);
  };
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
    setLakePlace({ name, lat: first.lat, lon: first.lon });
    if (input.current) input.current.value = name;
    toast(`Carte des lacs centrée sur ${name}`);
  };
  return (
    <form
      className="field sea-center lake-center"
      onSubmit={(event) => {
        event.preventDefault();
        void search();
      }}
    >
      <div className="cf">
        <label htmlFor="lakeCenter">
          {tr('🏞 Centre de la carte sur les lacs')}
        </label>
        <select
          id="lakeCenter"
          className="text"
          value={other ? OTHER : place.name}
          onChange={(event) => choose(event.currentTarget.value)}
        >
          {LAKE_PLACES.map((lake) => (
            <option key={lake.name} value={lake.name}>
              {lake.name}
            </option>
          ))}
          <option value={OTHER}>{tr('Autre lieu…')}</option>
        </select>
        {other ? (
          <div className="sea-center-row">
            <input
              className="text"
              ref={input}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              aria-label={tr('Autre lieu')}
              placeholder={tr('Nom du lac ou du port')}
              defaultValue={listed ? '' : place.name}
              key={place.name}
            />
            <Button className="btn" type="submit" disabled={busy}>
              {tr(busy ? 'Recherche…' : 'Chercher')}
            </Button>
          </div>
        ) : null}
      </div>
      <HelpText>
        Choisissez votre lac : la carte s’y ouvrira sur un lac quand aucune
        position GPS n’est connue, et les menus (météo, secours) en parleront
        quand la zone « lac » est choisie avec NavIn. « Autre lieu… » cherche un
        nom sur le réseau.
      </HelpText>
    </form>
  );
}
