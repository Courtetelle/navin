import {
  nmeaFresh,
  nmeaLink,
  nmeaWind,
} from '../../features/tracking/index.ts';
import { fr, pad } from '../../lib/format.ts';
import { fmtPos } from '../../lib/geo.ts';

const NO_VALUE = '–';

/**
 * Values of the instruments grid (legacy `nmCells`); a value older than 15 s
 * shows a dash.
 * @returns Label and text of each cell.
 */
export function nmeaCells(): Array<[string, string]> {
  const { lat, lon, sog, cog, stw, hdg, aws, awa, depth, wtemp } =
    nmeaLink.live;
  const angle = awa ?? 0;
  const wind = nmeaWind();
  const speed = (value: number | undefined) =>
    value === undefined ? NO_VALUE : `${fr(value)} nd`;
  const course = (value: number | undefined) =>
    value === undefined ? NO_VALUE : `${pad(Math.round(value) % 360, 3)}°`;
  return [
    [
      'Position',
      nmeaFresh('lat') && lat !== undefined && lon !== undefined
        ? fmtPos({ lat, lon })
        : NO_VALUE,
    ],
    ['Vitesse fond', nmeaFresh('sog') ? speed(sog) : NO_VALUE],
    ['Cap fond', nmeaFresh('cog') ? course(cog) : NO_VALUE],
    ['Vitesse surface', nmeaFresh('stw') ? speed(stw) : NO_VALUE],
    ['Cap compas', nmeaFresh('hdg') ? course(hdg) : NO_VALUE],
    [
      'Vent apparent',
      nmeaFresh('aws')
        ? `${speed(aws)} · ${Math.round(Math.abs(angle))}° ${angle < 0 ? 'bâbord' : 'tribord'}`
        : NO_VALUE,
    ],
    [
      'Vent réel',
      wind
        ? `${fr(wind.tws)} nd · du ${pad(Math.round(wind.twd) % 360, 3)}°`
        : NO_VALUE,
    ],
    [
      'Profondeur',
      nmeaFresh('depth') && depth !== undefined ? `${fr(depth)} m` : NO_VALUE,
    ],
    [
      'Eau',
      nmeaFresh('wtemp') && wtemp !== undefined ? `${fr(wtemp)} °C` : NO_VALUE,
    ],
  ];
}
