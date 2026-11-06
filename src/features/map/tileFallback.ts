import type {
  Coords,
  GridLayer,
  Map as LeafletMap,
  TileErrorEvent,
} from 'leaflet';

import { leaflet } from './leaflet.ts';

function tileBounds({ x, y, z }: Coords): [[number, number], [number, number]] {
  const size = 2 ** z;
  const lat = (row: number) =>
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * row) / size))) * 180) / Math.PI;
  const lon = (column: number) => (column / size) * 360 - 180;
  return [
    [lat(y + 1), lon(x)],
    [lat(y), lon(x + 1)],
  ];
}

function keyOf(coords: Coords): string {
  return `${coords.z}/${coords.x}/${coords.y}`;
}

/**
 * Say where the map has nothing to show: the empty background stays only on the
 * tiles that could not be found, never a made-up chart.
 * @param map - Leaflet map.
 * @param layers - The backgrounds.
 */
export function keepTilesFilled(
  map: LeafletMap,
  layers: readonly GridLayer[],
): void {
  const L = leaflet();
  const missing = new Map<string, Coords>();
  const note = L.DomUtil.create('div', 'map-missing', map.getContainer());
  note.hidden = true;
  note.append('Carte non chargée ici : elle demande du réseau');
  // Leaflet also loads tiles just off the screen: only what is seen counts.
  const refresh = () => {
    const view = map.getBounds();
    note.hidden = ![...missing.values()].some((coords) =>
      view.intersects(tileBounds(coords)),
    );
  };
  const forget = (coords: Coords) => {
    missing.delete(keyOf(coords));
    refresh();
  };
  for (const layer of layers) {
    layer.on('tileerror', (event: TileErrorEvent) => {
      missing.set(keyOf(event.coords), event.coords);
      refresh();
    });
    layer.on('tileload tileunload', (event) => {
      forget((event as unknown as TileErrorEvent).coords);
    });
  }
  map.on('baselayerchange', () => {
    missing.clear();
    refresh();
  });
  map.on('moveend', refresh);
}
