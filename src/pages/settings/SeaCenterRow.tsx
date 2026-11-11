import { useSignals } from '@preact/signals-react/runtime';

import { seaPlace, setSeaPlace } from '../../features/map/seaCenter.ts';
import { state, toast } from '../../state/index.ts';

import { PlaceCenterField } from './PlaceCenterField.tsx';

/**
 * Where the sea map opens: a port or a place typed by name and picked in the
 * list of the places found on the network (Saint-Malo until then).
 * @returns The row.
 */
export function SeaCenterRow() {
  useSignals();
  return (
    <PlaceCenterField
      id="seaCenter"
      title="🌊 Centre de la carte en mer"
      icon="🌊"
      current={seaPlace(state.preferences.settings.value)}
      known={[]}
      placeholder="Port ou lieu de la côte"
      help="Écrivez un port ou un lieu, puis touchez-le dans la liste : la carte en mer s’ouvrira dessus quand aucune position GPS n’est connue (réseau nécessaire pour la recherche)."
      onPick={(place) => {
        setSeaPlace(place);
        toast(`Carte en mer centrée sur ${place.name}`);
      }}
    />
  );
}
