/**
 * Regenerate src/features/safety/__tests__/legacy-golden.json: every SOS and VHF
 * message, position word, contact line and MOB log text, as the legacy app
 * writes them. Needs the legacy app on LEGACY_URL.
 *
 * Usage: node scripts/parity/goldenSafety.ts && npx prettier --write src/features/safety/__tests__/legacy-golden.json
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from 'playwright-core';

import { openApp } from './browser.ts';

const LEGACY_URL = process.env.LEGACY_URL ?? 'http://localhost:4301/';
const TARGET = join(
  import.meta.dirname,
  '../../src/features/safety/__tests__/legacy-golden.json',
);

// Evaluated in the legacy page, whose functions are globals of its scripts.
const COLLECT = String.raw`(() => {
  const out = {};
  out.spell = ['', 'HB1234', 'hb-12 é', 'Mistral', '0', 'XYZ 789'].map((x) => [x, spell(x)]);
  out.spellDigits = ['', '269000000', '123', '1234', '12 34 56 7', 'abc'].map((x) => [x, spellDigits(x)]);
  const base = structuredClone(cruise.info);
  const infos = [
    base,
    { ...base, callsign: '', mmsi: '' },
    { ...base, callsign: 'HB1234', mmsi: '' },
    { ...base, callsign: '', mmsi: '269000000' },
    { boat: '', contacts: '' },
    { boat: 'Éole', callsign: 'f-abc 1', mmsi: '227 123 456', loa: '12,5', beam: '3,9', draft: '1,8', airDraft: '17', coastStation: 'Cross Med', desc: 'White sloop, blue sails', vhfMarina: '9', reg: 'VD 123' },
    { boat: 'Pied', loaFt: '41', coque: 'Blanche' },
  ];
  const crews = [structuredClone(cruise.crew), [], [{ nom: 'Ana' }, { fonction: 'Second' }, { nom: 'Luc' }]];
  const positions = [null, { lat: 43.06, lon: 16.183, at: new Date().toISOString() }, { lat: -12.5, lon: -5.25, at: new Date().toISOString() }, { lat: 46.47, lon: 6.62, text: 'devant Ouchy' }];
  out.infos = infos; out.crews = crews.slice(0, 3); out.positions = positions;
  out.sos = [];
  out.vhf = [];
  const days = [{}, { canal: '11', eta: '18:00', dest: 'Vis' }];
  const vhfs = [{}, { station_check: 'Split Radio', chan_check: '24', nights: '3', eta: '19:15', dest: 'Korcula', from: 'Hvar', other: 'cargo rouge', station_berth: 'Port de Vis', chan_berth: '17', chan_ship: '77' }, { nights: '1', station_buoy: ' ', chan_buoy: '' }];
  const originalSos = sosPos;
  cruise.entries = [];
  infos.forEach((info, i) => crews.forEach((crew, c) => positions.forEach((position, q) => {
    cruise.info = info; cruise.crew = crew; sosPos = position;
    const first = i === 0 && c === 0 && q === 1;
    for (const kind of Object.keys(SOS)) {
      const natures = [null, ...(SOS[kind].natures || [])];
      const last = first ? natures.length : Math.min(2, natures.length);
      for (let n = 0; n < last; n++) {
        out.sos.push({ info: i, crew: c, position: q, kind, nature: n - 1, lines: SOS[kind].script(sosContext(natures[n])).filter(Boolean) });
      }
    }
    if (c === 0 && q < 3) {
      days.forEach((day, d) => vhfs.forEach((remembered, v) => {
        if (i > 0 && (d > 0 || v > 0)) return;
        cruise.days[dayKey(new Date())] = day; settings.vhf = remembered;
        for (const call of Object.keys(VHF_CALLS)) {
          const context = vhfContext(call);
          const here = position && position.lat != null ? nearestPort(position.lat, position.lon, 10) : '';
          out.vhf.push({ info: i, position: q, day: d, remembered: v, nearestPort: here, call, raw: VHF_CALLS[call].ask.map((a) => context.raw(a) ?? null), lines: VHF_CALLS[call].script(context).filter(Boolean) });
        }
      }));
    }
  })));
  out.days = days; out.remembered = vhfs;
  sosPos = originalSos;
  // place words: grid over the lake, the Provence coast and elsewhere
  out.places = [];
  for (let lat = 46.19; lat < 46.56; lat += 0.0371) for (let lon = 6.1; lon < 6.96; lon += 0.0613) { const q = { lat: Math.round(lat * 1e4) / 1e4, lon: Math.round(lon * 1e4) / 1e4 }; out.places.push([q.lat, q.lon, sosPlaceWords(q)]); }
  for (let lat = 42.7; lat < 43.7; lat += 0.0833) for (let lon = 5.2; lon < 7; lon += 0.1177) { const q = { lat: Math.round(lat * 1e4) / 1e4, lon: Math.round(lon * 1e4) / 1e4 }; out.places.push([q.lat, q.lon, sosPlaceWords(q)]); }
  for (const [lat, lon] of [[46.204, 6.152], [46.506, 6.627], [43.0, 6.2], [43.2, 6.682], [43.2005, 6.6825], [46.47, 6.62], [46.418, 6.72], [43.06, 5.98], [47.5, 9.4], [0, 0], [46.3, 6.15]]) out.places.push([lat, lon, sosPlaceWords({ lat, lon })]);
  // contacts
  const texts = [LAKE_CONTACTS, DEFAULT_CONTACTS, LEMAN_FR_CONTACTS, '', '  \n  ', 'Marina : +385 21 000 001 ou 021 000 00 02\nVHF : canal 9\nPolice : 117\nCapitainerie : 15.07.2026\nTél. 079 123 45 67\nBase, ponton 3 : tél. 021 345 67 89 (Jean)\n17\nUrgence : 112, 18 ou 15\nAdresse sans numéro', 'Nom : a : b : 123 456\nLong : 021 000 00 00 un texte bien plus long que quarante caractères pour la démonstration\nCourt : 12'];
  out.contacts = texts.map((text) => [text, contactsHtml(text)]);
  const crewSets = [
    [{ nom: 'Ana', fonction: 'Skipper', tel: '+41 79 000 00 01, 021 000 00 02', procheNom: 'Zoé', procheTel: '+41 79 000 00 03', proche2Tel: '+41 79 000 00 04' }],
    [{ nom: '', tel: '079 000 00 05', proche: 'Paul 079 000 00 06.' }, { nom: 'Luc', proche: 'sans numéro' }, { proche2Nom: 'X', proche2Tel: '12345' }],
  ];
  out.crewCalls = crewSets.map((crew) => { cruise.crew = crew; return [crew, crewCallsHtml()]; });
  // logs
  const t = '2026-07-15T08:30:00.000Z';
  const log = (kind, zone, extra) => ({ id: 'x', kind, zone, start: t, events: [{ t, type: 'start', what: 'Début' }, { t: '2026-07-15T08:31:05.000Z', what: 'Étape', pos: { lat: 46.47, lon: 6.62 } }], ...extra });
  const logs = [log('real', 'lac'), log('train', 'mer'), log('real', 'mer', { end: '2026-07-15T08:47:40.000Z' })];
  out.mobText = [];
  for (const l of logs) for (const name of ['Croatie 2026', '']) { cruise.info = { name }; out.mobText.push([l, name, mobLogText(l)]); }
  return out;
})()`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const legacy = await openApp(
    browser,
    LEGACY_URL,
    {
      name: 'golden-safety',
      fixture: 'sample-sea',
      overrides: { 'ldb.tipIdx': '6' },
      steps: [],
    },
    false,
  );
  const golden = await legacy.page.evaluate<Record<string, unknown[]>>(COLLECT);
  writeFileSync(TARGET, `${JSON.stringify(golden)}\n`);
  for (const [name, list] of Object.entries(golden)) {
    process.stdout.write(`${name}: ${list.length}\n`);
  }
  await legacy.close();
} finally {
  await browser.close();
}
