import { signal } from '@preact/signals-react';

import { dayKey } from '../../lib/format.ts';
import { state, toast } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import { mfBase } from './coastStations.ts';
import { relayed } from './euStations.ts';

/** A key that no longer works, or will soon stop. */
export interface KeyProblem {
  /** Which key: `mf`, `aemet`, `metoffice`, `relay`. */
  id: string;
  /** What is wrong, in French. */
  text: string;
  /** What to do, in French. */
  todo: string;
  /** A short print of the key checked: a new key clears the problem. */
  print: string;
}

/** The last daily look at the keys. */
interface KeyHealth {
  /** The day of the look, `2026-11-15`. */
  day: string;
  problems: KeyProblem[];
}

const KEY = 'ldb.keyHealth';
/** A key ending within this time is said before it stops. */
const SOON_MS = 10 * 86_400_000;

/** The problems of the keys, for Paramétrages › Clés météos et compte relais. */
export const keyProblems = signal<KeyProblem[]>(
  store.get<KeyHealth | null>(KEY, null)?.problems ?? [],
);

/**
 * A short print of a key, never the key itself: its length and its last
 * four characters folded into a number.
 * @param key - The key.
 * @returns The print.
 */
export function keyPrint(key: string): string {
  let sum = key.length;
  for (const char of key.slice(-12)) {
    sum = (sum * 31 + (char.codePointAt(0) ?? 0)) % 1_000_003;
  }
  return String(sum);
}

/**
 * The end date a key holds (`exp` of a JWT), if any.
 * @param key - The key.
 * @returns Epoch milliseconds, or null.
 */
export function keyEnd(key: string): number | null {
  try {
    const part = key.split('.', 3)[1] ?? '';
    const json = atob(part.replaceAll('-', '+').replaceAll('_', '/'));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' && exp > 0 ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** The keys and what to do for each. */
const KEYS = [
  {
    id: 'mf',
    setting: 'mfKey',
    name: 'Météo-France',
    todo: 'Paramétrages › Clés météos et compte relais › « Où trouver la clé Météo-France » (2ᵉ partie) : générer une nouvelle « API Key » sur portail-api.meteofrance.fr, la coller et Enregistrer.',
  },
  {
    id: 'aemet',
    setting: 'aemetKey',
    name: 'AEMET',
    todo: 'Paramétrages › Clés météos et compte relais › « Où trouver la clé AEMET » : redemander une clé par mail sur opendata.aemet.es, la coller et Enregistrer.',
  },
  {
    id: 'metoffice',
    setting: 'metOfficeKey',
    name: 'Met Office',
    todo: 'Paramétrages › Clés météos et compte relais › « Où trouver la clé Met Office » (2ᵉ partie) : « Reset Credentials » sur datahub.metoffice.gov.uk, coller la nouvelle clé et Enregistrer.',
  },
  {
    id: 'frost',
    setting: 'frostKey',
    name: 'Frost (MET Norway)',
    todo: 'Paramétrages › Clés météos et compte relais › « Où trouver l’identifiant Frost » : redemander un client ID sur frost.met.no avec son adresse mail, le coller et Enregistrer.',
  },
  {
    id: 'relay',
    setting: 'relayUrl',
    name: 'relais des METAR',
    todo: 'Paramétrages › Clés météos et compte relais › « Où trouver l’adresse du relais » : vérifier le Worker « navin-relay » sur dash.cloudflare.com, y recoller « 📋 Copier le code du relais » puis « Deploy », et vérifier son adresse.',
  },
] as const;

const fmtDay = (t: number) =>
  new Date(t).toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

/**
 * Whether a key is refused by its service: 401 or 403. A network that does
 * not answer says nothing (null): it is not the key.
 * @param id - Which key.
 * @param key - The key.
 * @returns True refused, false accepted, null unknown.
 */
async function refused(id: string, key: string): Promise<boolean | null> {
  const signal = AbortSignal.timeout(20_000);
  try {
    if (id === 'mf') {
      const response = await fetch(`${mfBase(key)}liste-stations`, {
        headers: { apikey: key },
        signal,
      });
      return response.status === 401 || response.status === 403;
    }
    if (id === 'aemet') {
      const response = await fetch(
        `https://opendata.aemet.es/opendata/api/valores/climatologicos/inventarioestaciones/todasestaciones?api_key=${encodeURIComponent(key)}`,
        { signal },
      );
      if (response.status === 401 || response.status === 403) return true;
      const body = (await response.json().catch(() => null)) as {
        estado?: number;
      } | null;
      return body?.estado === 401 || body?.estado === 403;
    }
    if (id === 'frost') {
      const { frostRefused } = await import('./northStations.ts');
      return await frostRefused(key);
    }
    if (id === 'metoffice') {
      const response = await fetch(
        'https://data.hub.api.metoffice.gov.uk/observation-land/1/nearest?lat=50.8&lon=-1.3',
        { headers: { apikey: key, accept: 'application/json' }, signal },
      );
      return response.status === 401 || response.status === 403;
    }
    const response = await fetch(
      relayed(
        key,
        'https://aviationweather.gov/api/data/metar?ids=LFRD&format=json',
      ),
      { signal },
    );
    return !response.ok;
  } catch {
    return null;
  }
}

/**
 * The problems of the keys saved: ended or ending soon (the date the key
 * holds), refused by their service. A key that cannot be reached for
 * want of network is not a problem.
 * @param now - Epoch milliseconds.
 * @returns The problems.
 */
export async function keyIssues(now = Date.now()): Promise<KeyProblem[]> {
  const alert = state.preferences.settings.peek().windAlert ?? {};
  const problems: KeyProblem[] = [];
  for (const { id, setting, name, todo } of KEYS) {
    const value = alert[setting];
    if (typeof value !== 'string' || !value) continue;
    const print = keyPrint(value);
    const end = id === 'relay' ? null : keyEnd(value);
    if (end != null && end < now) {
      problems.push({
        id,
        print,
        text: `La clé ${name} a expiré le ${fmtDay(end)} : ses stations ne sont plus lues.`,
        todo,
      });
      continue;
    }
    /* eslint-disable-next-line no-await-in-loop -- one service after the other */
    const no = await refused(id, value);
    if (no) {
      problems.push({
        id,
        print,
        text:
          id === 'relay'
            ? 'Le relais des METAR ne répond plus : les aéroports et les bouées ne sont plus lus.'
            : `La clé ${name} est refusée par ${name} : ses stations ne sont plus lues.`,
        todo,
      });
    } else if (end != null && end - now < SOON_MS) {
      problems.push({
        id,
        print,
        text: `La clé ${name} expire le ${fmtDay(end)}.`,
        todo,
      });
    }
  }
  return problems;
}

/**
 * The problems still standing: a key changed since the look (a new key
 * pasted) clears its problem at once.
 * @param problems - The problems of the last look.
 * @param alert - The wind settings, where the keys are.
 * @returns Those whose key is unchanged.
 */
export function standing(
  problems: readonly KeyProblem[],
  alert: Record<string, unknown> = state.preferences.settings.peek()
    .windAlert ?? {},
): KeyProblem[] {
  return problems.filter((problem) => {
    const setting = KEYS.find((key) => key.id === problem.id)?.setting;
    const value = setting ? alert[setting] : undefined;
    return (
      typeof value === 'string' && value && keyPrint(value) === problem.print
    );
  });
}

/**
 * Once a day, as long as it is not solved: the keys are looked at, and a
 * bubble says each problem and what to do; Paramétrages › Clés météos et compte relais shows them
 * until a new key is saved. Without network, nothing is said and NavIn
 * looks again later the same day.
 * @param now - Epoch milliseconds.
 */
export async function dailyKeyCheck(now = Date.now()): Promise<void> {
  const today = dayKey(new Date(now));
  const last = store.get<KeyHealth | null>(KEY, null);
  if (last?.day === today || !navigator.onLine) return;
  const problems = await keyIssues(now);
  store.set(KEY, { day: today, problems });
  keyProblems.value = problems;
  if (problems.length === 0) return;
  toast(
    problems
      .map((problem) => `⚠️ ${problem.text}\nÀ faire : ${problem.todo}`)
      .join('\n'),
  );
}
