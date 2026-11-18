import { signal } from '@preact/signals-react';

import { uid } from '../../lib/format.ts';
import { addEntry, recordAlert, state } from '../../state/index.ts';

import { relayed } from './euStations.ts';
import { lakeFix } from './lakeFix.ts';
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
import { showOverlays } from './overlayRoot.ts';
import { playLakeLight } from './windAudio.ts';

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
 * NavIn is in a sea zone (Atlantique, Méditerranée): the warning lights of
 * the lakes are not for the boat, wherever the GPS is.
 * @returns True at sea.
 */
export function atSea(): boolean {
  return state.view.zoneSimV.peek() === 'mer';
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
  if (lit.length === 0 || !lakeWarnOn() || atSea()) return;
  // The GPS only: the part of the Léman where the boat is.
  lakeFix((position) => {
    if (!position) return;
    const fresh = warningsNear(lit, position).filter(
      (warning) => !said.has(warningKey(warning)),
    );
    if (fresh.length === 0) return;
    for (const warning of fresh) said.add(warningKey(warning));
    playLakeLight(Math.max(...fresh.map((warning) => warning.level)));
    showPop({ warnings: fresh });
    // In the journal of the alerts, with or without an open cruise.
    recordAlert('feux', 'Feux d’avis', fresh.map(lakeWarningText).join(' '));
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

/**
 * A test of the alert on the Grand Lac: strong wind (40 flashes a minute)
 * or storm (90 a minute, louder and brighter).
 * @param level - 2 strong wind, 3 storm.
 */
export function lakeWarnTest(level = 2): void {
  const now = Date.now();
  const storm = level >= 3;
  playLakeLight(level);
  showPop({
    test: true,
    warnings: [
      {
        name: 'Grand Lac',
        level,
        onset: now,
        expires: now + 2 * 3_600_000,
        outlook: false,
        text: storm
          ? 'Des rafales de 35 à 45 kt de secteur sud-ouest sont possibles.'
          : 'Des rafales de 25 à 33 kt de secteur sud-ouest sont possibles.',
      },
    ],
  });
}

/**
 * A test of alerts coming together: the wind, the lightning and the warning
 * lights, shown one after the other (each waits until the one before is
 * closed).
 */
export function alertsInTurnTest(): void {
  void Promise.all([
    import('./windOverlayState.ts'),
    import('./lightningWatch.ts'),
  ]).then(([{ showWindPopup }, { lightningTest }]) => {
    showWindPopup({
      bf: 6,
      kn: '24 nd en rafales',
      where: 'TEST · mesuré à St-Prex (MeteoSwiss)',
      closeTxt: 'Toucher pour fermer',
    });
    lightningTest();
    lakeWarnTest();
  });
}
