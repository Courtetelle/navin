import { batch } from '@preact/signals-react';

import { buzz } from '../../lib/dom.ts';
import { fmtDur, fmtTime, fr, uid } from '../../lib/format.ts';
import { distNM } from '../../lib/geo.ts';
import type { TrackPoint } from '../../state/index.ts';
import {
  addEntry,
  saveTrack,
  saveTrip,
  state,
  toast,
} from '../../state/index.ts';

import { addAutoEntry } from './autoEntries.ts';
import type { TrackSample } from './detector.ts';
import { detectorPush } from './detector.ts';
import { nmeaFresh, nmeaLink, nmeaPosFresh, nmeaWind } from './nmeaLive.ts';
import type { LiveTrip } from './tripState.ts';
import { liveTrip, publishTrip } from './tripState.ts';

/** A position fix: a browser `GeolocationPosition`, or one built from the instruments. */
export interface FixInput {
  /** @default undefined */
  timestamp?: number;
  /** The position comes from the boat instruments. @default false */
  nmea?: boolean;
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number | null;
    heading: number | null;
  };
}

const GAP_MS = 3 * 60_000;
const MIN_ACCURACY_M = 60;
const SAMPLE_SPACING_MS = 10_000;
const { view } = state;

/**
 * Handle one position (legacy `onFix`): track point, gap note, detector,
 * departure entry. Instruments take over the phone GPS while fresh.
 * @param fix - Position received.
 */
export function onFix(fix: FixInput): void {
  batch(() => {
    view.gpsDenied.value = false;
    const trip = liveTrip();
    const buffer = view.trackBuf.peek();
    if (!view.tracking.peek() || !trip || !buffer) return;
    if (!fix.nmea && nmeaPosFresh()) return;
    if (fix.coords.accuracy > MIN_ACCURACY_M) return;
    const sample = sampleOf(fix);
    view.lastFix.value = {
      lat: sample.lat,
      lon: sample.lon,
      at: new Date(sample.t).toISOString(),
    };
    recordSample(trip, buffer, sample);
    const events = detectorPush(trip.det, sample);
    for (const event of events) {
      // Only the departure is written at once: the others are chosen at the arrival.
      if (event.kind === 'Départ') {
        trip.dep = event;
        void addAutoEntry(event, trip.lochBase);
        buzz();
        toast('🛰 Départ enregistré');
      } else {
        trip.cands.push(event);
      }
    }
    if (events.length > 0 || buffer.length % 6 === 0) saveTrip();
    publishTrip();
  });
}

function sampleOf({ timestamp, coords }: FixInput): TrackSample {
  const { speed, heading, latitude, longitude } = coords;
  const hasSpeed = speed != null && !Number.isNaN(speed);
  const sample: TrackSample = {
    t: timestamp || Date.now(),
    lat: latitude,
    lon: longitude,
    sog: hasSpeed ? Math.round(speed * 19.4384) / 10 : null,
    cog:
      heading != null && !Number.isNaN(heading) && (speed ?? 0) > 0.5
        ? Math.round(heading) % 360
        : null,
  };
  const wind = nmeaWind();
  if (wind) {
    sample.twd = Math.round(wind.twd) % 360;
    sample.tws = Math.round(wind.tws * 10) / 10;
  }
  return sample;
}

function recordSample(
  trip: LiveTrip,
  buffer: TrackPoint[],
  sample: TrackSample,
): void {
  const last = buffer.at(-1);
  if (last && trip.det.lastPt && sample.t - last[0] > GAP_MS) {
    noteGap(trip, last, sample);
  }
  if (last && sample.t - last[0] < SAMPLE_SPACING_MS) return;
  const point: TrackPoint = [
    sample.t,
    Math.round(sample.lat * 1e6) / 1e6,
    Math.round(sample.lon * 1e6) / 1e6,
  ];
  const apparent = nmeaFresh('aws') ? (nmeaLink.live.aws ?? null) : null;
  if (sample.tws != null || apparent !== null) {
    point.push(sample.tws ?? null, apparent);
  }
  buffer.push(point);
  if (buffer.length % 6 === 0) saveTrack(buffer);
}

function noteGap(trip: LiveTrip, last: TrackPoint, sample: TrackSample): void {
  const from = new Date(last[0]);
  const to = new Date(sample.t);
  const miles = distNM({ lat: last[1], lon: last[2] }, sample);
  trip.gaps ??= [];
  trip.gaps.push({
    from: last[0],
    to: sample.t,
    nm: Math.round(miles * 100) / 100,
  });
  addEntry({
    id: uid(),
    t: to.toISOString(),
    auto: true,
    v: {
      pos: { lat: sample.lat, lon: sample.lon },
      note: `Trace interrompue de ${fmtTime(from)} à ${fmtTime(to)} (appli fermée ou en arrière-plan) : ${fr(miles)} NM complétés en ligne droite.`,
    },
  });
  toast(
    `🛰 Trace complétée : ${fmtDur(sample.t - last[0])} sans GPS, ${fr(miles)} NM en ligne droite`,
  );
}
