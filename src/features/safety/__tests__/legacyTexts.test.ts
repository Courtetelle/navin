import { expect, test } from 'vitest';

import type { CrewMember, CruiseInfo, Day } from '../../../model/types.ts';
import type { ContactItem } from '../contacts.ts';
import { contactItems, crewCalls } from '../contacts.ts';
import type { MobLogRecord } from '../mobLog.ts';
import { mobLogText } from '../mobLogText.ts';
import { spell, spellDigits } from '../nato.ts';
import { sosContext } from '../sosContext.ts';
import { sosPlaceWords } from '../sosPlaces.ts';
import type { ScriptLine, SosKind } from '../sosScripts.ts';
import { SOS } from '../sosScripts.ts';
import { VHF_CALLS } from '../vhfCalls.ts';
import { vhfContext } from '../vhfContext.ts';
import type { VhfCallKey } from '../vhfTypes.ts';

import rawGolden from './legacy-golden.json' with { type: 'json' };

/** Texts produced by the legacy app itself, for a matrix of boats, crews, positions and fields. */
interface Golden {
  spell: Array<[string, string]>;
  spellDigits: Array<[string, string]>;
  infos: CruiseInfo[];
  crews: CrewMember[][];
  positions: Array<{ lat: number; lon: number; text?: string } | null>;
  days: Day[];
  remembered: Array<Record<string, string>>;
  sos: Array<{
    info: number;
    crew: number;
    position: number;
    kind: SosKind;
    nature: number;
    lines: string[][];
  }>;
  vhf: Array<{
    info: number;
    position: number;
    day: number;
    remembered: number;
    nearestPort: string | null;
    call: VhfCallKey;
    raw: unknown[];
    lines: string[][];
  }>;
  places: Array<[number, number, string]>;
  contacts: Array<[string, string]>;
  crewCalls: Array<[CrewMember[], string]>;
  mobText: Array<[MobLogRecord, string, string]>;
}

const golden = rawGolden as unknown as Golden;
const now = new Date('2026-07-15T08:30:00.000Z');

function present(lines: readonly ScriptLine[]): ScriptLine[] {
  return lines.filter(Boolean);
}

function escaped(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function callHtml(label: string, number: string, sub: string): string {
  const tel = number.replaceAll(/[^\d+]/g, '');
  const tail = sub ? ` · ${escaped(sub)}` : '';
  return `<a class="btn contact call" href="tel:${tel}"><span class="ph">📞</span><span><b>${escaped(label || number)}</b><span>${escaped(number)}${tail}</span></span></a>`;
}

function contactHtml(item: ContactItem): string {
  if (item.kind === 'call') return callHtml(item.label, item.number, item.sub);
  return `<div class="btn contact static"><b>${escaped(item.label)}</b><span>${escaped(item.value)}</span></div>`;
}

test('spelling matches legacy', () => {
  for (const [text, expected] of golden.spell) {
    expect(spell(text)).toBe(expected);
  }
  for (const [text, expected] of golden.spellDigits) {
    expect(spellDigits(text)).toBe(expected);
  }
  expect(spell('HB1234')).toBe('Hotel Bravo One Two Three Four');
  expect(spellDigits('269000000')).toBe(
    'Two Six Niner · Zero Zero Zero · Zero Zero Zero',
  );
});

test('the 685 SOS messages are character-identical to legacy', () => {
  expect(golden.sos).toHaveLength(685);
  for (const entry of golden.sos) {
    const procedure = SOS[entry.kind];
    const nature =
      entry.nature >= 0 ? (procedure.natures?.[entry.nature] ?? null) : null;
    const context = sosContext(
      {
        info: golden.infos[entry.info] as CruiseInfo,
        crew: golden.crews[entry.crew] as CrewMember[],
        position: golden.positions[entry.position] ?? null,
        now,
      },
      nature,
    );
    expect(present(procedure.script(context))).toStrictEqual(entry.lines);
  }
});

test('the MAYDAY of the sample boat reads as expected', () => {
  const context = sosContext(
    {
      info: {
        boat: 'Mistral',
        callsign: 'HB1234',
        mmsi: '269000000',
        loa: '12,35',
      },
      crew: [{ nom: 'Elena' }, { nom: 'Luca' }, { fonction: 'Second' }],
      position: { lat: 43.06, lon: 16.183 },
      now,
    },
    ['Incendie', 'We are on fire.', 'Nous sommes en feu.'],
  );
  expect(present(SOS.mayday.script(context)).slice(0, 6)).toStrictEqual([
    ['MAYDAY MAYDAY MAYDAY'],
    [
      'This is sailing yacht MISTRAL MISTRAL MISTRAL',
      'Call sign HB1234 (Hotel Bravo One Two Three Four) · MMSI Two Six Niner · Zero Zero Zero · Zero Zero Zero',
    ],
    ['MAYDAY MISTRAL HB1234  269000000'],
    ["Position 43°03,600' N  016°10,980' E", 'at 08:30 UTC'],
    ['We are on fire.', 'Nous sommes en feu.'],
    ['2 people on board.', '2 personnes à bord.'],
  ]);
});

test('the 360 routine VHF calls are character-identical to legacy', () => {
  expect(golden.vhf).toHaveLength(360);
  for (const entry of golden.vhf) {
    const context = vhfContext(entry.call, {
      info: golden.infos[entry.info] as CruiseInfo,
      crew: golden.crews[0] as CrewMember[],
      position: golden.positions[entry.position] ?? null,
      now,
      day: golden.days[entry.day] as Day,
      remembered: golden.remembered[entry.remembered] as Record<string, string>,
      nearestPort: entry.nearestPort,
    });
    const definition = VHF_CALLS[entry.call];
    expect(present(definition.script(context))).toStrictEqual(entry.lines);
    const fields = definition.ask.map((field) => context.raw(field) ?? null);
    expect(fields).toStrictEqual(entry.raw);
  }
});

test('positions in words are identical to legacy', () => {
  expect(golden.places).toHaveLength(369);
  for (const [lat, lon, expected] of golden.places) {
    expect(sosPlaceWords({ lat, lon })).toBe(expected);
  }
  expect(sosPlaceWords(null)).toBe('');
});

test('contacts become the same call buttons as legacy', () => {
  for (const [text, expected] of golden.contacts) {
    let html = '';
    for (const item of contactItems(text)) html += contactHtml(item);
    expect(html).toBe(expected);
  }
});

test('crew calls are the same as legacy', () => {
  for (const [crew, expected] of golden.crewCalls) {
    let html = '';
    for (const call of crewCalls(crew)) {
      html += callHtml(call.label, call.number, call.sub);
    }
    expect(html).toBe(expected);
  }
});

test('the text of a man-overboard log is identical to legacy', () => {
  process.env.TZ = 'Europe/Zurich';
  for (const [log, name, expected] of golden.mobText) {
    expect(mobLogText(log, name)).toBe(expected);
  }
});
