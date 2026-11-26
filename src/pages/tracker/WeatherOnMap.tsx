import { useSignals } from '@preact/signals-react/runtime';
import type {
  ImageOverlay,
  LayerGroup,
  Map as LeafletMap,
  TileLayer,
} from 'leaflet';
import { useEffect, useState } from 'react';

import { leaflet } from '../../features/map/leaflet.ts';
import { mapBearing } from '../../features/map/mapOrientation.ts';
import {
  routingPlay,
  routingRain,
  shownRouting,
} from '../../features/map/routingState.ts';
import { tracker } from '../../features/map/trackerState.ts';
import type { Area, Failure, Grid } from '../../features/onwater/mapWeather.ts';
import {
  BARB_PX,
  RAIN_NATIVE_ZOOM,
  arrowSvg,
  barbLabelOffset,
  barbSvg,
  cellHalf,
  currentShown,
  currentWindColor,
  fetchRainFrames,
  fetchSeaGrid,
  fetchWindGrid,
  fittedLattice,
  hourRank,
  isSlack,
  labelWidth,
  localModel,
  nearestPoint,
  rainColor,
  rainTileUrl,
  roundStep,
  seaPoints,
  slackSvg,
  straitPoints,
  waveLabelHtml,
  windColor,
} from '../../features/onwater/mapWeather.ts';
import { onLake } from '../../features/onwater/onLake.ts';
import {
  fetchRainIndex,
  rainFileAt,
  rainImageUrl,
} from '../../features/onwater/rainAhead.ts';
import { landTest } from '../../features/onwater/shoreFar.ts';
import { steepnessOf } from '../../features/onwater/steepness.ts';
import { stationInZones } from '../../features/zones/meteoZones.ts';
import type { LatLon } from '../../lib/geo.ts';
import { destination } from '../../lib/geo.ts';
import { boatPlace, mapPlace } from '../meteo/boatPlace.ts';

import {
  liveOnMap,
  liveOnMapAround,
  liveZoneArea,
  liveZonesShown,
} from './liveOnMap.ts';
import type { WeatherLayers, WeatherRead } from './weatherLayers.ts';
import {
  forecastStep,
  rainAheadSource,
  rainRead,
  weatherLayers,
  weatherMapReady,
  weatherModel,
  weatherRead,
  weatherShownAt,
} from './weatherLayers.ts';

/** The forecast is read again this often (the reply is kept 30 minutes). */
const FORECAST_MS = 30 * 60_000;
/** A new radar image every 10 minutes. */
const RAIN_MS = 10 * 60_000;
/** The map of NavIn is looked for this often until it is built. */
const WAIT_MS = 300;
/** The waves drawn full size at this height, metres. */
const WAVE_FULL_M = 4;
/** The currents drawn full size at this speed, knots. */
const CURRENT_FULL_KN = 3;
const WAVE_COLOR = '#0a4c8c';
const CURRENT_COLOR = '#000';

function decimal(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

function areaAround(lat: number, lon: number, nm: number): Area {
  const north = destination({ lat, lon }, 0, nm);
  const east = destination({ lat, lon }, 90, nm);
  return {
    south: 2 * lat - north.lat,
    north: north.lat,
    west: 2 * lon - east.lon,
    east: east.lon,
  };
}

function areaOfMap(map: LeafletMap): Area {
  const bounds = map.getBounds();
  return {
    south: bounds.getSouth(),
    west: bounds.getWest(),
    north: bounds.getNorth(),
    east: bounds.getEast(),
  };
}

/**
 * The part of an area inside another.
 * @param area - The area.
 * @param seen - The other (the map shown).
 * @returns The common part, null when they do not meet.
 */
function clipArea(area: Area, seen: Area): Area | null {
  const south = Math.max(area.south, seen.south);
  const north = Math.min(area.north, seen.north);
  const west = Math.max(area.west, seen.west);
  const east = Math.min(area.east, seen.east);
  return south < north && west < east ? { south, north, west, east } : null;
}

/** Whether an area holds another, the second shrunk a little. */
function holds(outer: Area, inner: Area): boolean {
  const latPad = (inner.north - inner.south) * 0.1;
  const lonPad = (inner.east - inner.west) * 0.1;
  return (
    outer.south <= inner.south + latPad &&
    outer.north >= inner.north - latPad &&
    outer.west <= inner.west + lonPad &&
    outer.east >= inner.east - lonPad
  );
}

/** Marks of the wind this far apart on the screen at least, px. */
/** At least this far apart: no label of a point on a symbol of another. */
const MARK_PX = 110;
/** The wave left and the current right of their point, px. */
const SEA_SIDE = 22;
/** Their labels above and below, px. */
const SEA_LABEL = 31;

/**
 * The spacing of the marks for the zoom of the map: about {@link MARK_PX}
 * on the screen, so that zooming in shows more points and zooming out
 * fewer.
 * @param map - The map.
 * @returns Degrees, a round spacing.
 */
function stepForZoom(map: LeafletMap): number {
  const middle = map.getCenter();
  const zoom = map.getZoom();
  const here = map.project(middle, zoom);
  const east = map.project([middle.lat, middle.lng + 1], zoom);
  const perDegree = Math.abs(east.x - here.x) || 1;
  return roundStep(MARK_PX / perDegree);
}

function icon(html: string, size: number, dx = 0, dy = 0) {
  return leaflet().divIcon({
    className: 'wx-mk',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2 - dx, size / 2 - dy],
  });
}

function addMark(
  layer: LayerGroup,
  lat: number,
  lon: number,
  html: string,
  size: number,
  dx = 0,
  dy = 0,
): void {
  leaflet()
    .marker([lat, lon], {
      icon: icon(html, size, dx, dy),
      interactive: false,
      keyboard: false,
      pane: 'wxMarks',
    })
    .addTo(layer);
}

/**
 * A label alone, its centre at a distance from its point (px, y down).
 */
function addLabel(
  layer: LayerGroup,
  lat: number,
  lon: number,
  html: string,
  dx: number,
  dy: number,
): void {
  leaflet()
    .marker([lat, lon], {
      icon: leaflet().divIcon({
        className: 'wx-mk wx-tag',
        html,
        iconSize: [0, 0],
        iconAnchor: [-dx, -dy],
      }),
      interactive: false,
      keyboard: false,
      pane: 'wxMarks',
    })
    .addTo(layer);
}

function isGrid<T>(value: Grid<T> | Failure | null): value is Grid<T> {
  return value != null && 'hours' in value;
}

/**
 * Draw the wind, the waves and the currents of the hour asked.
 * @param layer - The layer, emptied first.
 * @param map - The map (its bearing).
 * @param data - The grids read.
 * @param layers - The layers on.
 * @param ms - The hour asked.
 * @returns The hour drawn, null when out of the forecast.
 */
function drawGrids(
  layer: LayerGroup,
  map: LeafletMap,
  data: WeatherRead,
  layers: WeatherLayers,
  ms: number,
  rainAhead = false,
): number | null {
  layer.clearLayers();
  const turn = mapBearing(map);
  let drawnAt: number | null = null;
  const wind = isGrid(data.wind) ? data.wind : null;
  if (wind && layers.rain && rainAhead) {
    // The radar only shows the past: the hours ahead take the rain of the
    // model, a cell of colour around each point, in the colours of the radar.
    const rank = hourRank(wind.hours, ms);
    const half = cellHalf(wind.points);
    if (rank >= 0) {
      drawnAt = wind.hours[rank] ?? null;
      for (const point of wind.points) {
        const color = rainColor(point.rain[rank] ?? Number.NaN);
        if (!color) continue;
        leaflet()
          .rectangle(
            [
              [point.lat - half.lat, point.lon - half.lon],
              [point.lat + half.lat, point.lon + half.lon],
            ],
            {
              pane: 'wxRain',
              stroke: false,
              fillColor: color,
              fillOpacity: 0.45,
              interactive: false,
            },
          )
          .addTo(layer);
      }
    }
  }
  if (wind && layers.wind) {
    const rank = hourRank(wind.hours, ms);
    if (rank >= 0) {
      drawnAt = wind.hours[rank] ?? null;
      for (const point of wind.points) {
        const speed = point.speed[rank] ?? Number.NaN;
        const from = point.from[rank] ?? Number.NaN;
        if (!Number.isFinite(speed) || !Number.isFinite(from)) continue;
        const color = windColor(speed);
        addMark(
          layer,
          point.lat,
          point.lon,
          barbSvg(speed, from + turn, color),
          BARB_PX,
        );
        const gust = point.gust[rank] ?? Number.NaN;
        const gusty = Number.isFinite(gust) && gust >= speed + 5;
        const gustText = gusty ? `<small>${Math.round(gust)}</small>` : '';
        // The label where the barb is not: on the side the wind blows to.
        const knots = String(Math.round(speed));
        const width =
          labelWidth(knots.length) +
          (gusty ? 6 * (String(Math.round(gust)).length + 1) + 2 : 0);
        const away = barbLabelOffset(from + turn, width, 17);
        addLabel(
          layer,
          point.lat,
          point.lon,
          `<span class="wx-lbl" style="color:${color}">${knots}${gustText}</span>`,
          away.dx,
          away.dy,
        );
      }
    }
  }
  const sea = isGrid(data.sea) ? data.sea : null;
  if (sea && (layers.waves || layers.currents)) {
    const rank = hourRank(sea.hours, ms);
    if (rank >= 0) {
      drawnAt ??= sea.hours[rank] ?? null;
      for (const point of sea.points) {
        const height = point.height[rank] ?? Number.NaN;
        const from = point.from[rank] ?? Number.NaN;
        // The arrow in the colour of the steepness (height against period).
        const steep = steepnessOf(height, point.period[rank]);
        if (layers.waves && Number.isFinite(height) && Number.isFinite(from)) {
          addMark(
            layer,
            point.lat,
            point.lon,
            arrowSvg(
              from + 180 + turn,
              height / WAVE_FULL_M,
              steep?.steep.color ?? WAVE_COLOR,
              true,
            ),
            60,
            -SEA_SIDE,
            0,
          );
          addLabel(
            layer,
            point.lat,
            point.lon,
            waveLabelHtml(height),
            0,
            -SEA_LABEL,
          );
        }
        const speed = point.current[rank] ?? Number.NaN;
        const toward = point.toward[rank] ?? Number.NaN;
        if (
          !layers.currents ||
          !Number.isFinite(speed) ||
          !currentShown(point)
        ) {
          continue;
        }
        // Wind with or against the current: from green to bright red.
        const near = wind
          ? nearestPoint(wind.points, point.lat, point.lon, 1.5)
          : null;
        const windRank = wind ? hourRank(wind.hours, ms) : -1;
        const color = near
          ? currentWindColor(
              toward,
              near.from[windRank] ?? Number.NaN,
              near.speed[windRank] ?? Number.NaN,
            )
          : CURRENT_COLOR;
        if (isSlack(point.current, rank)) {
          // Slack water: a dashed ring, no arrow, the word in full.
          addMark(
            layer,
            point.lat,
            point.lon,
            slackSvg(CURRENT_COLOR),
            60,
            SEA_SIDE,
            0,
          );
          addLabel(
            layer,
            point.lat,
            point.lon,
            '<span class="wx-lbl wx-cur wx-slack">étale</span>',
            0,
            SEA_LABEL,
          );
        } else if (Number.isFinite(toward)) {
          addMark(
            layer,
            point.lat,
            point.lon,
            `${arrowSvg(
              toward + turn,
              speed / CURRENT_FULL_KN,
              color,
              false,
              // A black edge: not taken for the wavy arrow of the waves.
              color === CURRENT_COLOR ? '#fff' : '#000',
            )}`,
            60,
            SEA_SIDE,
            0,
          );
          addLabel(
            layer,
            point.lat,
            point.lon,
            `<span class="wx-lbl wx-cur">${decimal(speed)} nd</span>`,
            0,
            SEA_LABEL,
          );
        }
      }
    }
  }
  return drawnAt;
}

/** Over a routing: the rain alone. */
const RAIN_ONLY: WeatherLayers = {
  wind: false,
  waves: false,
  currents: false,
  rain: true,
  stations: false,
};

/**
 * The hour of the forecast for the boat played: hours after the hour now.
 * @param ms - The time played, `null` when not played (the hour now).
 * @returns Hours ahead, 0 at least.
 */
function playStep(ms: number | null): number {
  if (ms === null) return 0;
  const hour = Math.round(Date.now() / 3_600_000) * 3_600_000;
  return Math.max(0, Math.round((ms - hour) / 3_600_000));
}

/**
 * Over the map of LiveMétéo: the wind of the local model at the hour chosen
 * as barbs (the knots below, gusts in small), the waves as a wavy arrow
 * going where they go with their height, the currents as a black arrow
 * (Atlantic side everywhere, the Mediterranean in its known straits), and the
 * rain of the radar live, shaded by its strength. The buttons at the right of
 * Météo (LiveButtons) turn each one on or off and step the hour.
 * @returns Nothing: it draws on the map.
 */
export function WeatherOnMap() {
  useSignals();
  const asked = liveOnMap.value;
  const around = liveOnMapAround.value;
  const zoneArea = liveZoneArea.value;
  // A routing on the map: only the route and its marks are shown, and the
  // rain forecast when asked over it, at the hour of the boat played.
  const routed = shownRouting.value !== null;
  const play = routingPlay.value;
  const layers = routed ? RAIN_ONLY : weatherLayers.value;
  const step = routed ? playStep(play?.ms ?? null) : forecastStep.value;
  const on = routed ? routingRain.value : asked > 0;
  const lake = onLake();
  const drawn = weatherRead.value;
  const mapReady = weatherMapReady.value;
  // The hour shown has the fine rain of the model: no cells around the points.
  const [fineRain, setFineRain] = useState(false);

  // The map of NavIn: waited for, then its panes made once.
  useEffect(() => {
    if (!on) return undefined;
    let wait: ReturnType<typeof setTimeout> | undefined;
    const look = () => {
      const map = tracker.current?.map;
      if (!map) {
        wait = setTimeout(look, WAIT_MS);
        return;
      }
      if (!map.getPane('wxRain')) {
        // In the pane that turns and pans with the map (leaflet-rotate): a
        // pane of its own outside it stays where the map was first shown,
        // and the rain is seen a moment, then lost off the zone.
        const rainPane = map.createPane(
          'wxRain',
          map.getPane('rotatePane') ?? undefined,
        );
        rainPane.style.zIndex = '350';
        rainPane.style.pointerEvents = 'none';
      }
      if (!map.getPane('wxMarks')) {
        const marks = map.createPane(
          'wxMarks',
          map.getPane('norotatePane') ?? undefined,
        );
        marks.style.zIndex = '580';
        marks.style.pointerEvents = 'none';
      }
      weatherMapReady.value = Date.now();
    };
    look();
    return () => {
      clearTimeout(wait);
      weatherMapReady.value = 0;
    };
  }, [on, asked]);

  // The forecast of the grid: read at start, when the map leaves the area
  // read, and every 30 minutes (not over a routing: its rain only).
  useEffect(() => {
    if (!on || !mapReady || routed) return undefined;
    const map = tracker.current?.map;
    if (!map) return undefined;
    let closed = false;
    let readArea: Area | null = null;
    let readZoom = -1;
    // The part of the map shown, within the zones chosen: the points follow
    // the zoom (closer in, closer together) and stay in the zones.
    const areaNow = (): Area => {
      const seen = areaOfMap(map);
      if (!around) return seen;
      // The Météo-France zones shown, else 30 NM around the boat.
      const middle = boatPlace();
      const base = zoneArea ?? areaAround(middle.lat, middle.lon, 30);
      return clipArea(base, seen) ?? base;
    };
    const read = (force: boolean) => {
      const area = areaNow();
      const zoom = map.getZoom();
      if (!force && readArea && zoom === readZoom && holds(readArea, area)) {
        return;
      }
      readArea = area;
      readZoom = zoom;
      const zones = around ? liveZonesShown.peek() : [];
      const inside = (point: LatLon): boolean =>
        zones.length === 0 || stationInZones(zones, point.lat, point.lon);
      const { step, points } = fittedLattice(area, stepForZoom(map), inside);
      const middle = around ? boatPlace() : mapPlace();
      const chosen = localModel(middle);
      weatherModel.value = chosen.name;
      if (points.length > 0) {
        void fetchWindGrid(points, chosen.id).then((wind) => {
          if (!closed) weatherRead.value = { ...weatherRead.peek(), wind };
        });
      } else {
        weatherRead.value = { ...weatherRead.peek(), wind: null };
      }
      if (lake) {
        weatherRead.value = { ...weatherRead.peek(), sea: null };
        return;
      }
      // The sea only where there is sea: points on land have no waves.
      void landTest()
        .then((isLand) => {
          const sea = [
            ...seaPoints(area, step, isLand, inside),
            ...straitPoints(area).filter(inside),
          ];
          return sea.length > 0 ? fetchSeaGrid(sea) : null;
        })
        .then((sea) => {
          if (!closed) weatherRead.value = { ...weatherRead.peek(), sea };
        });
    };
    read(true);
    const moved = () => read(false);
    map.on('moveend', moved);
    const timer = setInterval(() => read(true), FORECAST_MS);
    return () => {
      closed = true;
      map.off('moveend', moved);
      clearInterval(timer);
      weatherRead.value = { wind: null, sea: null };
    };
  }, [on, mapReady, around, zoneArea, lake, routed]);

  // The marks of the hour asked, drawn again when the map turns.
  useEffect(() => {
    if (!on || !mapReady || routed) return undefined;
    const map = tracker.current?.map;
    if (!map) return undefined;
    const layer = leaflet().layerGroup().addTo(map);
    const ms =
      Math.round(Date.now() / 3_600_000) * 3_600_000 + step * 3_600_000;
    const draw = () => {
      weatherShownAt.value = drawGrids(
        layer,
        map,
        drawn,
        layers,
        ms,
        step > 0 && !fineRain,
      );
    };
    draw();
    map.on('rotate', draw);
    return () => {
      map.off('rotate', draw);
      layer.remove();
    };
  }, [on, mapReady, drawn, layers, step, fineRain, routed]);

  // The rain of the radar: the newest image, read every 10 minutes; only
  // for the hour now (the radar has no future: the hours ahead take the
  // rain of the model, drawn with the marks).
  const radarNow = step === 0;
  useEffect(() => {
    if (!on || !mapReady || !layers.rain || !radarNow) return undefined;
    const map = tracker.current?.map;
    if (!map) return undefined;
    let closed = false;
    let tiles: TileLayer | null = null;
    const read = () => {
      void fetchRainFrames().then((frames) => {
        if (closed) return;
        rainRead.value = frames;
        if ('error' in frames) return;
        const newest = frames.frames.at(-1);
        if (!newest) return;
        const next = leaflet().tileLayer(rainTileUrl(frames, newest.path), {
          pane: 'wxRain',
          opacity: 0.65,
          maxNativeZoom: RAIN_NATIVE_ZOOM,
          maxZoom: 20,
          tileSize: 256,
          attribution:
            'Radar <a href="https://www.rainviewer.com">RainViewer</a>',
        });
        next.addTo(map);
        // The old image leaves once the new one is laid: no blink.
        const old = tiles;
        tiles = next;
        next.once('load', () => old?.remove());
        setTimeout(() => old?.remove(), 5000);
      });
    };
    read();
    const timer = setInterval(read, RAIN_MS);
    return () => {
      closed = true;
      clearInterval(timer);
      tiles?.remove();
      rainRead.value = null;
    };
  }, [on, mapReady, layers.rain, radarNow]);

  // The rain ahead: the hour of the model ICON-EU, smoothed and shaded as
  // the radar over the whole map; without it, cells around the wind points.
  useEffect(() => {
    if (!on || !mapReady || !layers.rain || radarNow) return undefined;
    const map = tracker.current?.map;
    if (!map) return undefined;
    let closed = false;
    let overlay: ImageOverlay | null = null;
    let url: string | null = null;
    const ms =
      Math.round(Date.now() / 3_600_000) * 3_600_000 + step * 3_600_000;
    void fetchRainIndex().then(async (index) => {
      const file = index ? rainFileAt(index, ms) : null;
      if (closed || !index || !file) return;
      const made = await rainImageUrl(index, file);
      if (closed || !made) {
        if (made) URL.revokeObjectURL(made);
        return;
      }
      url = made;
      overlay = leaflet()
        .imageOverlay(
          made,
          [
            [index.lat[0], index.lon[0]],
            [index.lat[1], index.lon[1]],
          ],
          {
            pane: 'wxRain',
            opacity: 0.65,
            interactive: false,
            attribution: `Pluie prévue ${index.model} (DWD)`,
          },
        )
        .addTo(map);
      rainAheadSource.value = `${index.model} (DWD, 6,5 km)`;
      setFineRain(true);
    });
    return () => {
      closed = true;
      overlay?.remove();
      if (url) URL.revokeObjectURL(url);
      rainAheadSource.value = null;
      setFineRain(false);
    };
  }, [on, mapReady, layers.rain, radarNow, step]);

  return null;
}
