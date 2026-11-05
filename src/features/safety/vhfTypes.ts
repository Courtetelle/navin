import type { ScriptContext, ScriptLine } from './sosScripts.ts';

/** Values of a routine call (legacy `vhfContext`). */
export interface VhfContext extends ScriptContext {
  raw: (key: VhfAskKey) => unknown;
  other: string;
  chan: string;
  nights: string;
  eta: string;
  dest: string;
  from: string;
  loaEn: string;
  beamEn: string;
  draftEn: string;
  airEn: string;
  loa: string;
  beam: string;
  draft: string;
  airDraft: string;
}

/** Fields a routine call may ask. */
export type VhfAskKey =
  'station' | 'other' | 'chan' | 'nights' | 'eta' | 'dest' | 'from';

/** A field of a routine call. */
export interface VhfAsk {
  label: string;
  ph: string;
  /** @default undefined */
  num?: boolean;
}

/** A routine call. */
export interface VhfCall {
  title: string;
  sub: string;
  ask: readonly VhfAskKey[];
  /** @default undefined */
  tip?: string;
  script: (context: VhfContext) => readonly ScriptLine[];
}

/** Names of the routine calls, in the order of the buttons. */
export type VhfCallKey =
  | 'check'
  | 'berth'
  | 'arrive'
  | 'buoy'
  | 'fuel'
  | 'ship'
  | 'intent'
  | 'meteo'
  | 'route'
  | 'bridge';
