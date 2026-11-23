/** The analysis from the hemisphere down to the bay, kept in NavIn for offline. */
export const ANALYSIS = {
  /** Where it is about. */
  place: 'Saint-Quay-Portrieux',
  /** When it was written, Paris time. */
  at: '2026-11-20T23:00',
  /** The model runs it reads. */
  runs: 'ECMWF IFS 20/11 06 UTC, DWD ICON-EU et EWAM 20/11 12 UTC, Copernicus IBI 20/11',
  /** The copy kept with NavIn. */
  offline: 'analyse/saint-quay/index.html',
  /** The version kept up to date, online. */
  online: 'https://claude.ai/artifact/396CrWuSXA8FaX36D2Y7LA',
} as const;

/** The versions made by the workflow « Analyse météo », published with NavIn. */
export const VERSIONS_DIR = 'analyse/v/';
/** The repository whose workflow makes the analysis. */
export const ANALYSIS_REPO = 'courtetelle/navin';
/** The workflow file of the analysis. */
export const ANALYSIS_WORKFLOW = 'analyse.yml';
/** Its page on GitHub, with the « Run workflow » button. */
export const ANALYSIS_WORKFLOW_PAGE = `https://github.com/${ANALYSIS_REPO}/actions/workflows/${ANALYSIS_WORKFLOW}`;
/** After a day a version is old. */
export const OLD_MS = 24 * 3_600_000;

/** One version of the analysis, as listed in `analyse/v/index.json`. */
export interface AnalysisVersion {
  id: string;
  label: string;
  /** ISO time, Paris offset. */
  at: string;
  /** Relative to `analyse/v/`. */
  path: string;
  /** Made because a new run was out (else asked by hand). */
  auto: boolean;
  /** Written by Claude, before the workflow existed. */
  claude?: boolean;
  /** Lights and strongest values of each day (read by the page itself). */
  jours?: unknown[];
}

/** One zone and its versions, newest first. */
export interface AnalysisZone {
  nom: string;
  court: string;
  lat: number;
  lon: number;
  versions: AnalysisVersion[];
}

/** The list of the versions. */
export interface AnalysisIndex {
  updated?: string;
  zones: Record<string, AnalysisZone>;
}

/** What NavIn shows before the list is read (or when it cannot be). */
export const FALLBACK_INDEX: AnalysisIndex = {
  zones: {
    'saint-quay': {
      nom: 'Saint-Quay-Portrieux',
      court: 'Saint-Quay',
      lat: 48.6521,
      lon: -2.83063,
      versions: [
        {
          id: 'claude-2026112023',
          label: '20/11 23 h 00 · rédigée par Claude',
          at: '2026-11-20T23:00+01:00',
          path: '../saint-quay/index.html',
          auto: false,
          claude: true,
        },
      ],
    },
  },
};

/** The test zones first, in this order, then the GPS points. */
const ORDER = ['saint-quay', 'porquerolles', 'rolle'];

/** The test zones that the workflow knows, even before their first version. */
export const ZONE_NAMES: Readonly<Record<string, string>> = {
  'saint-quay': 'Saint-Quay-Portrieux',
  porquerolles: 'Porquerolles, Hyères et Toulon',
  rolle: 'Rolle, Léman',
};

/**
 * Fetch the list of the versions published with NavIn.
 * @param base - Base URL of the app.
 * @returns The list, or null without network or before the first version.
 */
export async function readIndex(base: string): Promise<AnalysisIndex | null> {
  try {
    const response = await fetch(`${base}${VERSIONS_DIR}index.json`, {
      cache: 'no-cache',
    });
    if (!response.ok) return null;
    const parsed = parseIndex((await response.json()) as unknown);
    return parsed && Object.keys(parsed.zones).length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Read `analyse/v/index.json`, keeping only what is well formed.
 * @param raw - The parsed JSON.
 * @returns The index, or null when it is not one.
 */
export function parseIndex(raw: unknown): AnalysisIndex | null {
  if (!raw || typeof raw !== 'object') return null;
  const zonesRaw = (raw as { zones?: unknown }).zones;
  if (!zonesRaw || typeof zonesRaw !== 'object') return null;
  const zones: Record<string, AnalysisZone> = {};
  for (const [id, value] of Object.entries(zonesRaw)) {
    const zone = value as Partial<AnalysisZone>;
    if (!Array.isArray(zone.versions)) continue;
    const versions = zone.versions.filter(
      (version): version is AnalysisVersion =>
        typeof version?.id === 'string' &&
        typeof version.path === 'string' &&
        typeof version.label === 'string' &&
        typeof version.at === 'string' &&
        !version.path.includes('//'),
    );
    if (versions.length === 0) continue;
    zones[id] = {
      nom: zone.nom ?? id,
      court: zone.court ?? id,
      lat: Number(zone.lat),
      lon: Number(zone.lon),
      versions,
    };
  }
  const updated = (raw as { updated?: unknown }).updated;
  return { updated: typeof updated === 'string' ? updated : undefined, zones };
}

function rank(id: string): number {
  const at = ORDER.indexOf(id);
  return at === -1 ? ORDER.length : at;
}

/**
 * The zones to offer, test zones first.
 * @param index - The list of the versions.
 * @returns Zone ids.
 */
export function zoneIds(index: AnalysisIndex): string[] {
  const ids = Object.keys(index.zones);
  return ids.toSorted((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * Whether a version is more than a day old.
 * @param version - The version.
 * @param now - Now, in ms.
 * @returns True when old.
 */
export function isOld(version: AnalysisVersion, now: number): boolean {
  const at = Date.parse(version.at);
  return Number.isFinite(at) && now - at > OLD_MS;
}

/**
 * The inputs of the workflow for a zone or a GPS point.
 * @param target - A zone id, or a position.
 * @returns The workflow_dispatch inputs.
 */
export function dispatchInputs(
  target: string | { lat: number; lon: number; nom?: string },
): Record<string, string> {
  if (typeof target === 'string') {
    return { zone: target, lat: '', lon: '', nom: '' };
  }
  return {
    zone: '',
    lat: target.lat.toFixed(4),
    lon: target.lon.toFixed(4),
    nom: (target.nom ?? '').slice(0, 60),
  };
}

/** A zone of the list serves a point closer than this (km). */
export const SAME_PLACE_KM = 5;
/** Without a version this recent, NavIn asks for a new one by itself. */
export const STALE_MS = 6 * 3_600_000;
/** NavIn asks at most this often for the same point. */
export const ASK_EVERY_MS = 3 * 3_600_000;

function km(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const radians = Math.PI / 180;
  const x = (bLon - aLon) * radians * Math.cos(((aLat + bLat) / 2) * radians);
  return Math.hypot(x, (bLat - aLat) * radians) * 6371;
}

/**
 * The zone of the list that serves a point: the nearest one closer than
 * {@link SAME_PLACE_KM}.
 * @param index - The list of the versions.
 * @param lat - Latitude of the point (zone of NavIn or GPS).
 * @param lon - Longitude.
 * @returns Its id, or null when no analysis was made there yet.
 */
export function zoneForPoint(
  index: AnalysisIndex,
  lat: number,
  lon: number,
): string | null {
  let best: { id: string; d: number } | null = null;
  for (const [id, zone] of Object.entries(index.zones)) {
    if (!Number.isFinite(zone.lat) || !Number.isFinite(zone.lon)) continue;
    const d = km(lat, lon, zone.lat, zone.lon);
    if (d <= SAME_PLACE_KM && (!best || d < best.d)) best = { id, d };
  }
  return best?.id ?? null;
}

/**
 * Whether NavIn should ask for a new analysis of the point by itself.
 * @param newestAt - Time of the newest version there (ISO), or null.
 * @param askedAt - When it was last asked for that point (ms), or 0.
 * @param now - Now (ms).
 * @returns True when there is none, or it is old, and it was not just asked.
 */
export function shouldAsk(
  newestAt: string | null,
  askedAt: number,
  now: number,
): boolean {
  if (now - askedAt < ASK_EVERY_MS) return false;
  if (!newestAt) return true;
  const at = Date.parse(newestAt);
  return !Number.isFinite(at) || now - at > STALE_MS;
}

/**
 * Ask GitHub to run a workflow of the repository now, on main.
 * @param token - A GitHub token allowed to run the workflows of the repository.
 * @param workflow - The workflow file (`analyse.yml`).
 * @param inputs - The workflow inputs.
 * @param fetcher - fetch (tests pass their own).
 * @returns Null when asked, else what went wrong.
 */
export async function dispatchWorkflow(
  token: string,
  workflow: string,
  inputs: Record<string, string>,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const response = await fetcher(
      `https://api.github.com/repos/${ANALYSIS_REPO}/actions/workflows/${workflow}/dispatches`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ ref: 'main', inputs }),
      },
    );
    if (response.status === 204) return null;
    if (response.status === 401 || response.status === 403) {
      return 'clé GitHub refusée (droits « Actions : écriture » sur le dépôt navin)';
    }
    return `GitHub a répondu ${response.status}`;
  } catch {
    return 'pas de réseau';
  }
}

/**
 * Ask GitHub to run the workflow of the analysis now.
 * @param token - A GitHub token allowed to run the workflows of the repository.
 * @param inputs - The workflow inputs.
 * @param fetcher - fetch (tests pass their own).
 * @returns Null when asked, else what went wrong.
 */
export function dispatchAnalysis(
  token: string,
  inputs: Record<string, string>,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  return dispatchWorkflow(token, ANALYSIS_WORKFLOW, inputs, fetcher);
}

function degMin(value: number, width: number): string {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const min = ((abs - deg) * 60).toFixed(1).replace('.', ',');
  return `${String(deg).padStart(width, '0')}°${min.padStart(4, '0')}'`;
}

/**
 * A position as degrees and minutes, the way charts write it.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns e.g. `48°43,0' N 002°45,0' W`.
 */
export function formatPosition(lat: number, lon: number): string {
  return `${degMin(lat, 2)} ${lat >= 0 ? 'N' : 'S'} ${degMin(lon, 3)} ${lon >= 0 ? 'E' : 'W'}`;
}

/** Where NavIn keeps the GitHub key, in `settings.windAlert`. */
export const GITHUB_KEY_SETTING = 'githubKey';

/** What GitHub says of a key. */
export interface GithubKeyCheck {
  /** True accepted, false refused, null no answer (network). */
  ok: boolean | null;
  /** Its end date (epoch ms), when GitHub tells it. */
  end: number | null;
}

/**
 * Try a GitHub key on the workflow of the analysis: read it, as running it
 * would start an analysis.
 * @param token - The key.
 * @param fetcher - fetch (tests pass their own).
 * @returns Whether GitHub accepts it, and until when.
 */
export async function checkGithubKey(
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<GithubKeyCheck> {
  try {
    const response = await fetcher(
      `https://api.github.com/repos/${ANALYSIS_REPO}/actions/workflows/${ANALYSIS_WORKFLOW}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );
    const said = response.headers.get('github-authentication-token-expiration');
    const end = said
      ? Date.parse(said.replace(' UTC', 'Z').replace(' ', 'T'))
      : Number.NaN;
    if (response.ok) {
      return { ok: true, end: Number.isFinite(end) ? end : null };
    }
    if ([401, 403, 404].includes(response.status)) {
      return { ok: false, end: null };
    }
    return { ok: null, end: null };
  } catch {
    return { ok: null, end: null };
  }
}
