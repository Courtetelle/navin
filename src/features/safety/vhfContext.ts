import { pairConv } from '../../lib/boatValues.ts';
import { stringOf, textOf } from '../../lib/format.ts';
import { fmtPos } from '../../lib/geo.ts';
import type { Day } from '../../model/types.ts';

import type { ScriptSource } from './sosContext.ts';
import { sosContext } from './sosContext.ts';
import type { VhfAskKey, VhfCallKey, VhfContext } from './vhfTypes.ts';

/** Fields remembered per call rather than for all calls. */
const PER_CALL: ReadonlySet<VhfAskKey> = new Set(['station', 'chan']);

/** What a routine call is built from, besides the radio message source. */
export interface VhfSource extends ScriptSource {
  /** Day sheet of today. */
  day: Readonly<Day>;
  /** Values typed earlier (`settings.vhf`). */
  remembered: Readonly<Record<string, unknown>>;
  /** Nearest known port, or a falsy value. */
  nearestPort: string | null | undefined;
}

/**
 * Settings key of a field of a routine call.
 * @param field - Field.
 * @param call - Call.
 * @returns The key in `settings.vhf`.
 */
export function vhfSettingKey(field: VhfAskKey, call: VhfCallKey): string {
  return PER_CALL.has(field) ? `${field}_${call}` : field;
}

/**
 * Values of a routine call (legacy `vhfContext`).
 * @param call - Call.
 * @param source - Boat, crew, position, day, remembered fields, nearest port.
 * @returns The values inserted in the script.
 */
export function vhfContext(call: VhfCallKey, source: VhfSource): VhfContext {
  const { info, day, remembered, nearestPort } = source;
  const here = nearestPort;
  const port = here ? `Port de ${here}` : '';
  const stations: Readonly<Record<VhfCallKey, unknown>> = {
    check: info.coastStation,
    berth: port,
    arrive: port,
    buoy: '',
    fuel: port,
    ship: undefined,
    intent: undefined,
    meteo: info.coastStation,
    route: info.coastStation,
    bridge: '',
  };
  const defaults: Readonly<Record<VhfAskKey, unknown>> = {
    station: stations[call],
    other: undefined,
    chan: defaultChannel(call, day, info.vhfMarina),
    nights: '1',
    eta: day.eta,
    dest: day.dest,
    from: here || '',
  };
  const raw = (key: VhfAskKey): unknown => {
    const stored = remembered[vhfSettingKey(key, call)];
    return stored != null && stored !== '' ? stored : defaults[key];
  };
  const length = info.loa || pairConv(info.loaFt, 0.3048, 2);
  return {
    ...sosContext(source, null),
    raw,
    station: orPlaceholder(raw('station'), 'station').toUpperCase(),
    other: orPlaceholder(raw('other'), 'navire').toUpperCase(),
    chan: orPlaceholder(raw('chan'), 'canal'),
    nights: orPlaceholder(raw('nights'), 'nuits'),
    eta: orPlaceholder(raw('eta'), 'heure'),
    dest: orPlaceholder(raw('dest'), 'destination'),
    from: orPlaceholder(raw('from'), 'départ'),
    loaEn: orPlaceholder(length, 'length').replace(',', '.'),
    beamEn: orPlaceholder(info.beam, 'beam').replace(',', '.'),
    draftEn: orPlaceholder(info.draft, 'draft').replace(',', '.'),
    airEn: orPlaceholder(info.airDraft, 'air draft').replace(',', '.'),
    loa: orPlaceholder(length, 'longueur'),
    beam: orPlaceholder(info.beam, 'largeur'),
    draft: orPlaceholder(info.draft, 'tirant d’eau'),
    airDraft: orPlaceholder(info.airDraft, 'tirant d’air'),
  };
}

/** What the lake message is built from. */
export interface LakeMessageSource {
  /** Boat name. */
  boat: unknown;
  /** Registration. */
  registration: unknown;
  position: { lat: number; lon: number; text?: unknown } | null;
  /** The position is on the French side of Lake Geneva. */
  french: boolean;
  /** People on board. */
  onBoard: number;
  /** Boat description. */
  description: string;
}

/**
 * Message to dictate on the phone on a lake (legacy `renderVhfLake`).
 * @param source - Boat, position and crew.
 * @returns The lines.
 */
export function lakeMessage(source: LakeMessageSource): string[] {
  const { boat, registration, position, french, onBoard, description } = source;
  const place = position ? fmtPos(position) : '(position GPS)';
  return [
    `Ici le voilier ${textOf(boat) || '(nom du bateau)'}${registration ? `, immatriculé ${textOf(registration)}` : ''}.`,
    `Position : ${place}${french ? ', côté français du Léman' : ''}.`,
    'Nature du problème : (homme à la mer, voie d’eau, avarie, malaise…).',
    `Nous sommes ${onBoard || '(nombre)'} personne${onBoard === 1 ? '' : 's'} à bord.`,
    'Aide demandée : (remorquage, secours, médecin…).',
    `Description : ${description || '(coque, voiles)'}.`,
  ];
}

function defaultChannel(
  call: VhfCallKey,
  day: Readonly<Day>,
  marina: unknown,
): unknown {
  if (call === 'ship') return '72';
  if (['check', 'meteo', 'route'].includes(call)) return '';
  return day.canal || marina;
}

/** Legacy `vv`: the trimmed value, else `[placeholder]`. */
function orPlaceholder(value: unknown, placeholder: string): string {
  const text = value == null ? '' : stringOf(value).trim();
  return text === '' ? `[${placeholder}]` : text;
}
