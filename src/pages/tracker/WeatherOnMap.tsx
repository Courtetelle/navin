import { useSignals } from '@preact/signals-react/runtime';
import type { LayerGroup, Map as LeafletMap, TileLayer } from 'leaflet';
import { useEffect } from 'react';

import { leaflet } from '../../features/map/leaflet.ts';
import { mapBearing } from '../../features/map/mapOrientation.ts';
import { tracker } from '../../features/map/trackerState.ts';
import type { Area, Failure, Grid } from '../../features/onwater/mapWeather.ts';
import {
  MOST_POINTS,
  RAIN_NATIVE_ZOOM,
  arrowSvg,
  barbSvg,
  cellHalf,
  currentShown,
  fetchRainFrames,
  fetchSeaGrid,
  fetchWindGrid,
  gridPoints,
  hourRank,
  isSlack,
  localModel,
  rainColor,
  rainTileUrl,
  seaPoints,
  slackSvg,
  straitPoints,
  waveLabelHtml,
  windColor,
} from '../../features/onwater/mapWeather.ts';
import { onLake } from '../../features/onwater/onLake.ts';
import { landTest } from '../../features/onwater/shoreFar.ts';
import { destination } from '../../lib/geo.ts';
import { boatPlace, mapPlace } from '../meteo/boatPlace.ts';

import { liveOnMap, liveOnMapAround, liveZoneArea } from './liveOnMap.ts';
import type { WeatherLayers, WeatherRead } from './weatherLayers.ts';
import {
  forecastStep,
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
const CURRENT_COLOR = '#a1006b';

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
const MARK_PX = 90;

/**
 * How many points the screen holds for an area without the marks
 * covering each other.
 * @param map - The map.
 * @param area - The area.
 * @param fit - Zoom to fit the area (the circle of LiveMétéo).
 * @returns The number of points, 4 to 20.
 */
function pointsFor(map: LeafletMap, area: Area, fit: boolean): number {
  const L = leaflet();
  const box = L.latLngBounds([area.south, area.west], [area.north, area.east]);
  const zoom = fit ? map.getBoundsZoom(box) : map.getZoom();
  const sw = map.project(box.getSouthWest(), zoom);
  const ne = map.project(box.getNorthEast(), zoom);
  const cols = Math.max(2, Math.round(Math.abs(ne.x - sw.x) / MARK_PX));
  const rows = Math.max(2, Math.round(Math.abs(sw.y - ne.y) / MARK_PX));
  return Math.min(MOST_POINTS, cols * rows);
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
          56,
        );
        const gust = point.gust[rank] ?? Number.NaN;
        const gustText =
          Number.isFinite(gust) && gust >= speed + 5
            ? `<small>${Math.round(gust)}</small>`
            : '';
        addMark(
          layer,
          point.lat,
          point.lon,
          `<span class="wx-lbl" style="color:${color}">${Math.round(speed)}${gustText}</span>`,
          40,
          0,
          22,
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
        if (layers.waves && Number.isFinite(height) && Number.isFinite(from)) {
          addMark(
            layer,
            point.lat,
            point.lon,
            `${arrowSvg(from + 180 + turn, height / WAVE_FULL_M, WAVE_COLOR, true)}${waveLabelHtml(height)}`,
            60,
            -18,
            0,
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
        if (isSlack(point.current, rank)) {
          // Slack water: a dashed ring, no arrow, the word in full.
          addMark(
            layer,
            point.lat,
            point.lon,
            `${slackSvg(CURRENT_COLOR)}<span class="wx-lbl wx-cur wx-slack">étale</span>`,
            60,
            18,
            0,
          );
        } else if (Number.isFinite(toward)) {
          addMark(
            layer,
            point.lat,
            point.lon,
            `${arrowSvg(toward + turn, speed / CURRENT_FULL_KN, CURRENT_COLOR, false)}<span class="wx-lbl wx-cur">${decimal(speed)} nd</span>`,
            60,
            18,
            0,
          );
        }
      }
    }
  }
  return drawnAt;
}

/**
 * Over the map of LiveMétéo: the wind of the local model at the hour chosen
 * as barbs (the knots below, gusts in small), the waves as a wavy arrow
 * going where they go with their height, the currents as a purple arrow
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
  const layers = weatherLayers.value;
  const step = forecastStep.value;
  const on = asked > 0;
  const lake = onLake();
  const drawn = weatherRead.value;
  const mapReady = weatherMapReady.value;

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
  // read, and every 30 minutes.
  useEffect(() => {
    if (!on || !mapReady) return undefined;
    const map = tracker.current?.map;
    if (!map) return undefined;
    let closed = false;
    let readArea: Area | null = null;
    const areaNow = (): Area => {
      if (around) {
        // The Météo-France zones shown, else 30 NM around the boat.
        if (zoneArea) return zoneArea;
        const middle = boatPlace();
        return areaAround(middle.lat, middle.lon, 30);
      }
      return areaOfMap(map);
    };
    const read = (force: boolean) => {
      const area = areaNow();
      if (!force && readArea && holds(readArea, area)) return;
      readArea = area;
      const most = pointsFor(map, area, around);
      const points = gridPoints(area, most);
      const middle = around ? boatPlace() : mapPlace();
      const chosen = localModel(middle);
      weatherModel.value = chosen.name;
      void fetchWindGrid(points, chosen.id).then((wind) => {
        if (!closed) weatherRead.value = { ...weatherRead.peek(), wind };
      });
      if (lake) {
        weatherRead.value = { ...weatherRead.peek(), sea: null };
        return;
      }
      // The sea only where there is sea: points on land have no waves.
      void landTest()
        .then((isLand) =>
          fetchSeaGrid([
            ...seaPoints(area, most, isLand),
            ...straitPoints(area),
          ]),
        )
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
  }, [on, mapReady, around, zoneArea, lake]);

  // The marks of the hour asked, drawn again when the map turns.
  useEffect(() => {
    if (!on || !mapReady) return undefined;
    const map = tracker.current?.map;
    if (!map) return undefined;
    const layer = leaflet().layerGroup().addTo(map);
    const ms =
      Math.round(Date.now() / 3_600_000) * 3_600_000 + step * 3_600_000;
    const draw = () => {
      weatherShownAt.value = drawGrids(layer, map, drawn, layers, ms, step > 0);
    };
    draw();
    map.on('rotate', draw);
    return () => {
      map.off('rotate', draw);
      layer.remove();
    };
  }, [on, mapReady, drawn, layers, step]);

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

  return null;
}
