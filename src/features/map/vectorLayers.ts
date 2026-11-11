import type { LayerGroup, Renderer } from 'leaflet';

import type { LatLngPair } from './constants.ts';
import { escapeHtml } from './escapeHtml.ts';
import { leaflet } from './leaflet.ts';
import type { LemanVector } from './lemanVector.ts';
import type { OsmFeature } from './osmFeatures.ts';
import { seamarkColour, seamarkPopup } from './osmFeatures.ts';
import { inShore } from './shore.ts';

/** The areas of the buoyage, for the information of a point. */
let areas: Array<{ ring: LatLngPair[]; html: string }> = [];

/**
 * The areas of the buoyage a point is in (restricted zones, fairways,
 * harbours), for the information of the point: their surface leaves the taps
 * to the map.
 * @param lat - Latitude of the point.
 * @param lon - Its longitude.
 * @returns Their descriptions, in HTML.
 */
export function areaNotesAt(lat: number, lon: number): string[] {
  return areas
    .filter((area) => inShore([area.ring], lat, lon))
    .map((area) => area.html);
}

interface PointFeature {
  feature: OsmFeature;
  position: LatLngPair;
  colours?: string[] | null;
}

/**
 * Layer of the buoyage and harbours (legacy `lemanVecLayer`), in SVG: a Leaflet
 * canvas does not follow the map when it turns.
 * @param vector - The features.
 * @returns The layer, or `null` without features.
 */
export function lemanVecLayer(
  vector: Pick<LemanVector, 'feats'> | null,
): LayerGroup | null {
  if (!vector || vector.feats.length === 0) return null;
  const L = leaflet();
  const renderer = L.svg({ padding: 0.3 });
  const group = L.layerGroup();
  const points: PointFeature[] = [];
  const found: typeof areas = [];
  for (const feature of vector.feats) {
    const type = feature.t['seamark:type'] ?? '';
    if (feature.k === 'pier' && feature.g !== 'p') {
      L.polyline(feature.c as LatLngPair[], {
        renderer,
        bubblingMouseEvents: false,
        color: '#5b4636',
        weight: 4,
        opacity: 0.9,
      })
        .bindPopup(seamarkPopup(feature))
        .addTo(group);
      continue;
    }
    if (feature.g === 'a' || feature.g === 'm') {
      const zone = /restricted|fairway|anchorage/.test(type);
      // Drawn only: a tap inside is a tap on the map (the cross), which
      // tells the area in the information of the point.
      L.polygon(feature.c as LatLngPair[], {
        renderer,
        interactive: false,
        color: zone ? '#c0006a' : '#0050d0',
        weight: 2,
        dashArray: zone ? '6 6' : undefined,
        fillOpacity: zone ? 0.06 : 0.1,
      }).addTo(group);
      found.push({
        ring: feature.c as LatLngPair[],
        html: seamarkPopup(feature),
      });
      if (feature.k === 'harbour') {
        const center = L.polygon(feature.c as LatLngPair[])
          .getBounds()
          .getCenter();
        points.push({ feature, position: [center.lat, center.lng] });
      }
      continue;
    }
    if (feature.g === 'l') {
      L.polyline(feature.c as LatLngPair[], {
        renderer,
        bubblingMouseEvents: false,
        color: /cable|pipeline/.test(type) ? '#8a2be2' : '#c0006a',
        weight: 2,
        dashArray: '6 6',
      })
        .bindPopup(seamarkPopup(feature))
        .addTo(group);
      continue;
    }
    points.push({
      feature,
      position: feature.c as LatLngPair,
      colours: seamarkColour(feature.t),
    });
  }
  for (const point of points) addPoint(group, renderer, point);
  areas = found;
  return group;
}

function addPoint(
  group: LayerGroup,
  renderer: Renderer,
  { feature, position, colours }: PointFeature,
): void {
  const L = leaflet();
  const type = feature.t['seamark:type'] ?? '';
  if (feature.k === 'ferry') {
    const operator = feature.t.operator
      ? ` · ${escapeHtml(feature.t.operator)}`
      : '';
    L.marker(position, {
      icon: L.divIcon({
        className: 'vec-port vec-ferry',
        html: '⛴',
        iconSize: [26, 26],
      }),
    })
      .bindPopup(
        `<b>${escapeHtml(feature.t.name || 'Débarcadère')}</b><br>Débarcadère${operator}`,
      )
      .addTo(group);
    return;
  }
  if (
    feature.k === 'harbour' ||
    type === 'harbour' ||
    type === 'small_craft_facility'
  ) {
    L.marker(position, {
      icon: L.divIcon({
        className: 'vec-port',
        html: '⚓',
        iconSize: [26, 26],
      }),
    })
      .bindPopup(seamarkPopup(feature))
      .addTo(group);
    return;
  }
  const light =
    type.startsWith('light') || feature.t['seamark:light:character'];
  const colour = colours?.[0];
  let fill = colour ?? '#9aa5b1';
  if (!colour && light) fill = '#ffd400';
  const radius = markerRadius(type, Boolean(light));
  const ring = colours?.[1];
  L.circleMarker(position, {
    renderer,
    bubblingMouseEvents: false,
    radius,
    color: ring ?? '#000',
    weight: ring ? 4 : 2,
    fillColor: fill,
    fillOpacity: 1,
  })
    .bindPopup(seamarkPopup(feature))
    .addTo(group);
  if (light && colours && fill !== '#ffd400') {
    L.circleMarker(position, {
      renderer,
      bubblingMouseEvents: false,
      radius: radius + 5,
      color: '#ffd400',
      weight: 2,
      fill: false,
      interactive: false,
    }).addTo(group);
  }
}

function markerRadius(type: string, light: boolean): number {
  if (light) return type.includes('major') ? 9 : 7;
  return type.includes('mooring') ? 4 : 6;
}
