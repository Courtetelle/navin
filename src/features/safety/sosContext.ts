import { radioDesc } from '../../lib/boatDescription.ts';
import { pad, textOf } from '../../lib/format.ts';
import { fmtPos } from '../../lib/geo.ts';
import type { CrewMember, CruiseInfo } from '../../model/types.ts';

import { spell, spellDigits } from './nato.ts';
import type { ScriptContext, SosNature } from './sosScripts.ts';

/** What a radio message is built from. */
export interface ScriptSource {
  info: Readonly<CruiseInfo>;
  crew: readonly CrewMember[];
  position: { lat: number; lon: number; text?: unknown } | null;
  now: Date;
}

/**
 * Values of a radio message (legacy `sosContext`).
 * @param source - Boat, crew, position and time.
 * @param nature - Distress nature chosen, or `null`.
 * @returns The values inserted in the scripts.
 */
export function sosContext(
  source: ScriptSource,
  nature: SosNature | null,
): ScriptContext {
  const { info, crew, position, now } = source;
  const boat = (textOf(info.boat) || '[nom du bateau]').toUpperCase();
  const callsign = textOf(info.callsign);
  const mmsi = textOf(info.mmsi);
  let onBoard = 0;
  for (const member of crew) if (member.nom) onBoard++;
  return {
    boat,
    boat3: `${boat} ${boat} ${boat}`,
    idShort: [callsign, mmsi].filter(Boolean).join('  '),
    idLine: [
      callsign ? `Call sign ${callsign} (${spell(callsign)})` : '',
      mmsi ? `MMSI ${spellDigits(mmsi)}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    pos: position ? fmtPos(position) : '[position]',
    utc: `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`,
    pob: onBoard || '[nombre]',
    desc: radioDesc(info, 'en'),
    descFr: radioDesc(info, 'fr'),
    station: textOf(info.coastStation) || '[station côtière]',
    nature: nature ? nature[1] : '[nature de la détresse]',
    natureFr: nature ? nature[2] : '',
  };
}
