/** The details of a METAR, beyond the wind: what an airport sees. */
export interface MetarDetails {
  /** Visibility as given (statute miles, `6+` for 10 km or more). */
  visib?: string | number;
  /** Present weather, e.g. `-RA`, `TSRAGS`. */
  wx?: string;
  /** Cloud layers: cover and base in feet. */
  clouds?: Array<{ cover: string; base?: number | null }>;
  /** Dew point in °C. */
  dewp?: number;
  /** The whole message. */
  raw?: string;
}

const INTENSITY: Readonly<Record<string, string>> = {
  '-': 'faible',
  '+': 'forte',
  VC: 'à proximité',
};

const DESCRIPTORS: Readonly<Record<string, string>> = {
  MI: 'mince',
  BC: 'en bancs',
  PR: 'partiel',
  DR: 'chasse basse',
  BL: 'chasse haute',
  SH: 'averses',
  TS: 'orage',
  FZ: 'se congelant',
};

const PHENOMENA: Readonly<Record<string, string>> = {
  DZ: 'bruine',
  RA: 'pluie',
  SN: 'neige',
  SG: 'neige en grains',
  IC: 'cristaux de glace',
  PL: 'granules de glace',
  GR: 'grêle',
  GS: 'grésil',
  UP: 'précipitation inconnue',
  BR: 'brume',
  FG: 'brouillard',
  FU: 'fumée',
  VA: 'cendres volcaniques',
  DU: 'poussière',
  SA: 'sable',
  HZ: 'brume sèche',
  PO: 'tourbillons de poussière',
  SQ: 'grains',
  FC: 'trombe',
  SS: 'tempête de sable',
  DS: 'tempête de poussière',
};

const COVERS: Readonly<Record<string, string>> = {
  FEW: 'quelques nuages',
  SCT: 'nuages épars',
  BKN: 'nuages fragmentés',
  OVC: 'couvert',
  SKC: 'ciel clair',
  CLR: 'ciel clair',
  NSC: 'pas de nuages significatifs',
  NCD: 'pas de nuages',
  CAVOK: 'CAVOK',
  VV: 'ciel invisible',
};

/**
 * One weather group of a METAR in French.
 * @param group - e.g. `-RA`, `+TSRAGS`, `VCSH`.
 * @returns The words, or the group itself when not understood.
 */
export function weatherWords(group: string): string {
  let rest = group.trim();
  let intensity = '';
  for (const mark of ['VC', '-', '+']) {
    if (rest.startsWith(mark)) {
      intensity = INTENSITY[mark] ?? '';
      rest = rest.slice(mark.length);
      break;
    }
  }
  const words: string[] = [];
  const descriptor = DESCRIPTORS[rest.slice(0, 2)];
  if (descriptor) {
    words.push(descriptor);
    rest = rest.slice(2);
  }
  const phenomena: string[] = [];
  while (rest.length >= 2) {
    const phenomenon = PHENOMENA[rest.slice(0, 2)];
    if (!phenomenon) return group;
    phenomena.push(phenomenon);
    rest = rest.slice(2);
  }
  if (rest) return group;
  if (phenomena.length > 0) {
    words.push(
      descriptor ? `avec ${phenomena.join(' et ')}` : phenomena.join(' et '),
    );
  }
  if (intensity) words.push(`(${intensity})`);
  return words.join(' ') || group;
}

/**
 * The visibility in metres or kilometres.
 * @param visib - Statute miles, `6+`, or metres in a raw group.
 * @returns The words, empty when unknown.
 */
export function visibilityWords(visib: string | number | undefined): string {
  if (visib == null || visib === '') return '';
  if (typeof visib === 'string' && visib.endsWith('+')) return '10 km ou plus';
  const miles = Number(visib);
  if (!Number.isFinite(miles)) return String(visib);
  const metres = miles * 1609;
  return metres >= 10_000
    ? '10 km ou plus'
    : metres >= 1000
      ? `${(metres / 1000).toFixed(1).replace('.', ',')} km`
      : `${Math.round(metres / 50) * 50} m`;
}

/**
 * The clouds in French, the lowest first.
 * @param clouds - Layers.
 * @returns The words, empty without layers.
 */
export function cloudWords(clouds: MetarDetails['clouds']): string {
  if (!clouds || clouds.length === 0) return '';
  return clouds
    .map(({ cover, base }) => {
      const words = COVERS[cover.replace(/CB|TCU$/u, '')] ?? cover;
      const kind = cover.endsWith('CB')
        ? ' (cumulonimbus)'
        : cover.endsWith('TCU')
          ? ' (cumulus bourgeonnants)'
          : '';
      return base == null
        ? `${words}${kind}`
        : `${words} à ${Math.round(base * 0.3048)} m${kind}`;
    })
    .join(', ');
}

/**
 * A group of the raw message read for the « TEMPO » or « BECMG » part.
 * @param group - One group.
 * @returns Its French, or empty to skip it.
 */
function trendGroup(group: string): string {
  const wind =
    /^(?<dir>\d{3}|VRB)(?<speed>\d{2,3})(?:G(?<gust>\d{2,3}))?KT$/u.exec(
      group,
    )?.groups;
  if (wind) {
    const from = wind.dir === 'VRB' ? 'variable' : `du ${wind.dir}°`;
    const gust = wind.gust ? `, rafales ${Number(wind.gust)} nd` : '';
    return `vent ${from} ${Number(wind.speed)} nd${gust}`;
  }
  if (/^\d{4}$/u.test(group)) {
    const metres = Number(group);
    return metres >= 9999
      ? 'visibilité 10 km ou plus'
      : `visibilité ${metres} m`;
  }
  const cloud =
    /^(?<cover>FEW|SCT|BKN|OVC|VV)(?<base>\d{3})(?<kind>CB|TCU)?$/u.exec(
      group,
    )?.groups;
  if (cloud) {
    return cloudWords([
      {
        cover: `${cloud.cover}${cloud.kind ?? ''}`,
        base: Number(cloud.base) * 100,
      },
    ]);
  }
  if (group === 'NSW') return 'fin du temps significatif';
  if (group === 'CAVOK') return 'CAVOK';
  if (/^(?:FM|TL|AT)\d{4}$/u.test(group)) return '';
  const words = weatherWords(group);
  return words === group ? '' : words;
}

/**
 * The trend at the end of the message (« TEMPO », « BECMG »), in French.
 * @param raw - The whole METAR.
 * @returns The words, empty without trend.
 */
export function trendWords(raw: string | undefined): string {
  if (!raw) return '';
  const parts: string[] = [];
  const pattern =
    /\b(?<kind>TEMPO|BECMG)\b(?<body>.*?)(?=\bTEMPO\b|\bBECMG\b|\bNOSIG\b|=|$)/gu;
  for (const match of raw.matchAll(pattern)) {
    const kind = match.groups?.kind === 'TEMPO' ? 'temporairement' : 'devenant';
    const words = (match.groups?.body ?? '')
      .trim()
      .split(/\s+/u)
      .filter(Boolean)
      .map(trendGroup)
      .filter(Boolean);
    if (words.length > 0) parts.push(`${kind} : ${words.join(', ')}`);
  }
  if (parts.length === 0 && /\bNOSIG\b/u.test(raw)) {
    return 'pas de changement significatif prévu';
  }
  return parts.join(' ; ');
}

/**
 * The rows of an airport beyond the wind, for its card and the shared
 * sheet: visibility, present weather, clouds, dew point, the trend of the
 * next two hours, and the message itself.
 * @param details - The details of the METAR.
 * @returns The rows, `[label, value]`.
 */
export function metarRows(
  details: MetarDetails | undefined,
): Array<[string, string]> {
  if (!details) return [];
  const rows: Array<[string, string]> = [];
  const visibility = visibilityWords(details.visib);
  if (visibility) rows.push(['Visibilité', visibility]);
  if (details.wx) {
    rows.push([
      'Temps présent',
      details.wx.split(/\s+/u).filter(Boolean).map(weatherWords).join(', '),
    ]);
  }
  const clouds = cloudWords(details.clouds);
  if (clouds) rows.push(['Nuages', clouds]);
  if (details.dewp != null) {
    rows.push(['Point de rosée', `${details.dewp.toFixed(0)} °C`]);
  }
  const trend = trendWords(details.raw);
  if (trend) rows.push(['Tendance (2 h)', trend]);
  if (details.raw) rows.push(['Message METAR', details.raw]);
  return rows;
}
