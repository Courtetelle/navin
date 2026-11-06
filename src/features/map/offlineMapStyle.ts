import type * as ProtomapsLeaflet from 'protomaps-leaflet';

type Props = Record<string, unknown>;
type Library = typeof ProtomapsLeaflet;

/** The land under everything else. */
export const LAND_COLOR = '#f2efe9';

const WATER = '#aad3df';
const FONT = 'sans-serif';
const NAMES = ['name:fr', 'name:latin', 'name'];

/** The rail, ferry and walking ways are drawn apart from the roads. */
const ROAD_WIDTHS: Readonly<Record<string, number>> = {
  motorway: 3,
  trunk: 3,
  primary: 2.5,
  secondary: 2,
  tertiary: 1.5,
  minor: 1,
  service: 0.6,
};

/**
 * The width of a road on the screen.
 * @param kind - Class of the road.
 * @param zoom - Zoom of the map.
 * @returns The width in pixels, 0 for what is not a road.
 */
export function roadWidth(kind: unknown, zoom: number): number {
  const base = ROAD_WIDTHS[String(kind)];
  if (!base) return 0;
  return base * Math.max(0.5, 2 ** ((zoom - 12) / 2));
}

/**
 * Whether a town shows at a zoom.
 * @param kind - Class of the place.
 * @param zoom - Zoom of the map.
 * @returns The name fits the map.
 */
export function placeShows(kind: unknown, zoom: number): boolean {
  if (kind === 'city') return true;
  if (kind === 'town') return zoom >= 9;
  if (kind === 'village') return zoom >= 11;
  return zoom >= 13;
}

function classIs(...kinds: string[]) {
  return (_zoom: number, feature: { props: Props }) =>
    kinds.includes(String(feature.props.class));
}

/**
 * What is painted, from the bottom up, for the layers of an OpenMapTiles file.
 * @param library - The drawing library.
 * @returns The rules.
 */
export function offlinePaintRules({
  LineSymbolizer: Line,
  PolygonSymbolizer: Polygon,
}: Pick<
  Library,
  'LineSymbolizer' | 'PolygonSymbolizer'
>): ProtomapsLeaflet.PaintRule[] {
  const area = (dataLayer: string, fill: string, ...kinds: string[]) => ({
    dataLayer,
    symbolizer: new Polygon({ fill }),
    ...(kinds.length > 0 ? { filter: classIs(...kinds) } : {}),
  });
  return [
    area('landuse', '#e4e0dc', 'residential', 'suburb', 'neighbourhood'),
    area('landcover', '#eef0d5', 'farmland'),
    area('landcover', '#cdebb0', 'grass'),
    area('landcover', '#add19e', 'wood'),
    area('landcover', '#e5e5e0', 'rock'),
    area('landcover', '#f5f5f5', 'ice'),
    area('park', '#c8e6b0'),
    area('water', WATER),
    { dataLayer: 'waterway', symbolizer: new Line({ color: WATER, width: 1 }) },
    {
      dataLayer: 'building',
      minzoom: 13,
      symbolizer: new Polygon({
        fill: '#d9d0c9',
        stroke: '#c4b6ab',
        width: 0.5,
      }),
    },
    {
      dataLayer: 'transportation',
      symbolizer: new Line({
        color: '#888888',
        width: 1,
        dash: [3, 2],
      }),
      filter: classIs('rail'),
    },
    {
      dataLayer: 'transportation',
      symbolizer: new Line({
        color: '#b8a58f',
        width: (zoom, feature) => roadWidth(feature?.props.class, zoom) + 1,
      }),
      filter: (zoom, feature) => roadWidth(feature.props.class, zoom) > 0,
    },
    {
      dataLayer: 'transportation',
      symbolizer: new Line({
        color: '#ffffff',
        width: (zoom, feature) => roadWidth(feature?.props.class, zoom),
      }),
      filter: (zoom, feature) => roadWidth(feature.props.class, zoom) > 0,
    },
    {
      dataLayer: 'transportation',
      symbolizer: new Line({ color: '#555555', width: 1.5 }),
      filter: classIs('pier'),
    },
    {
      dataLayer: 'boundary',
      symbolizer: new Line({ color: '#9b6fa0', width: 1, dash: [4, 3] }),
      filter: (_zoom, feature) => Number(feature.props.admin_level) <= 2,
    },
  ];
}

/**
 * The names written on the map, in the font of the phone: nothing to download.
 * @param library - The drawing library.
 * @returns The rules.
 */
export function offlineLabelRules({
  CenteredTextSymbolizer: Text,
}: Pick<Library, 'CenteredTextSymbolizer'>): ProtomapsLeaflet.LabelRule[] {
  const text = (fill: string, font: string) =>
    new Text({ labelProps: NAMES, fill, stroke: '#ffffff', width: 2, font });
  return [
    {
      dataLayer: 'water_name',
      symbolizer: text('#2a6f97', `italic 600 14px ${FONT}`),
    },
    {
      dataLayer: 'place',
      symbolizer: text('#222222', `600 13px ${FONT}`),
      filter: (zoom, feature) => placeShows(feature.props.class, zoom),
    },
    {
      dataLayer: 'mountain_peak',
      minzoom: 11,
      symbolizer: text('#6b4f2a', `12px ${FONT}`),
    },
    {
      dataLayer: 'poi',
      minzoom: 13,
      symbolizer: text('#2a6f97', `12px ${FONT}`),
      filter: classIs('harbor', 'ferry_terminal'),
    },
  ];
}
