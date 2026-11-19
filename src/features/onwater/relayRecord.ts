import { state } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import type { WindPoint } from './stationHistory.ts';
import type { WindReading } from './windTypes.ts';

/** The address of the relay, empty without one. */
export function relayAddress(): string {
  const saved = state.preferences.settings.peek().windAlert?.relayUrl;
  return typeof saved === 'string' ? saved.replace(/\/$/u, '') : '';
}

/** A name of this device for the relay, made once. */
function deviceId(): string {
  let id = store.get<string>('ldb.deviceId', '');
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    store.set('ldb.deviceId', id);
  }
  return id;
}

/**
 * Send the relay the points recorded around and what this device read, so
 * that it records them NavIn closed and every device shares one past.
 * Without a relay, or a relay without recording, nothing happens.
 * @param points - The GPS and the three zones, with their radius in km.
 * @param readings - What was read.
 */
export async function sendToRelay(
  points: ReadonlyArray<{ lat: number; lon: number; km: number }>,
  readings: readonly WindReading[],
): Promise<void> {
  const relay = relayAddress();
  if (!relay) return;
  await fetch(`${relay}/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device: deviceId(),
      points,
      readings: readings
        .filter((one) => one.net && one.id)
        .map((one) => ({
          k: `${one.net}:${one.id}`,
          t: one.t,
          a: one.avg,
          g: one.gust,
          d: one.dir,
        })),
    }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => undefined);
}

/**
 * The past of a station the relay recorded.
 * @param key - `net:id`.
 * @returns Its points, empty without a relay.
 */
export async function relayPoints(key: string): Promise<WindPoint[]> {
  const relay = relayAddress();
  if (!relay) return [];
  try {
    const response = await fetch(
      `${relay}/history?k=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) return [];
    const body = (await response.json()) as Record<
      string,
      Array<[number, number, number | null, number | null]>
    >;
    return (body[key] ?? []).map(([t, avg, gust, dir]) => ({
      t,
      avg,
      gust,
      dir,
    }));
  } catch {
    return [];
  }
}

/** What the relay says of its recording. */
export interface RelayRecording {
  /** Its KV and its cron are set. */
  recording: boolean;
  /** The keyed networks it reads itself, NavIn closed (`Météo-France`…). */
  reads: string[];
}

/**
 * Whether the relay records (its KV and its cron set), and the networks it
 * reads itself with the keys kept as its secrets.
 * @returns The answer, null without a relay or an answer.
 */
export async function relayRecords(): Promise<RelayRecording | null> {
  const relay = relayAddress();
  if (!relay) return null;
  try {
    const response = await fetch(`${relay}/record`, {
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json()) as {
      recording?: boolean;
      reads?: unknown;
    };
    return {
      recording: body.recording === true,
      reads: Array.isArray(body.reads)
        ? body.reads.filter((one): one is string => typeof one === 'string')
        : [],
    };
  } catch {
    return null;
  }
}
