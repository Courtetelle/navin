import { useSignals } from '@preact/signals-react/runtime';

import type { SeaBasin } from '../../features/map/seaCenter.ts';
import { seaPlace, setSeaPlace } from '../../features/map/seaCenter.ts';
import { state, toast } from '../../state/index.ts';

import { PlaceCenterField } from './PlaceCenterField.tsx';

/** The title, icon and text of the field of each sea. */
const SEAS: Readonly<
  Record<SeaBasin, { title: string; icon: string; name: string }>
> = {
  atl: {
    title: '🌊 Centre de la carte en Atlantique',
    icon: '🌊',
    name: 'Atlantique',
  },
  med: {
    title: '☀️ Centre de la carte en Méditerranée',
    icon: '☀️',
    name: 'Méditerranée',
  },
};

/**
 * Where the map of a sea opens: a port or a place typed by name and picked in
 * the list of the places found on the network (Saint-Malo in the Atlantic,
 * Marseille in the Mediterranean until then).
 * @param props - The row.
 * @param props.basin - `atl` or `med`.
 * @returns The row.
 */
export function SeaCenterRow({ basin }: { basin: SeaBasin }) {
  useSignals();
  const sea = SEAS[basin];
  return (
    <PlaceCenterField
      id={basin === 'med' ? 'medCenter' : 'seaCenter'}
      title={sea.title}
      icon={sea.icon}
      current={seaPlace(state.preferences.settings.value, basin)}
      known={[]}
      placeholder="Port ou lieu de la côte"
      help={`Écrivez un port ou un lieu, puis touchez-le dans la liste : la carte s’y ouvrira quand la zone « ${sea.name} » est choisie avec NavIn et qu’aucune position GPS n’est connue (réseau nécessaire pour la recherche).`}
      onPick={(place) => {
        setSeaPlace(place, basin);
        toast(`Carte en ${sea.name} centrée sur ${place.name}`);
      }}
    />
  );
}
