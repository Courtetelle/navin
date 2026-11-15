import { state } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import { nearStations } from './euStations.ts';
import { touches } from './moreStations.ts';
import type { WindReading } from './windTypes.ts';

/* eslint-disable @typescript-eslint/naming-convention -- the fields as Rijkswaterstaat names them */

/*
 * The North Sea: the Netherlands (Rijkswaterstaat: the coast, the platforms
 * at sea, the IJsselmeer; no key) and Norway (MET Norway, Frost: its coast
 * stations, with the free client ID of the skipper). Both through the relay:
 * neither lets a page of another site read them.
 */

export const RWS = 'Rijkswaterstaat (Pays-Bas)';
export const FROST = 'MET Norway (Norvège)';

const MS_TO_KN = 3600 / 1852;
/** A measurement older than this is not shown. */
const MAX_AGE_MS = 90 * 60_000;
const WEEK_MS = 7 * 86_400_000;

/** The Netherlands and their sea: south, west, north, east. */
const NETHERLANDS = [50.7, 2, 55.5, 7.3] as const;
/** Norway and its coast. */
const NORWAY = [57.5, 4, 71.5, 31.5] as const;

const RWS_BASE = 'https://ddapi20-waterwebservices.rijkswaterstaat.nl';
const RWS_CATALOG = `${RWS_BASE}/METADATASERVICES/OphalenCatalogus`;
const RWS_LATEST = `${RWS_BASE}/ONLINEWAARNEMINGENSERVICES/OphalenLaatsteWaarnemingen`;
const RWS_PLACES_KEY = 'ldb.rwsWindPlaces';

const FROST_BASE = 'https://frost.met.no';

/** A place measuring wind. */
export interface WindPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

function through(relay: string, url: string): string {
  return `${relay.replace(/\/+$/u, '')}/?url=${encodeURIComponent(url)}`;
}

function savedRelay(): string {
  const value = state.preferences.settings.peek().windAlert?.relayUrl;
  return typeof value === 'string' ? value.trim() : '';
}

/* ------------------------------------------------------- Rijkswaterstaat */

/**
 * The places of Rijkswaterstaat that measure wind, from its catalogue.
 * @param catalog - The reply of `OphalenCatalogus`.
 * @returns The places.
 */
export function rwsPlacesOf(catalog: unknown): WindPlace[] {
  const data = (catalog ?? {}) as {
    AquoMetadataLijst?: Array<{
      AquoMetadata_MessageID?: number;
      Grootheid?: { Code?: string };
    }>;
    AquoMetadataLocatieLijst?: Array<{
      AquoMetaData_MessageID?: number;
      Locatie_MessageID?: number;
    }>;
    LocatieLijst?: Array<{
      Locatie_MessageID?: number;
      Code?: string;
      Naam?: string;
      Lat?: number;
      Lon?: number;
    }>;
  };
  const wind = new Set(
    (data.AquoMetadataLijst ?? [])
      .filter((meta) => meta.Grootheid?.Code === 'WINDSHD')
      .map((meta) => meta.AquoMetadata_MessageID),
  );
  const at = new Set(
    (data.AquoMetadataLocatieLijst ?? [])
      .filter((link) => wind.has(link.AquoMetaData_MessageID))
      .map((link) => link.Locatie_MessageID),
  );
  return (data.LocatieLijst ?? []).flatMap((place) =>
    at.has(place.Locatie_MessageID) &&
    place.Code &&
    Number.isFinite(place.Lat) &&
    Number.isFinite(place.Lon)
      ? [
          {
            id: place.Code,
            name: place.Naam ?? place.Code,
            lat: place.Lat as number,
            lon: place.Lon as number,
          },
        ]
      : [],
  );
}

async function rwsPlaces(relay: string): Promise<WindPlace[]> {
  const kept = store.get<{ at: number; places: WindPlace[] } | null>(
    RWS_PLACES_KEY,
    null,
  );
  if (kept && Date.now() - kept.at < WEEK_MS && kept.places.length > 0) {
    return kept.places;
  }
  const response = await fetch(through(relay, RWS_CATALOG), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      CatalogusFilter: { Grootheden: true, Compartimenten: true },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) return kept?.places ?? [];
  const places = rwsPlacesOf(await response.json());
  if (places.length > 0) store.set(RWS_PLACES_KEY, { at: Date.now(), places });
  return places;
}

interface RwsSeries {
  Locatie?: { Code?: string };
  AquoMetadata?: { Grootheid?: { Code?: string } };
  MetingenLijst?: Array<{
    Tijdstip?: string;
    Meetwaarde?: { Waarde_Numeriek?: number };
  }>;
}

/**
 * The readings of the latest measurements of Rijkswaterstaat: per place
 * the newest wind, gust (strongest 3 s in 10 min) and direction.
 * @param reply - The reply of `OphalenLaatsteWaarnemingen`.
 * @param places - The places asked, with their distance.
 * @param now - Epoch ms.
 * @returns The readings.
 */
export function rwsReadingsOf(
  reply: unknown,
  places: ReadonlyArray<{ station: WindPlace; km: number }>,
  now: number,
): WindReading[] {
  const series = ((reply ?? {}) as { WaarnemingenLijst?: RwsSeries[] })
    .WaarnemingenLijst;
  if (!Array.isArray(series)) return [];
  const newest = new Map<string, { t: number; value: number }>();
  for (const one of series) {
    const place = one.Locatie?.Code;
    const what = one.AquoMetadata?.Grootheid?.Code;
    if (!place || !what) continue;
    for (const measure of one.MetingenLijst ?? []) {
      const t = Date.parse(measure.Tijdstip ?? '');
      const value = measure.Meetwaarde?.Waarde_Numeriek;
      if (!Number.isFinite(t) || typeof value !== 'number') continue;
      if (now - t > MAX_AGE_MS || value > 900) continue;
      const key = `${place}|${what}`;
      const kept = newest.get(key);
      if (!kept || t > kept.t) newest.set(key, { t, value });
    }
  }
  return places.flatMap(({ station, km }) => {
    const speed = newest.get(`${station.id}|WINDSHD`);
    if (!speed) return [];
    const gust = newest.get(`${station.id}|WINDST`);
    const dir = newest.get(`${station.id}|WINDRTG`);
    return [
      {
        name: station.name,
        km,
        t: speed.t,
        avg: speed.value * MS_TO_KN,
        gust: gust ? gust.value * MS_TO_KN : null,
        dir: dir ? dir.value : null,
        net: RWS,
        id: station.id,
        lat: station.lat,
        lon: station.lon,
      },
    ];
  });
}

/**
 * Measured wind of Rijkswaterstaat (the Dutch coast, the North Sea, the
 * IJsselmeer), through the relay.
 * @param center - Place searched around.
 * @param radius - Radius in km.
 * @param most - Stations kept at most.
 * @param relay - The relay; nothing without it.
 * @returns The readings.
 */
export async function rwsReadings(
  center: { lat: number; lon: number },
  radius: number,
  most: number,
  relay: string,
): Promise<WindReading[]> {
  if (!relay || !touches(center, radius, NETHERLANDS)) return [];
  const near = nearStations(
    await rwsPlaces(relay),
    center,
    radius,
    Math.min(40, most * 3),
  );
  if (near.length === 0) return [];
  const response = await fetch(through(relay, RWS_LATEST), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      LocatieLijst: near.map(({ station }) => ({ Code: station.id })),
      AquoPlusWaarnemingMetadataLijst: ['WINDSHD', 'WINDST', 'WINDRTG'].map(
        (code) => ({ AquoMetadata: { Grootheid: { Code: code } } }),
      ),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) return [];
  return rwsReadingsOf(await response.json(), near, Date.now()).slice(0, most);
}

/* ------------------------------------------------------------------ Frost */

function frostAuth(clientId: string): string {
  return `Basic ${btoa(`${clientId}:`)}`;
}

/**
 * The stations of a Frost `sources` reply.
 * @param reply - The reply.
 * @returns The stations (id without the sensor suffix).
 */
export function frostSourcesOf(reply: unknown): WindPlace[] {
  const data = (
    (reply ?? {}) as {
      data?: Array<{
        id?: string;
        name?: string;
        shortName?: string;
        geometry?: { coordinates?: number[] };
      }>;
    }
  ).data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((source) => {
    const [lon, lat] = source.geometry?.coordinates ?? [];
    if (!source.id || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      return [];
    }
    const name = (source.shortName || source.name || source.id)
      .toLowerCase()
      .replaceAll(/(?:^|[\s-])\p{L}/gu, (letter) => letter.toUpperCase());
    return [{ id: source.id, name, lat: lat as number, lon: lon as number }];
  });
}

/**
 * The readings of a Frost `observations` reply: per station the newest
 * wind, gust and direction.
 * @param reply - The reply.
 * @param places - The stations asked, with their distance.
 * @param now - Epoch ms.
 * @returns The readings.
 */
export function frostReadingsOf(
  reply: unknown,
  places: ReadonlyArray<{ station: WindPlace; km: number }>,
  now: number,
): WindReading[] {
  const data = (
    (reply ?? {}) as {
      data?: Array<{
        sourceId?: string;
        referenceTime?: string;
        observations?: Array<{ elementId?: string; value?: number }>;
      }>;
    }
  ).data;
  if (!Array.isArray(data)) return [];
  const newest = new Map<string, { t: number; value: number }>();
  for (const entry of data) {
    const id = (entry.sourceId ?? '').split(':', 1)[0];
    const t = Date.parse(entry.referenceTime ?? '');
    if (!id || !Number.isFinite(t) || now - t > MAX_AGE_MS) continue;
    for (const observation of entry.observations ?? []) {
      if (!observation.elementId || typeof observation.value !== 'number') {
        continue;
      }
      const key = `${id}|${observation.elementId}`;
      const kept = newest.get(key);
      if (!kept || t > kept.t) newest.set(key, { t, value: observation.value });
    }
  }
  return places.flatMap(({ station, km }) => {
    const speed = newest.get(`${station.id}|wind_speed`);
    if (!speed) return [];
    const gust =
      newest.get(`${station.id}|max(wind_speed_of_gust PT10M)`) ??
      newest.get(`${station.id}|max(wind_speed_of_gust PT1H)`);
    const dir = newest.get(`${station.id}|wind_from_direction`);
    return [
      {
        name: station.name,
        km,
        t: speed.t,
        avg: speed.value * MS_TO_KN,
        gust: gust ? gust.value * MS_TO_KN : null,
        dir: dir ? dir.value : null,
        net: FROST,
        id: station.id,
        lat: station.lat,
        lon: station.lon,
      },
    ];
  });
}

/**
 * Measured wind of MET Norway (Frost), through the relay, with the client
 * ID of the skipper.
 * @param center - Place searched around.
 * @param radius - Radius in km.
 * @param most - Stations kept at most.
 * @param clientId - The Frost client ID; nothing without it.
 * @param relay - The relay; nothing without it.
 * @returns The readings.
 */
export async function frostReadings(
  center: { lat: number; lon: number },
  radius: number,
  most: number,
  clientId: string,
  relay = savedRelay(),
): Promise<WindReading[]> {
  if (!clientId || !relay || !touches(center, radius, NORWAY)) return [];
  const headers = { Authorization: frostAuth(clientId) };
  const sourcesUrl = `${FROST_BASE}/sources/v0.jsonld?types=SensorSystem&elements=wind_speed&geometry=nearest(POINT(${center.lon.toFixed(4)} ${center.lat.toFixed(4)}))&nearestmaxcount=${Math.min(30, most * 3)}&fields=id,name,shortName,geometry`;
  const sources = await fetch(through(relay, sourcesUrl), {
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  if (!sources.ok) {
    if (sources.status === 401 || sources.status === 403) {
      throw new Error('refused');
    }
    return [];
  }
  const near = nearStations(
    frostSourcesOf(await sources.json()),
    center,
    radius,
    Math.min(30, most * 3),
  );
  if (near.length === 0) return [];
  const ids = near.map(({ station }) => station.id).join(',');
  const elements = [
    'wind_speed',
    'wind_from_direction',
    'max(wind_speed_of_gust PT10M)',
    'max(wind_speed_of_gust PT1H)',
  ].join(',');
  const observationsUrl = `${FROST_BASE}/observations/v0.jsonld?sources=${ids}&elements=${encodeURIComponent(elements)}&referencetime=latest&maxage=PT2H`;
  const observations = await fetch(through(relay, observationsUrl), {
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  if (!observations.ok) return [];
  return frostReadingsOf(await observations.json(), near, Date.now()).slice(
    0,
    most,
  );
}

/**
 * Whether Frost refuses a client ID (for the check of the keys).
 * @param clientId - The client ID.
 * @param relay - The relay.
 * @returns True refused, false accepted, null unknown.
 */
export async function frostRefused(
  clientId: string,
  relay = savedRelay(),
): Promise<boolean | null> {
  if (!relay) return null;
  try {
    const response = await fetch(
      through(relay, `${FROST_BASE}/sources/v0.jsonld?ids=SN18700`),
      {
        headers: { Authorization: frostAuth(clientId) },
        signal: AbortSignal.timeout(20_000),
      },
    );
    return response.status === 401 || response.status === 403;
  } catch {
    return null;
  }
}
