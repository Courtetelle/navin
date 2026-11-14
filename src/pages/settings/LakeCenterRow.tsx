import { useSignals } from '@preact/signals-react/runtime';

import {
  LAKE_PLACES,
  lakePlace,
  setLakePlace,
} from '../../features/map/lakeCenter.ts';
import { state, toast } from '../../state/index.ts';

import { PlaceCenterField } from './PlaceCenterField.tsx';

/**
 * Where the lake map opens: a lake or a place nearby, typed by name and
 * picked in a list (the lakes of the app, then the places found on the
 * network); Lake Geneva until then.
 * @returns The row.
 */
export function LakeCenterRow() {
  useSignals();
  return (
    <PlaceCenterField
      id="lakeCenter"
      title="🏞 Centre de la carte sur les Lacs"
      icon="🏞"
      current={lakePlace(state.preferences.settings.value)}
      known={LAKE_PLACES}
      placeholder="Nom du lac ou d’un lieu au bord"
      help="Écrivez le nom d’un lac ou d’un lieu au bord, puis touchez-le dans la liste : la carte s’y ouvrira sur un lac quand aucune position GPS n’est connue, et les menus en parleront quand la zone « Lacs » est choisie avec NavIn (réseau nécessaire pour les lieux hors de la liste)."
      onPick={(place) => {
        setLakePlace(place);
        toast(`Carte des lacs centrée sur ${place.name}`);
      }}
    />
  );
}
