import { useSignals } from '@preact/signals-react/runtime';

import {
  chooseBase,
  chooseOverlay,
  layerPrefs,
  mapLayerNames,
} from '../../features/map/layerPrefs.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';

/**
 * The background and the layers of the maps, chosen here instead of a menu on
 * the map: what the map offered where it was last shown (the Swiss and Lake
 * Geneva layers over Switzerland, the map files of this device…).
 * @returns The section.
 */
export function MapLayersSection() {
  useSignals();
  const tr = useTr();
  const names = mapLayerNames.value;
  const prefs = layerPrefs.value;
  const bases = names.filter((item) => item.kind === 'base');
  const overlays = names.filter((item) => item.kind === 'overlay');
  const base =
    bases.find((item) => item.name === prefs.base)?.name ??
    bases.find((item) => item.on)?.name;
  if (names.length === 0) {
    return (
      <section className="field" id="mapLayers">
        <h2>{tr('Fond de carte et couches')}</h2>
        <p className="help">
          {tr('Ouvrez une fois la carte : ses couches s’affichent ici.', {
            help: true,
          })}
        </p>
      </section>
    );
  }
  return (
    <section className="field map-layers" id="mapLayers">
      <h2>{tr('Fond de carte')}</h2>
      {bases.map((item) => (
        <label className="map-layer" key={item.name}>
          <input
            type="radio"
            name="mapBase"
            checked={item.name === base}
            onChange={() => {
              buzz();
              chooseBase(item.name);
            }}
          />
          <span>{tr(item.name)}</span>
        </label>
      ))}
      <h2>{tr('Couches')}</h2>
      {overlays.map((item) => (
        <label className="map-layer" key={item.name}>
          <input
            type="checkbox"
            checked={prefs.on[item.name] ?? item.on}
            onChange={(event) => {
              buzz();
              chooseOverlay(item.name, event.target.checked);
            }}
          />
          <span>{tr(item.name)}</span>
        </label>
      ))}
      <p className="help">
        {tr(
          'Les couches suisses et du Léman apparaissent quand la carte montre la Suisse ou le lac.',
          { help: true },
        )}
      </p>
    </section>
  );
}
