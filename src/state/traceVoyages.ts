import { signal } from '@preact/signals-react';

import { store } from '../storage/store.ts';

/*
 * The cruise or outing of each trace (Corban, 28/11): a trace recorded while
 * a cruise or outing is active is classed in it, whatever navigation it was
 * recorded in; it can then be moved to another one. A trace is known by its
 * navigation and the time of its first point (`cruise@time`), which stay
 * right when the traces of a navigation are cut or deleted.
 */

const KEY = 'ldb.traceVoyages';
const PENDING_KEY = 'ldb.traceVoyagePending';

/** Where a trace was put, and when. */
interface TraceVoyage {
  /** The cruise or outing, empty when taken out. */
  v: string;
  at: string;
}

/** The recording under way while a cruise or outing is active. */
interface Pending {
  cruise: string;
  from: number;
  voyage: string;
}

/** Changes when a trace is moved, to read the lists again. */
export const traceVoyagesVersion = signal(0);

function all(): Record<string, TraceVoyage> {
  return store.get<Record<string, TraceVoyage>>(KEY, {});
}

/**
 * The key of a trace.
 * @param cruiseId - Its navigation.
 * @param firstTime - Time of its first point (ms).
 * @returns `cruise@time`.
 */
export function traceKey(cruiseId: string, firstTime: number): string {
  return `${cruiseId}@${firstTime}`;
}

/**
 * The cruise or outing a trace was put in.
 * @param cruiseId - Its navigation.
 * @param firstTime - Time of its first point (ms).
 * @returns The id; `''` when taken out; undefined when never put.
 */
export function traceVoyageOf(
  cruiseId: string,
  firstTime: number,
): string | undefined {
  const known = all()[traceKey(cruiseId, firstTime)];
  if (known) return known.v;
  const pending = store.get<Pending | null>(PENDING_KEY, null);
  if (pending?.cruise === cruiseId && firstTime >= pending.from - 60_000) {
    return pending.voyage;
  }
  return undefined;
}

/**
 * Put a trace into a cruise or outing, or take it out.
 * @param cruiseId - Its navigation.
 * @param firstTime - Time of its first point (ms).
 * @param voyage - The cruise or outing, or undefined.
 */
export function setTraceVoyage(
  cruiseId: string,
  firstTime: number,
  voyage: string | undefined,
): void {
  store.set(KEY, {
    ...all(),
    [traceKey(cruiseId, firstTime)]: {
      v: voyage ?? '',
      at: new Date().toISOString(),
    },
  });
  traceVoyagesVersion.value += 1;
}

/**
 * A recording starts: while it goes on, its trace belongs to the active
 * cruise or outing; none active, nothing is noted.
 * @param cruiseId - The navigation recorded.
 * @param from - When it starts (ms).
 * @param voyage - The active cruise or outing.
 */
export function startTraceVoyage(
  cruiseId: string,
  from: number,
  voyage: string | null | undefined,
): void {
  if (!voyage) {
    store.del(PENDING_KEY);
    return;
  }
  // The app reopened during a recording keeps the start already noted.
  const before = store.get<Pending | null>(PENDING_KEY, null);
  if (before?.cruise === cruiseId && before.voyage === voyage) return;
  store.set(PENDING_KEY, { cruise: cruiseId, from, voyage });
  traceVoyagesVersion.value += 1;
}

/**
 * The recording stops: its traces keep their cruise or outing for good.
 * @param firstTimes - Times of the first points of the traces of its
 * navigation.
 */
export function endTraceVoyage(firstTimes: readonly number[]): void {
  const pending = store.get<Pending | null>(PENDING_KEY, null);
  if (!pending) return;
  const known = all();
  const at = new Date().toISOString();
  for (const time of firstTimes) {
    const key = traceKey(pending.cruise, time);
    if (time >= pending.from - 60_000 && !known[key]) {
      known[key] = { v: pending.voyage, at };
    }
  }
  store.set(KEY, known);
  store.del(PENDING_KEY);
  traceVoyagesVersion.value += 1;
}

/**
 * For the backups and the synchronisation.
 * @returns Where each trace was put.
 */
export function traceVoyages(): Readonly<Record<string, TraceVoyage>> {
  return all();
}

/**
 * Where the traces were put on another device: the latest change wins.
 * @param received - Untrusted content.
 */
export function mergeTraceVoyages(received: unknown): void {
  if (!received || typeof received !== 'object') return;
  const known = all();
  let changed = false;
  for (const [key, value] of Object.entries(received)) {
    if (!value || typeof value !== 'object') continue;
    const { v, at } = value as Partial<TraceVoyage>;
    if (typeof v !== 'string' || typeof at !== 'string') continue;
    if ((known[key]?.at ?? '') >= at) continue;
    known[key] = { v, at };
    changed = true;
  }
  if (!changed) return;
  store.set(KEY, known);
  traceVoyagesVersion.value += 1;
}
