import { signal } from '@preact/signals-react';

import { uid } from '../../lib/format.ts';
import { fmtPos } from '../../lib/geo.ts';
import type { LogEvent, MobLog } from '../../model/types.ts';
import type { TimedPosition } from '../../state/index.ts';
import {
  addEntry,
  mobLogs,
  saveMobLogs,
  state,
  updateCruise,
} from '../../state/index.ts';

import type { MobKind } from './mobDefaults.ts';
import type { MobZone } from './mobProcedures.ts';
import { mobKind, mobZone } from './mobProcedures.ts';

/** A position with its time, kept in a man-overboard log. */
export interface MobPosition {
  lat: number;
  lon: number;
  t: string;
}

/** A man-overboard log with the fields this domain writes. */
export interface MobLogRecord extends MobLog {
  kind: MobKind;
  zone: MobZone;
  /** @default undefined */
  entryId?: string;
  /** @default undefined */
  mobPos?: MobPosition;
  /** @default undefined */
  lastPos?: MobPosition;
}

/** Position read by the watch of the lake page (legacy `mobLive`). */
export const mobLive = signal<TimedPosition | null>(null);

/**
 * Position texts written into events already on screen when the GPS answers
 * (legacy `.mob-ev-pos`), by event time; a redraw of the page forgets them.
 */
export const mobEventPositions = signal<Readonly<Record<string, string>>>({});

/**
 * The open log of the procedure shown (legacy `mobActive`).
 * @returns The log, or `null`.
 */
export function mobActive(): MobLogRecord | null {
  const kind = mobKind.value;
  for (const log of mobLogs() as readonly MobLogRecord[]) {
    if (!log.end && log.kind === kind) return log;
  }
  return null;
}

/**
 * Note an action in the log of the procedure shown, starting the log when none
 * is open, then ask the GPS and add the position as soon as it answers (legacy
 * `mobLog`).
 * @param what - What happened.
 * @param extra - Other event fields (`type`, `key`, `pos`).
 */
export function mobLog(what: string, extra: Partial<LogEvent> = {}): void {
  const list = editableLogs();
  const t = new Date().toISOString();
  const kind = mobKind.value;
  let log = list.find((item) => !item.end && item.kind === kind);
  if (!log) {
    log = {
      id: uid(),
      kind,
      zone: mobZone.value,
      start: t,
      events: [
        {
          t,
          type: 'start',
          what:
            kind === 'train'
              ? 'Début de l’entraînement homme à la mer'
              : 'Début de l’incident homme à la mer',
        },
      ],
    };
    list.push(log);
    if (state.data.cruise.value) {
      log.entryId = uid();
      addEntry({
        id: log.entryId,
        t,
        v: {
          evt: ['Homme à la mer'],
          note:
            kind === 'train'
              ? 'Entraînement : début du log'
              : 'Début du log de l’incident',
        },
      });
    }
  }
  const event: LogEvent = { t, what, ...extra };
  const recent = mobPosNow();
  if (recent && !event.pos) event.pos = recent;
  log.events.push(event);
  if (event.pos) mobSetPos(log, event.pos, event.t);
  saveMobLogs(list);
  askPosition(log, log.events.indexOf(event));
}

/**
 * Note the first position of a log as the MOB position, and always the last one
 * (legacy `mobSetPos`).
 * @param log - Log, a mutable copy.
 * @param position - Position.
 * @param t - Its time.
 */
export function mobSetPos(
  log: MobLogRecord,
  position: { lat: number; lon: number },
  t: string,
): void {
  if (!log.mobPos) {
    log.mobPos = { ...position, t };
    log.events.splice(1, 0, {
      t,
      type: 'mobpos',
      what: '📍 Position MOB enregistrée',
      pos: position,
    });
    const { entryId } = log;
    if (entryId) {
      updateCruise((cruise) => {
        const entry = cruise.entries.find((item) => item.id === entryId);
        if (entry) entry.v.pos = { ...position };
      });
    }
  }
  log.lastPos = { ...position, t };
}

/**
 * A position from the watch of the lake page: it completes the open log
 * (legacy `mobLakeWatch`).
 * @param position - Position read.
 */
export function mobWatchFix(position: { lat: number; lon: number }): void {
  const at = new Date().toISOString();
  mobLive.value = { ...position, at };
  state.view.sosPos.value = { ...position, at };
  const kind = mobKind.value;
  const list = editableLogs();
  const log = list.find((item) => !item.end && item.kind === kind);
  if (!log) return;
  mobSetPos(log, position, at);
  saveMobLogs(list);
}

/**
 * Last state of a step in a log (legacy `mobStepDone`).
 * @param log - Log, or `null`.
 * @param key - Step key.
 * @returns The event that marked it done, `null` when not done or cancelled.
 */
export function mobStepDone(
  log: MobLogRecord | null,
  key: string,
): LogEvent | null {
  if (!log) return null;
  let last: LogEvent | null = null;
  for (const event of log.events) {
    if (event.key === key) last = event.type === 'step' ? event : null;
  }
  return last;
}

/**
 * Legacy created the empty list of the cruise on its first read; it then shows
 * in the saved cruise.
 */
export function ensureMobLogs(): void {
  updateCruise(
    (cruise) => {
      cruise.mobLogs ??= [];
    },
    { save: false },
  );
}

function editableLogs(): MobLogRecord[] {
  return structuredClone(mobLogs()) as MobLogRecord[];
}

function mobPosNow(): { lat: number; lon: number } | null {
  const position = state.view.sosPos.value;
  if (!position?.at) return null;
  if (Date.now() - new Date(position.at).getTime() >= 60_000) return null;
  return { lat: position.lat, lon: position.lon };
}

function askPosition(log: MobLogRecord, eventIndex: number): void {
  if (!('geolocation' in navigator)) return;
  const { id, mobPos } = log;
  navigator.geolocation.getCurrentPosition(
    (fix) => {
      const position = {
        lat: fix.coords.latitude,
        lon: fix.coords.longitude,
      };
      const at = new Date().toISOString();
      state.view.sosPos.value = { ...position, at };
      const list = editableLogs();
      const current = list.find((item) => item.id === id);
      if (!current) return;
      // The MOB position event may have been inserted at index 1 meanwhile.
      const shift = !mobPos && current.mobPos ? 1 : 0;
      const event = current.events[eventIndex + shift];
      if (event && !event.pos) event.pos = position;
      mobSetPos(current, position, at);
      saveMobLogs(list);
      if (event?.pos) {
        mobEventPositions.value = {
          ...mobEventPositions.value,
          [event.t]: fmtPos(event.pos),
        };
      }
    },
    () => undefined,
    {
      enableHighAccuracy: true,
      timeout: 20_000,
      maximumAge: mobPos ? 5000 : 0,
    },
  );
}
