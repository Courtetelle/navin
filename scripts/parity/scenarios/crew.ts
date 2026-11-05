import type { Scenario, Step } from '../types.ts';

/** No boot tip, and the remark pill away from the language button. */
const quiet = { 'ldb.tipIdx': '6', 'ldb.remPill': { x: 10, y: 300 } };
/** An address book and a crew list without the example cards. */
const noCards = { ...quiet, 'ldb.members': '[]', 'ldb.crewSets': '[]' };
/** Nothing protects the cards. */
const noCrews = { ...quiet, 'ldb.crewSets': '[]' };

/** The lazy page needs some time on the first visit. */
function open(view: string): Step[] {
  return [{ go: view }, { wait: 1200 }];
}

/** Snapshot from the top of the page. */
function shot(name: string): Step[] {
  return [{ eval: 'window.scrollTo(0, 0)' }, { snapshot: name }];
}

/** Bring an element into the viewport, for the long presses. */
function reveal(selector: string): Step {
  return { eval: `document.querySelector('${selector}').scrollIntoView()` };
}

/** Run a click without being blocked by the bubble that covers the button. */
function tap(selector: string): Step {
  return { eval: `document.querySelector('${selector}').click()` };
}

/** Copy storage keys into compared attributes of `<body>`. */
function stored(...keys: string[]): Step {
  const parts = keys.map(
    (key) =>
      `document.body.setAttribute('x-${key}', localStorage.getItem('${key}'))`,
  );
  return { eval: parts.join(';') };
}

/** Slide a row to the left, as a finger does. */
function swipe(selector: string): Step {
  return {
    eval: `(() => {
      const row = document.querySelector('${selector}');
      const top = row.getBoundingClientRect().top + 5;
      const at = (clientX) => ({ bubbles: true, cancelable: true, clientX, clientY: top, pointerId: 1 });
      row.dispatchEvent(new PointerEvent('pointerdown', at(300)));
      row.dispatchEvent(new PointerEvent('pointermove', at(280)));
      row.dispatchEvent(new PointerEvent('pointermove', at(180)));
      row.dispatchEvent(new PointerEvent('pointerup', at(180)));
    })()`,
  };
}

function scenario(
  name: string,
  fixture: string,
  steps: Step[],
  overrides: Scenario['overrides'] = quiet,
): Scenario {
  return { name, fixture, overrides, steps };
}

const received = [
  'NavIn · Fiche coéquipier·ère',
  '',
  'Prénom : Camille',
  'Nom : Rochat',
  'Homme ou femme (remplis H ou F) : F',
  'Téléphone (avec indicatif, ex. +41) : 0791112233',
  'Courriel : camille@example.org',
  'Adresse postale : Rue Neuve 9',
  '1000 Lausanne',
  'Permis bateau n° : Z-1',
].join('\n');
const receivedNew = [
  'NavIn · Crew member sheet',
  'First name : Ana',
  'Last name : Silva',
  'Man or woman (write M or W) : W',
  'Phone (with country code, e.g. +41) : 0041 79 222 33 44',
  'Identity card : X',
].join('\n');

const publishButton = '#view .lx-pub button';
const readSheet = '.lx-modal button:has-text("Charger la fiche reçue")';

export const scenarios: Scenario[] = [
  scenario(
    'crew-people-empty',
    'empty',
    [
      ...open('people'),
      { snapshot: 'list' },
      { click: '#mNew' },
      { snapshot: 'new' },
    ],
    noCards,
  ),
  scenario('crew-people-list', 'sample-lake', [
    ...open('people'),
    { snapshot: 'list' },
    { click: '#view [data-fiche="ex3"]' },
    { snapshot: 'locked-card' },
    { click: '#navBack' },
    { wait: 300 },
    { snapshot: 'back-to-list' },
  ]),
  scenario('crew-new-card', 'sample-lake', [
    ...open('people'),
    { click: '#mNew' },
    { snapshot: 'blank' },
    { fill: '#fPrenom', value: 'Zoé' },
    { fill: '#fNom', value: 'Vidal' },
    { snapshot: 'named' },
    { click: '#fSexe .cyc' },
    { snapshot: 'sex' },
    { click: '#fBoard' },
    { wait: 300 },
    { snapshot: 'on-board' },
    stored('ldb.members', 'ldb.members.at'),
    { snapshot: 'stored' },
  ]),
  scenario('crew-new-card-abandoned', 'sample-lake', [
    ...open('people'),
    { click: '#mNew' },
    { fill: '#fNom', value: 'Sans Prénom' },
    { click: '#navBack' },
    { snapshot: 'kept-nothing' },
  ]),
  scenario('crew-card-edit', 'sample-lake', [
    ...open('people'),
    { click: '#mNew' },
    { fill: '#fPrenom', value: 'Léo' },
    { eval: "document.querySelector('details.section').open = true" },
    { snapshot: 'open' },
    { fill: '[data-k="naissance"]', value: '01.02.1990' },
    { fill: '[data-k="tel"]', value: '0791234567' },
    { press: '[data-k="tel"]', key: 'Tab' },
    { wait: 200 },
    ...shot('phone-international'),
    { click: '#fAddProche' },
    ...shot('second-relative'),
    { fill: '[data-k="proche2Nom"]', value: 'Anne Favre' },
    { fill: '[data-k="proche2Tel"]', value: '0041791112233' },
    { click: '#fAddProche' },
    ...shot('third-relative'),
    { fill: '[data-k="proche3Nom"]', value: 'Paul Favre' },
    { press: '[data-k="proche3Tel"]', key: 'Tab' },
    { wait: 200 },
    ...shot('three-relatives'),
    { fill: '[data-k="proche2Nom"]', value: '' },
    reveal('[data-k="proche2Tel"]'),
    { longpress: '[data-k="proche2Tel"]' },
    { fill: '[data-k="proche2Tel"]', value: '' },
    { press: '[data-k="proche3Nom"]', key: 'Tab' },
    { press: '[data-k="proche3Tel"]', key: 'Tab' },
    { wait: 200 },
    ...shot('relative-moved-up'),
    stored('ldb.members'),
    ...shot('stored'),
    { click: '#navBack' },
    ...shot('saved'),
  ]),
  scenario('crew-card-cycles', 'sample-lake', [
    ...open('people'),
    { click: '#view [data-fiche="ex3"]' },
    { click: '[data-k="tel"]' },
    ...shot('contact-link'),
    { click: '[data-k="piece"]' },
    ...shot('locked-field'),
    { click: '.lab-cyc[data-val="Lieu de naissance"]' },
    ...shot('label-asks'),
  ]),
  scenario('crew-card-prenom-emptied', 'sample-lake', [
    ...open('people'),
    { click: '#view [data-fiche="m-lea"]' },
    { fill: '#fPrenom', value: '' },
    { click: '#navBack' },
    { snapshot: 'old-name-kept' },
  ]),
  scenario('crew-card-delete', 'sample-lake', [
    ...open('people'),
    { click: '#view [data-fiche="m-lea"]' },
    { snapshot: 'locked' },
    { go: 'people' },
    { click: '#mNew' },
    { fill: '#fPrenom', value: 'Temporaire' },
    { click: '#fDel' },
    ...shot('armed'),
    reveal('#fDel'),
    { longpress: '#fDel', ms: 750 },
    { snapshot: 'deleted' },
    stored('ldb.members'),
    { snapshot: 'stored' },
  ]),
  scenario('crew-labels', 'sample-lake', [
    ...open('people'),
    { click: '#view [data-fiche="ex5"]' },
    { click: '#fEdit' },
    { snapshot: 'mode' },
    { fill: '[data-mlab="nationalite"]', value: 'Pays' },
    { click: '#mlAdd' },
    ...shot('nothing-to-add'),
    { fill: '#mlNew', value: 'Club' },
    { click: '#mlAdd' },
    { wait: 300 },
    ...shot('one-label'),
    { fill: '#mlNew', value: 'Taille de gilet' },
    { click: '#mlAdd' },
    { wait: 300 },
    ...shot('two-labels'),
    { click: '.lab-own:last-child [aria-label="Monter"]' },
    ...shot('moved'),
    { click: '.lab-own:last-child [aria-label="Supprimer"]' },
    ...shot('delete-armed'),
    stored('ldb.settings'),
    ...shot('stored'),
    { click: '#mlBack' },
    ...shot('card-with-labels'),
  ]),
  scenario('crew-language', 'sample-lake', [
    ...open('people'),
    { click: '.lang-fab' },
    { snapshot: 'list-en' },
    { click: '#view [data-fiche="ex5"]' },
    { snapshot: 'card-en' },
    { click: '#fEdit' },
    { snapshot: 'labels-en' },
    ...open('crews'),
    { snapshot: 'crews-en' },
    { click: '#view [data-cs="exc1"]' },
    { snapshot: 'crew-en' },
    ...open('crew'),
    { snapshot: 'pick-en' },
  ]),
  scenario(
    'crew-crews-empty',
    'empty',
    [
      ...open('crews'),
      { snapshot: 'list' },
      { click: '#csNew' },
      { snapshot: 'new' },
      { click: '#navBack' },
      { snapshot: 'not-kept' },
    ],
    noCards,
  ),
  scenario('crew-crews-no-cruise', 'empty', [
    ...open('crews'),
    { snapshot: 'list' },
    { click: '#csNew' },
    { snapshot: 'new' },
    { click: '#view [data-cem="ex3"]' },
    ...shot('first-member'),
    { click: '#view [data-cem="ex1"]' },
    { click: '.fold-h' },
    { fill: '#ceName', value: 'Du dimanche' },
    ...shot('named'),
    { click: '#navBack' },
    { wait: 300 },
    { snapshot: 'saved' },
    stored('ldb.crewSets', 'ldb.crewSeq'),
    { snapshot: 'stored' },
  ]),
  scenario('crew-crews-edit', 'sample-lake', [
    ...open('crews'),
    { snapshot: 'list' },
    { click: '#view [data-cs="exc1"]' },
    { snapshot: 'edit' },
    { click: '#view .crew-on:nth-of-type(3) .row button:nth-child(2)' },
    ...shot('role-changed'),
    { click: '#ceUndo' },
    ...shot('undone'),
    { click: '#view [data-cem="ex3"]' },
    ...shot('changed'),
    { click: '#navBack' },
    ...shot('must-choose'),
    { click: '#ceOver' },
    { wait: 300 },
    ...shot('overwritten'),
    { click: '#navBack' },
    { wait: 300 },
    { snapshot: 'back' },
    stored('ldb.crewSets'),
    { snapshot: 'stored' },
  ]),
  scenario('crew-crews-as-new', 'sample-lake', [
    ...open('crews'),
    { click: '#view [data-cs="exc3"]' },
    { click: '#view [data-cem="ex5"]' },
    { click: '#ceAsNew' },
    { wait: 300 },
    ...shot('new-number'),
    stored('ldb.crewSets', 'ldb.crewSeq'),
    { snapshot: 'stored' },
    { click: '#ceDel' },
    ...shot('delete-armed'),
    reveal('#ceDel'),
    { longpress: '#ceDel', ms: 750 },
    ...shot('deleted'),
  ]),
  scenario('crew-crews-new-person', 'sample-lake', [
    ...open('crews'),
    { click: '#view [data-cs="exc3"]' },
    { click: '#ceNewP' },
    ...shot('blank-card'),
    { fill: '#fPrenom', value: 'Inès' },
    { click: '#navBack' },
    { wait: 300 },
    ...shot('added-to-the-crew'),
    reveal('#view [data-cem="ex4"]'),
    { longpress: '#view [data-cem="ex4"]' },
    { wait: 300 },
    ...shot('card-by-long-press'),
    { click: '#navBack' },
    { wait: 300 },
    ...shot('back-to-the-crew'),
  ]),
  scenario('crew-pick-lake', 'sample-lake', [
    ...open('crew'),
    { snapshot: 'pick' },
    { click: '#view [data-m="ex3"]' },
    ...shot('added'),
    tap('#view .crew-on:nth-of-type(2) [data-f="Skipper"]'),
    ...shot('new-skipper'),
    tap('#view [data-up="2"]'),
    ...shot('moved-up'),
    stored('ldb.cruise.mrltkr40tkny6'),
    ...shot('stored'),
    tap('#view [data-m="ex3"]'),
    ...shot('removed'),
    tap('#view [data-fiche="ex2"]'),
    { wait: 300 },
    ...shot('card'),
    { fill: '[data-k="nationalite"]', value: 'Suissesse' },
    { click: '#navBack' },
    { wait: 300 },
    ...shot('card-saved'),
    stored('ldb.cruise.mrltkr40tkny6'),
    ...shot('stored-card'),
    tap('#mNew'),
    { wait: 300 },
    ...shot('new'),
  ]),
  scenario('crew-pick-long-press', 'sample-lake', [
    ...open('crew'),
    reveal('#view [data-m="ex6"]'),
    { longpress: '#view [data-m="ex6"]' },
    { wait: 300 },
    ...shot('card'),
    { click: '#navBack' },
    { wait: 300 },
    ...shot('back'),
  ]),
  scenario('crew-pick-publish', 'sample-lake', [
    ...open('crew'),
    tap('#crewPub'),
    { snapshot: 'window' },
    tap('.lx-modal [data-ccolall]'),
    { snapshot: 'none' },
    tap('.lx-modal .check:nth-of-type(6)'),
    { snapshot: 'one-more' },
    stored('ldb.settings'),
    { snapshot: 'stored' },
  ]),
  scenario('crew-pick-sea', 'sample-sea', [
    ...open('crew'),
    { snapshot: 'pick' },
    stored('ldb.members', 'ldb.cruise.mrltkr40tkny6'),
    ...shot('card-created-from-the-line'),
    ...open('crews'),
    { snapshot: 'crews' },
  ]),
  scenario(
    'crew-swipe',
    'sample-lake',
    [
      ...open('people'),
      swipe('#view [data-fiche="m-lea"]'),
      ...shot('confirm'),
      { longpress: '[data-swok]', ms: 750 },
      ...shot('deleted'),
      { wait: 2500 },
      stored('ldb.members'),
      { snapshot: 'stored' },
    ],
    noCrews,
  ),
  scenario('crew-swipe-locked', 'sample-lake', [
    ...open('people'),
    swipe('#view [data-fiche="m-lea"]'),
    { snapshot: 'refused' },
  ]),
  scenario('crew-blank-sheet', 'sample-lake', [
    ...open('people'),
    { click: publishButton },
    { wait: 300 },
    { snapshot: 'window' },
    { fill: '#lxBlIn', value: 'rien de lisible' },
    { click: readSheet },
    ...shot('nothing-recognised'),
    tap(publishButton),
    { fill: '#lxBlIn', value: receivedNew },
    { click: readSheet },
    { wait: 300 },
    ...shot('created'),
    stored('ldb.members'),
    { snapshot: 'stored' },
  ]),
  scenario('crew-blank-arbitration', 'sample-lake', [
    ...open('people'),
    { click: publishButton },
    { fill: '#lxBlIn', value: `${received}\n\n${receivedNew}` },
    { click: readSheet },
    { wait: 300 },
    ...shot('arbitration'),
    tap('#view [data-arb="tel"][data-side="new"]'),
    ...shot('picked'),
    tap('#arbMerge'),
    { wait: 300 },
    ...shot('merged-and-created'),
    stored('ldb.members'),
    { snapshot: 'stored' },
  ]),
  scenario('crew-blank-arbitration-apart', 'sample-lake', [
    ...open('people'),
    { click: publishButton },
    { fill: '#lxBlIn', value: received },
    { click: readSheet },
    { wait: 300 },
    tap('#arbNew'),
    { wait: 300 },
    ...shot('apart'),
    stored('ldb.members'),
    { snapshot: 'stored' },
  ]),
];
