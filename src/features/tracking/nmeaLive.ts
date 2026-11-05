import { signal } from '@preact/signals-react';

import type { TrueWind } from './nmeaParser.ts';
import { nmeaTrueWind } from './nmeaParser.ts';

/** Latest instrument values. */
export interface NmeaReadings {
  /** @default undefined */
  lat?: number;
  /** @default undefined */
  lon?: number;
  /** @default undefined */
  sog?: number;
  /** @default undefined */
  cog?: number;
  /** @default undefined */
  hdg?: number;
  /** @default undefined */
  stw?: number;
  /** @default undefined */
  aws?: number;
  /** @default undefined */
  awa?: number;
  /** @default undefined */
  tws?: number;
  /** @default undefined */
  twd?: number;
  /** @default undefined */
  twa?: number;
  /** @default undefined */
  depth?: number;
  /** @default undefined */
  wtemp?: number;
  /** @default undefined */
  twsCalc?: number;
  /** @default undefined */
  twdCalc?: number | null;
}

/** A value kept in {@link NmeaReadings}. */
export type NmeaKey = keyof NmeaReadings;

/** Connection state of the instruments. */
export type NmeaStatus = 'off' | 'wait' | 'ok' | 'err';

/** The instruments link: mutable, redrawn through {@link nmeaRevision}. */
export const nmeaLink = {
  socket: null as WebSocket | null,
  on: false,
  status: 'off' as NmeaStatus,
  error: '',
  live: {} as NmeaReadings,
  at: {} as Partial<Record<NmeaKey, number>>,
  retry: undefined as ReturnType<typeof setTimeout> | undefined,
  messages: 0,
  server: undefined as string | undefined,
};

/** What the instruments screen shows of the link. */
export interface NmeaLinkView {
  on: boolean;
  status: NmeaStatus;
  error: string;
  messages: number;
  server: string | undefined;
}

/** A new value is set whenever the instruments screen must be redrawn (legacy `nmDraw`). */
export const nmeaLinkView = signal<NmeaLinkView>({
  on: false,
  status: 'off',
  error: '',
  messages: 0,
  server: undefined,
});

const FRESH_MS = 15_000;

/**
 * Redraw the instruments screen (legacy `nmDraw`).
 */
export function nmeaRedraw(): void {
  const { on, status, error, messages, server } = nmeaLink;
  nmeaLinkView.value = { on, status, error, messages, server };
}

/**
 * A value received less than 15 s ago (legacy `nmFresh`).
 * @param key - Value name.
 * @returns `true` when fresh.
 */
export function nmeaFresh(key: NmeaKey): boolean {
  const at = nmeaLink.at[key];
  return Boolean(at) && Date.now() - (at ?? 0) < FRESH_MS;
}

/**
 * Keep a received value (legacy `nmSet`); absent and `NaN` values are ignored.
 * @param key - Value name.
 * @param value - Received value.
 */
export function nmeaSet(
  key: Exclude<NmeaKey, 'twdCalc'>,
  value: number | null | undefined,
): void {
  if (value == null || Number.isNaN(value)) return;
  nmeaLink.live[key] = value;
  nmeaLink.at[key] = Date.now();
}

/**
 * Up-to-date true wind for the automatic journal (legacy `window.nmeaWind`).
 * @returns Speed and direction, or `null`.
 */
export function nmeaWind(): { tws: number; twd: number } | null {
  const { tws, twd, twsCalc, twdCalc } = nmeaLink.live;
  if (nmeaFresh('tws') && nmeaFresh('twd') && tws != null && twd != null) {
    return { tws, twd };
  }
  if (nmeaFresh('twsCalc') && twsCalc != null && twdCalc != null) {
    return { tws: twsCalc, twd: twdCalc };
  }
  return null;
}

/**
 * The instruments give a fresh position, which takes over the phone GPS
 * (legacy `window.nmeaPosFresh`).
 * @returns `true` when connected with a fresh position.
 */
export function nmeaPosFresh(): boolean {
  return nmeaLink.on && nmeaFresh('lat');
}

/**
 * Freshest heading: the compass, else the course over ground.
 * @returns The heading, or `null`.
 */
export function nmeaHeading(): number | null {
  if (nmeaFresh('hdg')) return nmeaLink.live.hdg ?? null;
  return nmeaFresh('cog') ? (nmeaLink.live.cog ?? null) : null;
}

/**
 * Compute the true wind from the apparent wind when the instruments do not
 * give it (first part of legacy `nmAfter`).
 * @returns The computed wind, or `null` when nothing changed.
 */
export function nmeaComputeTrueWind(): TrueWind | null {
  if (nmeaFresh('tws') || !nmeaFresh('aws') || !nmeaFresh('awa')) return null;
  const { aws, awa, stw, sog } = nmeaLink.live;
  const boatSpeed = nmeaFresh('stw') ? stw : nmeaFresh('sog') ? sog : 0;
  const wind = nmeaTrueWind(aws, awa, boatSpeed, nmeaHeading());
  if (!wind) return null;
  nmeaLink.live.twsCalc = wind.tws;
  nmeaLink.live.twdCalc = wind.twd;
  nmeaLink.at.twsCalc = Date.now();
  return wind;
}
