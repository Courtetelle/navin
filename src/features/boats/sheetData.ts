import {
  dayKey,
  fmtDate,
  fmtDur,
  fmtTime,
  fmtUtc,
  keyToDate,
  textOf,
} from '../../lib/format.ts';
import type { Cruise, Day } from '../../model/types.ts';
import { constatTitle, curMode, isLake, state } from '../../state/index.ts';
import {
  checkDone,
  checkItems,
  ckDefs,
  ckLabelVal,
  ensureChecklistOwner,
  relevesSummary,
} from '../checklists/index.ts';
import type { LakeTimes, WeatherNow } from '../onwater/index.ts';
import { BLACK_EVT, hasEvt, lakeTimes, wxSummary } from '../onwater/index.ts';

import { autoFillLakeDay, navDur, outingTimes } from './outing.ts';
import type { SheetContent, SheetRow, SheetSection } from './sheetTypes.ts';

/**
 * Everything the lake day sheet can show. On a lake outing the day is first
 * filled automatically (legacy `sheetData`).
 * @param key - Day key.
 * @returns The sheet content.
 */
export function sheetData(key: string): SheetContent {
  prepareSheet(key);
  return buildSheetData(key);
}

/**
 * What legacy did while reading a sheet: seed the checklists of the outing and
 * fill the lake day. It writes to the state, so a page calls it in an effect.
 * @param key - Day key.
 */
export function prepareSheet(key: string): void {
  ensureChecklistOwner();
  if (isLake()) autoFillLakeDay(key);
}

/**
 * Same as {@link sheetData}, without writing anything (safe during a render).
 * @param key - Day key.
 * @returns The sheet content.
 */
export function buildSheetData(key: string): SheetContent {
  const cruise = state.data.cruise.value as Cruise;
  const info = cruise.info;
  const day: Day = cruise.days[key] ?? {};
  const today = key === dayKey(new Date());
  const done = today ? checkDone() : new Set(day.checkDone);
  const location = day.typeSortie === 'Location';
  const tarifs = textOf(info.tarifs);
  return {
    title: `NavIn · ${info.boat || info.name || ''}`,
    sections: [
      section('1 · Informations générales', generalRows(key, cruise, day)),
      ...(location && tarifs
        ? [section('Tarifs de location', tarifRows(tarifs))]
        : []),
    ],
    obs: observations(cruise, day),
    checks: ckDefs()
      .map(([list, , name]) => ({
        name:
          list === 'quit' && curMode() === 'lacj'
            ? 'Avant de quitter le bateau'
            : name,
        items: checkItems(list).map((item) => ({
          label: today ? ckLabelVal(item) : item.label,
          ok: done.has(item.id),
        })),
      }))
      .filter((list) => list.items.length > 0)
      .toReversed(),
    sig: day.sigSkip as string | null | undefined,
    sigName: textOf(day.skipper),
    missing: !day.moteurSoir || !day.diesel || !day.sigSkip,
  };
}

function section(title: string, rows: readonly SheetRow[]): SheetSection {
  return { title, rows: rows.filter(([, value]) => value !== '') };
}

function generalRows(key: string, cruise: Cruise, day: Day): SheetRow[] {
  const skipper = textOf(day.skipper);
  const engine =
    day.moteurDebut || day.moteurSoir
      ? `début ${textOf(day.moteurDebut) || '…'} · fin ${textOf(day.moteurSoir) || '…'}`
      : '';
  return [
    ['Date', fmtDate(keyToDate(key))],
    ['Type de sortie', textOf(day.typeSortie)],
    ['Skipper', skipper],
    ['Second', textOf(day.coSkipper)],
    ['Équipage', textOf(day.equipage)],
    ['Départ · retour', departureText(key)],
    ['Milles parcourus', day.nmJour ? `${textOf(day.nmJour)} NM` : ''],
    ['Heures moteur', engine],
    ...propulsionRows(lakeTimes(key)),
    ['Relevés à l’arrivée', relevesSummary({ ...day, moteurDebut: '' })],
    ['Niveau du diesel', textOf(day.diesel)],
    ['Eau potable', textOf(day.eauPotable)],
    ['Eaux noires', textOf(day.eauxNoires)],
    ['Eaux noires vidées', blackWaterTimes(key, cruise)],
    ['Météo', wxSummary(day.wxNow as WeatherNow | null | undefined)],
    ['Feux de tempête', textOf(day.fFeux)],
    ['Documents', textOf(day.lienDossier)],
    ['Franchise CHF 500', franchise(day, skipper)],
    [
      'Montant location',
      day.typeSortie === 'Location' && day.montant
        ? `CHF ${textOf(day.montant)}`
        : '',
    ],
  ];
}

function departureText(key: string): string {
  const { t0, t1 } = outingTimes(key);
  if (!t0) return '';
  const nav = navDur(key) || (t1 ? fmtDur(t1 - t0) : '');
  const start = new Date(t0);
  const end = t1 ? new Date(t1) : null;
  const local = `${fmtTime(start)} → ${end ? fmtTime(end) : '…'}`;
  const utc = `${fmtUtc(start)} → ${end ? fmtUtc(end) : '…'}`;
  return `${local} (${utc})${nav ? ` (${nav})` : ''}`;
}

function clock(time: number | null, missing: string): string {
  return time ? fmtTime(new Date(time)) : missing;
}

function propulsionRows(times: LakeTimes): SheetRow[] {
  return [
    ['Temps au moteur', times.motor ? fmtDur(times.motor) : ''],
    ['Temps à la voile', times.sail ? fmtDur(times.sail) : ''],
    ['dont voile + moteur', times.mixed ? fmtDur(times.mixed) : ''],
    [
      'Baignade',
      times.baths
        .map(([start, end]) => `${clock(start, '…')}–${clock(end, 'en cours')}`)
        .join(', '),
    ],
  ];
}

function blackWaterTimes(key: string, cruise: Cruise): string {
  return cruise.entries
    .filter(
      (entry) => dayKey(new Date(entry.t)) === key && hasEvt(entry, BLACK_EVT),
    )
    .map((entry) => fmtTime(new Date(entry.t)))
    .join(', ');
}

function franchise(day: Day, skipper: string): string {
  if (day.typeSortie === 'Location') {
    return `à charge du locataire${skipper ? ` (${skipper})` : ''}`;
  }
  if (textOf(day.respUnique).startsWith('Oui')) {
    return `skipper seul responsable${skipper ? ` : ${skipper}` : ''}`;
  }
  return day.typeSortie ? 'partagée entre les membres présents' : '';
}

function tarifRows(tarifs: string): SheetRow[] {
  return tarifs
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s*:\s*/);
      return parts.length > 1
        ? [parts[0] as string, parts.slice(1).join(' : ')]
        : ['', line];
    });
}

function observations(cruise: Cruise, day: Day): string {
  const owner: Record<string, unknown> = curMode() === 'lacj' ? day : cruise;
  const remarks =
    textOf(day.observations) ||
    [day.dysfonct, day.aFaire, day.debrief].filter(Boolean).join('\n');
  return [
    owner.obsPrise ? `${constatTitle('dep')} : ${textOf(owner.obsPrise)}` : '',
    remarks,
    owner.obsFin ? `${constatTitle('quit')} : ${textOf(owner.obsFin)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}
