import { num } from '../../lib/format.ts';

import type { TrackSample } from './detector.ts';

/** Points and name of an imported track. */
export interface ParsedTrack {
  pts: TrackSample[];
  name: string;
}

/**
 * Parse a GPX file (legacy `parseGpx`): track points, else route points.
 * @param text - File content.
 * @returns Points with valid coordinates, `t` being `NaN` without time.
 * @throws When the XML is invalid.
 */
export function parseGpx(text: string): ParsedTrack {
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('xml');
  let nodes = [...document.querySelectorAll('trkpt')];
  if (nodes.length === 0) nodes = [...document.querySelectorAll('rtept')];
  const points: TrackSample[] = [];
  for (const node of nodes) {
    const point = gpxSample(
      (name) => childText(node, name),
      node.getAttribute('lat'),
      node.getAttribute('lon'),
    );
    if (Number.isFinite(point.lat) && Number.isFinite(point.lon)) {
      points.push(point);
    }
  }
  const name = document.querySelector('name')?.textContent ?? '';
  return { pts: points, name };
}

/**
 * One track point. NavimetriX extensions: `sog`, `tws` in knots, `cog`, `twd`.
 * Standard GPX: `speed` in m/s, `course`.
 * @param read - Reads the text of a child element by local name.
 * @param lat - `lat` attribute.
 * @param lon - `lon` attribute.
 * @returns The sample.
 */
export function gpxSample(
  read: (name: string) => string | null,
  lat: string | null,
  lon: string | null,
): TrackSample {
  const time = read('time');
  const knots = num(read('sog'));
  const speed = num(read('speed'));
  const course = num(read('cog')) ?? num(read('course'));
  return {
    t: time ? Date.parse(time) : Number.NaN,
    lat: Number(lat),
    lon: Number(lon),
    sog: sampleSpeed(knots, speed),
    cog: course === null ? null : Math.round(course) % 360,
    twd: num(read('twd')),
    tws: num(read('tws')),
  };
}

function sampleSpeed(knots: number | null, speed: number | null) {
  if (knots !== null) return Math.round(knots * 10) / 10;
  return speed === null ? null : Math.round(speed * 19.4384) / 10;
}

function childText(element: Element, name: string): string | null {
  for (const child of element.querySelectorAll('*')) {
    if (child.localName === name) return (child.textContent ?? '').trim();
  }
  return null;
}
