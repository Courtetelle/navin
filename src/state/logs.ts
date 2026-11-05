import { freeze, produce } from 'immer';

import { fmtShortDate, hms, hmsUtc, uid } from '../lib/format.ts';
import { fmtPos } from '../lib/geo.ts';
import type { LogEvent, MobLog, SosLog } from '../model/types.ts';
import { store } from '../storage/store.ts';

import { updateCruise } from './cruise.ts';
import { data } from './data.ts';
import { addEntry } from './entries.ts';
import { lastKnownPos, navZone } from './position.ts';
import { toast } from './toast.ts';

/** Load the SOS logs (`ldb.sosLogs`, kept as stored). */
export function loadSosLogs(): void {
  const stored = store.get<unknown>('ldb.sosLogs', []);
  data.sosLogs.value = (Array.isArray(stored) ? stored : []) as SosLog[];
}

/**
 * Persist the SOS logs (legacy `saveSosLogs`).
 * @returns `true` when written.
 */
export function saveSosLogs(): boolean {
  return store.set('ldb.sosLogs', data.sosLogs.value);
}

/**
 * Change the SOS logs with an immer recipe, then save them.
 * @param recipe - Mutates the draft list.
 * @returns `true` when written.
 */
export function updateSosLogs(recipe: (logs: SosLog[]) => void): boolean {
  data.sosLogs.value = produce(data.sosLogs.value, recipe);
  return saveSosLogs();
}

/**
 * The SOS log not yet ended (legacy `sosLogActive`).
 * @returns The log, or `null`.
 */
export function sosLogActive(): SosLog | null {
  return data.sosLogs.value.find((log) => !log.end) ?? null;
}

/**
 * Sub-label of the SOS logs button (legacy `sosLogsCount`).
 * @returns e.g. `2 logs SOS automatiques` or `⏺ log SOS en cours`.
 */
export function sosLogsCount(): string {
  const count = data.sosLogs.value.length;
  if (sosLogActive()) return '⏺ log SOS en cours';
  const plural = count > 1 ? 's' : '';
  return `${count} log${plural} SOS automatique${plural}`;
}

/**
 * Position noted in an SOS log event: the last known one when under 2 minutes old (legacy `sosLogPos`).
 * @returns `{ lat, lon }`, or `null`.
 */
export function sosLogPos(): { lat: number; lon: number } | null {
  const position = lastKnownPos();
  if (position?.lat == null) return null;
  if (position.at && Date.now() - new Date(position.at).getTime() >= 120_000) {
    return null;
  }
  return { lat: position.lat, lon: position.lon };
}

/**
 * Note an action in the running SOS log, starting a log when none runs (legacy `sosLogAdd`).
 * @param what - What happened.
 * @param type - Event type (`'sos'`, `'pause'`, `'resume'`…).
 * @returns The log.
 */
export function sosLogAdd(what: string, type?: string): SosLog {
  const t = new Date().toISOString();
  let active = sosLogActive();
  if (!active) {
    const cruise = data.cruise.value;
    const created: SosLog = {
      id: uid(),
      start: t,
      zone: navZone(),
      nav: cruise ? cruise.info.name || '' : '',
      boat: cruise ? cruise.info.boat || '' : '',
      events: [{ t, what: 'Début du log SOS', type: 'start' }],
    };
    data.sosLogs.value = [...data.sosLogs.value, created];
    active = created;
    setTimeout(() => {
      const log = data.sosLogs.value.find((item) => item.id === created.id);
      toast(
        log?.ex
          ? '🧪 Log d’exercice démarré · rien de réel ne part'
          : '🆘 Log SOS démarré · toutes les actions sont notées · data › SOS',
      );
    }, 400);
  }
  const event: LogEvent = { t, what };
  if (type) event.type = type;
  const position = sosLogPos();
  if (position) event.pos = position;
  const id = active.id;
  updateSosLogs((logs) => {
    const log = logs.find((item) => item.id === id);
    if (!log) return;
    log.events.push(event);
    log.last = t;
  });
  return data.sosLogs.value.find((log) => log.id === id) as SosLog;
}

/**
 * End the running SOS log; open man-overboard logs end with it (legacy `sosLogEnd`).
 */
export function sosLogEnd(): void {
  const active = sosLogActive();
  if (!active) return;
  const t = new Date().toISOString();
  const position = sosLogPos();
  updateSosLogs((logs) => {
    const log = logs.find((item) => item.id === active.id);
    if (!log) return;
    log.events.push({
      t,
      what: '⏹ Fin de procédure SOS',
      type: 'end',
      ...(position ? { pos: position } : {}),
    });
    log.end = t;
    log.last = t;
  });
  const list = structuredClone(mobLogs()) as MobLog[];
  let changed = false;
  for (const log of list) {
    if (log.end) continue;
    log.events.push({ t, type: 'end', what: 'Fin de procédure SOS' });
    log.end = t;
    changed = true;
    if (data.cruise.value) {
      const minutes = Math.round(
        (Date.parse(t) - Date.parse(log.start)) / 60_000,
      );
      addEntry({
        id: uid(),
        t,
        v: {
          evt: ['Homme à la mer'],
          note: `Fin de procédure SOS (${minutes} min)`,
        },
      });
    }
  }
  if (changed) saveMobLogs(list);
}

/**
 * Man-overboard logs: those of the open cruise, else those of the phone (legacy `mobLogs`).
 * @returns The logs (read-only; save a changed copy with {@link saveMobLogs}).
 */
export function mobLogs(): readonly MobLog[] {
  const cruise = data.cruise.value;
  if (cruise) return (cruise.mobLogs as MobLog[] | undefined) ?? [];
  return data.mobLogs.value;
}

/**
 * Persist man-overboard logs in the open cruise, else on the phone (legacy `saveMobLogs`).
 * @param list - The whole list.
 */
export function saveMobLogs(list: readonly MobLog[]): void {
  if (data.cruise.value) {
    updateCruise((cruise) => {
      cruise.mobLogs = structuredClone(list);
    });
    return;
  }
  data.mobLogs.value = freeze([...list], true);
  store.set('ldb.mobLogs', data.mobLogs.value);
}

/**
 * Plain text of an SOS log: local time (and UTC at sea) of each event (legacy `sosLogText`).
 * @param log - SOS log.
 * @returns The text, one event per line.
 */
export function sosLogText(log: SosLog): string {
  const lines = [
    `LOG SOS · ${fmtShortDate(new Date(log.start))}${log.boat ? ` · ${log.boat}` : ''}${log.nav ? ` · ${log.nav}` : ''}`,
  ];
  for (const event of log.events) {
    const date = new Date(event.t);
    const utc = log.zone === 'lac' ? '' : ` · ${hmsUtc(date)}`;
    lines.push(
      `${hms(date)}${utc}  ${event.what}${event.pos ? `  (${fmtPos(event.pos)})` : ''}`,
    );
  }
  if (log.end) {
    lines.push(
      `Durée : ${Math.round((Date.parse(log.end) - Date.parse(log.start)) / 60_000)} min`,
    );
  }
  return lines.join('\n');
}
