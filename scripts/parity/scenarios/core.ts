import type { Scenario } from '../types.ts';

/*
 * Shared fixtures, generated from the legacy app (shapes are real):
 *   node scripts/parity/run.ts scripts/parity/scenarios/core.ts --only '^core-empty$' --dump empty
 *   node scripts/parity/run.ts scripts/parity/scenarios/core.ts --only '^core-sample-lake$' --dump sample-lake
 *   node scripts/parity/run.ts scripts/parity/scenarios/core.ts --only '^core-sample-sea$' --dump sample-sea
 *   node scripts/parity/run.ts scripts/parity/scenarios/core.ts --only '^core-sample$' --dump sample
 *   node scripts/parity/run.ts scripts/parity/scenarios/core.ts --only '^core-old$' --dump old-migrated
 * (`old-input.json` is hand-written data of old versions, to check every one-shot migration.)
 * The eval steps call legacy globals; they only run with --dump / --legacy-only.
 * Clock fixed at 2026-07-15 10:30 Europe/Zurich (08:30 UTC), Math.random seeded.
 * After a dump, JSON string values (`ldb.current`, `ldb.*.at`) are re-quoted so
 * that the harness seed stores them as JSON again (see CORE_API.md § 6); the
 * unit tests in src/state/__tests__/legacyBoot.test.ts compare the state layer
 * with these files byte for byte.
 */

/** Lake day outing on the Savannah with crew, entries, day sheet, checklist state, an SOS log, a mark. */
const LAKE_OUTING = `(() => {
  const boat = boatById('savannah');
  const outing = blankOuting('Entraînement du 15.07', boat, 'jour');
  outing.purpose = 'Entraînement';
  const byId = (id) => members.find((m) => m.id === id);
  outing.crew = [crewFromMember(byId('ex2'), 'Skipper'), crewFromMember(byId('ex1'), 'Second'), crewFromMember(byId('ex5'), 'Équipier')];
  cruise = outing; draft = null; currentDay = null;
  saveCruise();
  noteUse('boat', boat.id, 'Entraînement');
  addEntry({ id: 'lk-e1', t: '2026-07-15T06:40:00.000Z', auto: true, v: { pos: { lat: 46.5049, lon: 6.4968 }, sog: 0, loch: 0, evt: ['Départ'], twd: 225, tws: 8 }, windSrc: 'trace' });
  addEntry({ id: 'lk-e2', t: '2026-07-15T07:10:00.000Z', auto: true, needWx: true, v: { pos: { lat: 46.4925, lon: 6.4812 }, sog: 4.8, cog: 222, loch: 1.2, evt: ['Changement de cap'] } });
  addEntry({ id: 'lk-e3', t: '2026-07-15T07:25:00.000Z', v: { quart: 'Thomas Keller', allure: 'Près', gv: 'Haute', avant: 'Foc', twd: 230, tws: 12, feux: 'Prudence', mer: '2', note: 'Bise qui fraîchit, un ris préparé.' } });
  addEntry({ id: 'lk-e4', t: '2026-07-15T08:05:00.000Z', auto: true, v: { pos: { lat: 46.4811, lon: 6.4655 }, sog: 5.4, cog: 238, loch: 2.9, evt: ['Virement'] } });
  const today = dayKey(new Date());
  const day = dayData(today);
  Object.assign(day, { typeSortie: 'Entraînement', skipper: 'Thomas Keller', coSkipper: 'Camille Rochat', equipage: 'Noa Dubois', moteurDebut: '1234,5', carbPct: '80', batt1: '12,6', batt2: '12,5', eauPct: '60', diesel: '3/4', observations: 'Taquet avant tribord à resserrer.' });
  const dep = boat.checklistDep;
  day.checkDone = dep.slice(0, 4).map((x) => x.id);
  day.ckOpen = [dep[4].id];
  saveCruise();
  marks.push({ id: 'mk-lake', n: 12, name: 'M012', at: '2026-07-15T07:30:00.000Z', lat: 46.488, lon: 6.475, depth: '34', note: 'Bouée de régate' });
  store.set('ldb.markSeq', 12); saveMarks();
  members.push({ id: 'm-lea', prenom: 'Léa', nom: 'Favre', sexe: 'Femme', tel: intlPhone('079 555 12 34'), email: 'lea.favre@example.org' });
  saveMembers();
  crewSets.push({ id: 'cs-lake', name: 'Équipe du mercredi', crew: [{ memberId: 'ex2', fonction: 'Skipper' }, { memberId: 'm-lea', fonction: 'Équipier' }] });
  saveCrewSets();
  sosLogAdd('🆘 Touche SOS', 'sos');
  sosLogAdd('Page VHF ouverte');
  sosLogEnd();
})()`;

/** Sea cruise over two days with crew, entries, day sheets, info and contacts. */
const SEA_CRUISE = String.raw`(() => {
  const sea = blankCruise('Croatie 2026', null);
  sea.zone = 'M';
  Object.assign(sea.info, { ports: 'Split – Split', du: '2026-07-14', au: '2026-07-21', boat: 'Mistral', model: 'Bavaria C42', year: '2021', waters: 'Eaux maritimes', loa: '12,35', beam: '4,29', draft: '2,10', airDraft: '19,6', callsign: 'HB1234', mmsi: '269000000', hullColor: 'Grise', coastStation: 'Split Radio', base: 'Base de Split, ponton 3 : +385 21 000 000', contacts: 'Urgence (Europe) : 112\nCapitainerie de Split : +385 21 000 001\nLoueur, permanence : +385 91 000 0002' });
  const byId = (id) => members.find((m) => m.id === id);
  sea.crew = [crewFromMember(byId('ex6'), 'Skipper'), crewFromMember(byId('ex4'), 'Second'), crewFromMember(byId('ex3'), 'Équipier'), { nom: 'Invité sans fiche', fonction: 'Équipier' }];
  cruise = sea; draft = null; currentDay = null;
  saveCruise();
  addEntry({ id: 'sea-e1', t: '2026-07-14T07:00:00.000Z', v: { pos: { lat: 43.5047, lon: 16.4393 }, loch: 0, sog: 0, evt: ['Départ', 'Début moteur'], baro: 1016, visi: 'TB', quart: 'Elena García' } });
  addEntry({ id: 'sea-e2', t: '2026-07-14T09:00:00.000Z', v: { pos: { lat: 43.4012, lon: 16.3001 }, loch: 9.6, sog: 5.5, hdg: 215, cog: 212, allure: 'Travers', twd: 300, tws: 14, mer: '3', vagues: 290, gv: 'Haute', avant: 'Génois', evt: ['Fin moteur', 'Début voile'], baro: 1015 } });
  addEntry({ id: 'sea-e3', t: '2026-07-14T13:30:00.000Z', v: { pos: { lat: 43.1721, lon: 16.4410 }, loch: 24.3, sog: 0, evt: ['Arrivée', 'Mouillage'], note: 'Mouillage à Hvar, fond de sable.' } });
  addEntry({ id: 'sea-e4', t: '2026-07-15T06:15:00.000Z', v: { pos: { lat: 43.1721, lon: 16.4410 }, loch: 24.3, evt: ['Départ'], baro: 1012, tws: 18, twd: 320 } });
  addEntry({ id: 'sea-e5', t: '2026-07-15T08:00:00.000Z', auto: true, needWx: true, v: { pos: { lat: 43.0607, lon: 16.1830 }, loch: 37.1, sog: 6.2, cog: 245, evt: ['Changement de cap'] } });
  Object.assign(dayData('2026-07-14'), { de: 'Split', a: 'Hvar', fVentDir: '300', fVentVit: '14', fPression: '1016', moteurSoir: '1520,5', plein: '', nmJour: '24,3', ctrl: ['Eau douce relevée', 'VHF ON, squelch'], dest: 'Hvar', canal: '17', debrief: 'Belle journée, mouillage calme.' });
  Object.assign(dayData('2026-07-15'), { de: 'Hvar', a: 'Vis', fVentDir: '320', fVentVit: '18', fRafales: '25', etd: '08:00', eta: '15:00' });
  Object.assign(sea.info, { moteurInit: '1515' });
  saveCruise();
})()`;

export const scenarios: Scenario[] = [
  { name: 'core-empty', steps: [{ wait: 500 }] },
  { name: 'core-old', fixture: 'old-input', steps: [{ wait: 500 }] },
  {
    name: 'core-sample-lake',
    steps: [{ eval: LAKE_OUTING }, { wait: 800 }],
  },
  {
    name: 'core-sample-sea',
    steps: [{ eval: SEA_CRUISE }, { wait: 800 }],
  },
  {
    name: 'core-sample',
    steps: [
      { eval: SEA_CRUISE },
      { wait: 300 },
      { eval: LAKE_OUTING },
      { wait: 800 },
    ],
  },
];
