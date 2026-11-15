import { signal } from '@preact/signals-react';

import { uid } from '../../lib/format.ts';
import { addEntry, state } from '../../state/index.ts';

import { relayed } from './euStations.ts';
import type { LakeWarnPop } from './lakeWarnPop.ts';
import { lakeWarnPop } from './lakeWarnPop.ts';
import type { LakeWarning } from './lakeWarnings.ts';
import {
  VERSIONS_URL,
  dangersUrl,
  lakeWarningText,
  lakeWarningsOf,
  litWarnings,
  warningKey,
  warningsNear,
} from './lakeWarnings.ts';
import { lookPlace } from './lightningWatch.ts';
import { showOverlays } from './overlayRoot.ts';
import { playLightning } from './windAudio.ts';

/** Why the warnings could not be read. */
export type LakeWarnTrouble = 'no-relay' | 'old-relay' | 'network' | null;

/** The last reading of the warnings of the lakes. */
export interface LakeWarnState {
  warnings: LakeWarning[];
  /** When read, epoch ms; 0 never. */
  at: number;
  trouble: LakeWarnTrouble;
}

/** What NavIn knows of the warnings of the lakes. */
export const lakeWarnState = signal<LakeWarnState>({
  warnings: [],
  at: 0,
  trouble: null,
});

/** Settings of the alert (`settings.lakeWarn`). */
export interface LakeWarnSettings {
  /** The alert sounds; yes unless false. */
  on?: boolean;
}

/** The warnings are read this often. */
const EVERY_MS = 5 * 60_000;

let timer: ReturnType<typeof setInterval> | undefined;
/** The warnings already said, so each sounds once. */
const said = new Set<string>();

function relayUrl(): string {
  const value = state.preferences.settings.peek().windAlert?.relayUrl;
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Whether the alert sounds (Météo › Feux d'avis des lacs), yes by default.
 * @returns True to sound it.
 */
export function lakeWarnOn(): boolean {
  const settings = state.preferences.settings.peek().lakeWarn as
    LakeWarnSettings | undefined;
  return settings?.on !== false;
}

async function readJson(relay: string, url: string): Promise<unknown> {
  const response = await fetch(relayed(relay, url), {
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 403) throw new Error('old-relay');
  if (!response.ok) throw new Error('network');
  return response.json();
}

/**
 * Read the warnings of MeteoSwiss for the lakes, through the relay.
 * @returns The new state.
 */
export async function readLakeWarnings(): Promise<LakeWarnState> {
  const relay = relayUrl();
  const now = Date.now();
  if (!relay) {
    lakeWarnState.value = { warnings: [], at: now, trouble: 'no-relay' };
    return lakeWarnState.value;
  }
  try {
    const url = dangersUrl(await readJson(relay, VERSIONS_URL));
    if (!url) throw new Error('network');
    const warnings = lakeWarningsOf(await readJson(relay, url));
    lakeWarnState.value = { warnings, at: now, trouble: null };
  } catch (error) {
    const old = error instanceof Error && error.message === 'old-relay';
    lakeWarnState.value = {
      ...lakeWarnState.peek(),
      at: now,
      trouble: old ? 'old-relay' : 'network',
    };
  }
  return lakeWarnState.value;
}

function showPop(pop: LakeWarnPop): void {
  showOverlays();
  lakeWarnPop.value = pop;
}

/**
 * Read now, and sound the alert for a warning newly lit on the lake of the
 * boat (or of the zone chosen with NavIn): the beeps, the bubble, a line in
 * the logbook of an open cruise.
 */
export async function lakeWarnCheck(): Promise<void> {
  if (!navigator.onLine) return;
  const { warnings } = await readLakeWarnings();
  const lit = litWarnings(warnings, Date.now());
  if (lit.length === 0 || !lakeWarnOn()) return;
  lookPlace((position) => {
    if (!position) return;
    const fresh = warningsNear(lit, position).filter(
      (warning) => !said.has(warningKey(warning)),
    );
    if (fresh.length === 0) return;
    for (const warning of fresh) said.add(warningKey(warning));
    playLightning();
    showPop({ warnings: fresh });
    if (state.data.cruise.peek()) {
      addEntry({
        id: uid(),
        t: new Date().toISOString(),
        v: {
          evt: ['Feux d’avis'],
          note: fresh.map(lakeWarningText).join(' '),
        },
      });
    }
  });
}

/** (Re)start the reading every five minutes. */
export function lakeWarnWatchStart(): void {
  clearInterval(timer);
  void lakeWarnCheck();
  timer = setInterval(() => void lakeWarnCheck(), EVERY_MS);
}

/** A test of the alert: a strong wind warning on the Grand Lac. */
export function lakeWarnTest(): void {
  const now = Date.now();
  playLightning();
  showPop({
    test: true,
    warnings: [
      {
        name: 'Grand Lac',
        level: 2,
        onset: now,
        expires: now + 2 * 3_600_000,
        outlook: false,
        text: 'Des rafales de 25 à 33 kt de secteur sud-ouest sont possibles.',
      },
    ],
  });
}
