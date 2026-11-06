import { fmtDur, fr } from '../../lib/format.ts';
import { isLake, state } from '../../state/index.ts';

import type { TrackEvent } from './detector.ts';

/** Minutes between two periodic candidates of the detector. */
export const TICK_MIN = 10;

/** One navigation of a track: departure, candidates, arrival. */
export interface TrackLeg {
  dep: TrackEvent;
  mids: TrackEvent[];
  arr: TrackEvent;
}

/**
 * Number of intermediate entries kept for a navigation (legacy `entryBudget`).
 * On a lake: 2 per hour for a short outing, 1 per hour from 3 hours. At sea:
 * the `autoPerHour` setting, proportionally fewer on a long navigation.
 * @param hours - Duration of the navigation.
 * @returns The number of entries, 0 to 12.
 */
export function entryBudget(hours: number): number {
  if (isLake()) {
    return Math.max(
      0,
      Math.min(12, hours < 3 ? Math.round(hours * 2) : Math.round(hours)),
    );
  }
  const scaled = hours * (state.preferences.settings.value.autoPerHour || 1);
  return Math.max(
    0,
    Math.min(
      12,
      scaled <= 4 ? Math.floor(scaled) : 4 + Math.floor((scaled - 4) / 2),
    ),
  );
}

/**
 * Keep a few candidates spread over a navigation (legacy `selectLeg`): one per
 * slot, a manoeuvre being preferred to a plain point. Writes `arrival.note`.
 * @param departure - Departure event.
 * @param candidates - Candidate events.
 * @param arrival - Arrival event (receives its note).
 * @returns Departure, the chosen events by time, arrival.
 */
export function selectLeg(
  departure: TrackEvent,
  candidates: readonly TrackEvent[],
  arrival: TrackEvent,
): TrackEvent[] {
  const duration = arrival.t - departure.t;
  const budget = entryBudget(duration / 3_600_000);
  const kept = new Set<TrackEvent>();
  if (budget > 0) {
    const slot = duration / (budget + 1);
    for (let rank = 1; rank <= budget; rank++) {
      const target = departure.t + rank * slot;
      const inWindow = candidates.filter(
        (event) => Math.abs(event.t - target) <= slot / 2 && !kept.has(event),
      );
      const manoeuvres = inWindow.filter((event) => event.kind);
      const pool = manoeuvres.length > 0 ? manoeuvres : inWindow;
      const [closest] = pool.toSorted(
        (first, second) =>
          Math.abs(first.t - target) - Math.abs(second.t - target),
      );
      if (closest) kept.add(closest);
    }
  }
  arrival.note = `Navigation ${fmtDur(duration)} · ${fr(arrival.dist - departure.dist)} NM`;
  return [
    departure,
    ...[...kept].toSorted((first, second) => first.t - second.t),
    arrival,
  ];
}

/**
 * Split a list of events into navigations (legacy `legsFromEvents`).
 * @param events - Events of a whole track.
 * @returns One leg per departure / arrival pair.
 */
export function legsFromEvents(events: readonly TrackEvent[]): TrackLeg[] {
  const legs: TrackLeg[] = [];
  let current: { dep: TrackEvent; mids: TrackEvent[] } | null = null;
  for (const event of events) {
    if (event.kind === 'Départ') {
      current = { dep: event, mids: [] };
    } else if (event.kind === 'Arrivée' && current) {
      legs.push({ ...current, arr: event });
      current = null;
    } else if (current) {
      current.mids.push(event);
    }
  }
  return legs;
}
