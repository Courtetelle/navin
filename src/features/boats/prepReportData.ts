import { dayKey, fmtShortDate, textOf } from '../../lib/format.ts';
import { constatKey } from '../../model/views.ts';
import {
  curMode,
  deliver,
  fileName,
  isLake,
  state,
  toast,
} from '../../state/index.ts';
import { getPhoto } from '../../storage/photos.ts';
import {
  checkDone,
  checkItems,
  ckLabelVal,
  ckOpen,
  obsOwner,
} from '../checklists/index.ts';
import { crewListHead, crewRole, photosFor } from '../onwater/index.ts';
import type {
  CardsPhoto,
  CardsRow,
  CardsSection,
  LxTheme,
} from '../publish/index.ts';
import { cardsPng } from '../publish/index.ts';

const THEMES: ReadonlySet<string> = new Set(['cards', 'carnet', 'mini']);
const OBSERVATIONS = '§obs';

/** The PréP + check-in report (legacy `prepReportDoc`). */
export interface PrepReportDocument {
  title: string;
  kicker: string;
  sub: string;
  sections: CardsSection[];
  photos: CardsPhoto[];
}

/** A report prepared in the background. */
export interface CachedPrepReport {
  document: PrepReportDocument | null;
  theme: LxTheme;
  /** Layout and photo choice it was prepared for. */
  key: string;
}

let cached: CachedPrepReport | null = null;

/**
 * Layout chosen for the report (legacy `repTheme`).
 * @returns The layout.
 */
export function reportTheme(): LxTheme {
  const theme = state.preferences.settings.value.repTheme;
  return typeof theme === 'string' && THEMES.has(theme)
    ? (theme as LxTheme)
    : 'cards';
}

/**
 * Whether the report carries the photos (legacy `repPh`).
 * @returns `true` unless switched off.
 */
export function reportPhotos(): boolean {
  return state.preferences.settings.value.repPh !== false;
}

/**
 * Gather the report of the open outing.
 * @param withPhotos - Read the photos of the check-in.
 * @returns The report, null without open cruise.
 */
export async function prepReportDocument(
  withPhotos: boolean,
): Promise<PrepReportDocument | null> {
  const cruise = state.data.cruise.value;
  if (!cruise) return null;
  const head = crewListHead();
  const dayOnly = curMode() === 'lacj' ? dayKey(new Date()) : null;
  const purpose =
    textOf(state.data.prep.value?.purpose) ||
    textOf(cruise.purpose) ||
    (dayOnly ? textOf(cruise.days[dayOnly]?.typeSortie) : '');
  const items = checkItems('dep');
  const done = checkDone();
  const open = ckOpen();
  const observations = textOf(obsOwner()?.[constatKey('dep')]);
  const doneCount = items.filter((item) => done.has(item.id)).length;
  const photosOf = withPhotos ? await readPhotos(dayOnly) : {};
  const state3 = (id: string) => {
    if (done.has(id)) return '✔ fait';
    return open.has(id) ? '✕ pas fait' : '☐ à faire';
  };
  const place = [isLake() ? 'Lac' : 'Mer', purpose].filter(Boolean).join(' · ');
  const crew: CardsRow[] = cruise.crew.map((line) => [
    crewRole(line) || 'Équipier',
    line.nom || '…',
  ]);
  const sections: CardsSection[] = [
    {
      title: 'Sortie',
      rows: [
        ['Sortie', place || '–'],
        ['Bateau', head.boat || '–'],
        ['Date', head.dates || fmtShortDate(new Date())],
      ],
    },
    {
      title: `Équipage · ${cruise.crew.length}`,
      rows: crew.length > 0 ? crew : [['', '–']],
    },
    {
      title: `Check-in · ${doneCount}/${items.length}`,
      rows: items.map((item) => [
        state3(item.id),
        `${ckLabelVal(item)}${item.note ? `\n${item.note}` : ''}`,
        photosOf[item.id] ?? [],
      ]),
    },
  ];
  const observationPhotos = photosOf[OBSERVATIONS];
  if (observations || observationPhotos) {
    sections.push({
      title: 'Observations',
      rows: [['', observations || '–', observationPhotos ?? []]],
    });
  }
  return {
    title: `PréP · ${cruise.info.name ?? ''}`.trim(),
    kicker: 'PréP + check-in',
    sub: `${head.boat || ''} · ${fmtShortDate(new Date())}`,
    sections,
    photos: [],
  };
}

/**
 * Prepare the report in the background, so that printing leaves straight from
 * the touch (iPhone) (legacy `prepReportCache`).
 */
export function prepReportCache(): void {
  const key = reportKey();
  const theme = reportTheme();
  prepReportDocument(reportPhotos())
    .then((document) => {
      cached = { document, theme, key };
    })
    .catch(() => undefined);
}

/**
 * The report prepared by {@link prepReportCache}, for the printed log book.
 * @returns The report, null when none is ready.
 */
export function cachedPrepReport(): CachedPrepReport | null {
  return cached;
}

/**
 * Key of the current choices (layout, photos).
 * @returns The key.
 */
export function reportKey(): string {
  return `${reportTheme()}${reportPhotos() ? '+' : '-'}`;
}

/**
 * Send the report as an image (legacy `prepReportShare`).
 * @returns Resolves when delivered.
 */
export async function prepReportShare(): Promise<void> {
  if (!state.data.cruise.value) {
    toast('Choisissez d’abord le bateau');
    return;
  }
  toast('Préparation de l’image…');
  try {
    const document = await prepReportDocument(reportPhotos());
    if (!document) throw new Error('no cruise');
    const blob = await cardsPng({ ...document, theme: reportTheme() });
    await deliver(blob, fileName('-prep', 'png'), 'image/png');
  } catch {
    toast('Image impossible : faites une capture d’écran');
  }
}

async function readPhotos(
  day: string | null,
): Promise<Record<string, CardsPhoto[]>> {
  const list = photosFor('dep', day);
  const urls = await Promise.all(
    list.map((photo) => getPhoto(photo.id).catch(() => null)),
  );
  const out: Record<string, CardsPhoto[]> = {};
  for (const [index, photo] of list.entries()) {
    const url = urls[index];
    if (typeof url !== 'string' || !url) continue;
    const owner = textOf(photo.item) || OBSERVATIONS;
    out[owner] ??= [];
    out[owner].push({ url, cap: '' });
  }
  return out;
}
