import { dayKey, fmtTime, fmtUtc, fr, num, pad } from '../../lib/format.ts';
import { windTxt } from '../../lib/wind.ts';
import type { Cruise, Entry } from '../../model/types.ts';
import { state } from '../../state/index.ts';

import { hasEvt } from './lakeState.ts';

/** One line of a journal extract (legacy `extractRow`). */
export interface JournalRow {
  /** Local time. */
  time: string;
  /** Events, or « Point de route » / « Entrée ». */
  what: string;
  /** UTC time, then course, speed, wind, sails, note. */
  more: string;
}

/**
 * Journal extract of a day: departure, arrival and a few chosen entries. Two
 * entries per hour on a short outing, one per hour from three hours on; manual
 * entries win over automatic course changes (legacy `journalExtract`).
 * @param key - Day key.
 * @param cruise - Cruise (the open one by default).
 * @returns The rows.
 */
export function journalExtract(
  key: string,
  cruise: Cruise | null = state.data.cruise.value,
): JournalRow[] {
  const entries = (cruise?.entries ?? []).filter(
    (entry) => dayKey(new Date(entry.t)) === key,
  );
  const first = entries[0];
  if (!first) return [];
  const departure = entries.find((entry) => hasEvt(entry, 'Départ')) ?? first;
  const arrival =
    entries.findLast((entry) => hasEvt(entry, 'Arrivée')) ??
    (entries.length > 1 ? entries.at(-1) : undefined);
  const start = Date.parse(departure.t);
  const end = arrival ? Date.parse(arrival.t) : start;
  const hours = (end - start) / 3_600_000;
  const budget = hours < 3 ? Math.round(hours * 2) : Math.round(hours);
  const candidates = entries.filter((entry) => {
    const time = Date.parse(entry.t);
    return (
      entry !== departure && entry !== arrival && time > start && time < end
    );
  });
  const picked =
    budget > 0 && candidates.length > 0
      ? pickEntries(candidates, start, end, budget)
      : [];
  const list = [
    departure,
    ...picked.toSorted((a, b) => a.t.localeCompare(b.t)),
    ...(arrival && arrival !== departure ? [arrival] : []),
  ];
  return list.map((entry) => extractRow(entry));
}

/**
 * Full journal of a day: every manual entry and event; automatic points are
 * kept on a course change of 20° or more, else at most one per quarter of an
 * hour (legacy `journalFull`).
 * @param key - Day key.
 * @param cruise - Cruise (the open one by default).
 * @returns The rows.
 */
export function journalFull(
  key: string,
  cruise: Cruise | null = state.data.cruise.value,
): JournalRow[] {
  const entries = (cruise?.entries ?? []).filter(
    (entry) => dayKey(new Date(entry.t)) === key,
  );
  const rows: JournalRow[] = [];
  let lastTime = -Infinity;
  let lastCourse: number | null = null;
  for (const [index, entry] of entries.entries()) {
    const time = Date.parse(entry.t);
    const course = entry.v.cog == null ? null : Number(entry.v.cog);
    const turned =
      course !== null &&
      lastCourse !== null &&
      Math.abs(((course - lastCourse + 540) % 360) - 180) >= 20;
    const keep =
      !entry.auto ||
      (entry.v.evt ?? []).length > 0 ||
      Boolean(entry.v.note) ||
      index === 0 ||
      index === entries.length - 1 ||
      turned ||
      time - lastTime >= 15 * 60_000;
    if (!keep) continue;
    rows.push(extractRow(entry));
    lastTime = time;
    if (course !== null) lastCourse = course;
  }
  return rows;
}

// One slot per entry kept; in each slot the most important, then the closest to the middle.
function pickEntries(
  candidates: Entry[],
  start: number,
  end: number,
  budget: number,
): Entry[] {
  const picked = new Set<Entry>();
  const step = (end - start) / budget;
  const score = (entry: Entry) =>
    (entry.auto ? 1 : 2) + ((entry.v.evt ?? []).length > 0 ? 0.5 : 0);
  for (let slot = 0; slot < budget; slot++) {
    const from = start + slot * step;
    const to = from + step;
    const middle = (from + to) / 2;
    const best = candidates
      .filter((entry) => {
        const time = Date.parse(entry.t);
        return time >= from && time < to && !picked.has(entry);
      })
      .toSorted(
        (a, b) =>
          score(b) - score(a) ||
          distanceFrom(a, middle) - distanceFrom(b, middle),
      )[0];
    if (best) picked.add(best);
  }
  return [...picked];
}

function distanceFrom(entry: Entry, middle: number): number {
  return Math.abs(Date.parse(entry.t) - middle);
}

function extractRow(entry: Entry): JournalRow {
  const values = entry.v;
  const what =
    (values.evt ?? []).join(', ') || (entry.auto ? 'Point de route' : 'Entrée');
  const wind =
    values.tws == null
      ? ''
      : `vent ${windTxt(values.tws)}${values.twd == null ? '' : ` du ${pad(values.twd, 3)}°`}`;
  const details = [
    values.cog == null ? '' : `cap ${pad(values.cog, 3)}°`,
    values.sog == null ? '' : `${fr(num(values.sog))} nd`,
    wind,
    values.allure && values.allure !== 'Moteur' ? values.allure : '',
    values.gv || values.avant
      ? `GV ${values.gv || '…'} · ${values.avant || '…'}`
      : '',
    values.note ?? '',
  ]
    .filter(Boolean)
    .join(' · ');
  const time = new Date(entry.t);
  return {
    time: fmtTime(time),
    what,
    more: [fmtUtc(time), details].filter(Boolean).join(' · '),
  };
}
