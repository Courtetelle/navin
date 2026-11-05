import { loadFixture } from '../browser.ts';
import type { Fixture, Scenario, Step } from '../types.ts';

const QUIET = { 'ldb.tipIdx': '6', 'ldb.zoneSim': 'lac' };
const QUIET_SEA = { 'ldb.tipIdx': '6', 'ldb.zoneSim': 'mer' };

/**
 * Wait for a screen loaded lazily (the dev server can take a few seconds).
 * @param selector - Element of the screen.
 * @returns The step.
 */
function until(selector: string): Step {
  return {
    eval: `new Promise((done) => {
      let ticks = 0;
      const timer = setInterval(() => {
        ticks++;
        if (document.querySelector(${JSON.stringify(selector)}) || ticks > 400) {
          clearInterval(timer);
          done();
        }
      }, 50);
    })`,
  };
}

/** Open the PréP from the NavIn tab: a short touch shows « PréP », a long press starts it. */
const OPEN_PREP: Step[] = [
  {
    eval: `document.querySelector('vite-error-overlay')?.remove();
      new MutationObserver(() => document.querySelector('vite-error-overlay')?.remove()).observe(document.body, { childList: true });`,
  },
  until('#trkMap'),
  { click: '.top-tab[data-view="tracker"]' },
  { longpress: '.top-tab[data-view="tracker"]' },
  until('.prep-title'),
];

/** Full page screenshots show fixed elements at the scroll position. */
const TOP: Step = { eval: 'window.scrollTo(0, 0)' };

/**
 * Slide an element to the left with a touch.
 * @param selector - Element.
 * @param distance - Distance in px.
 * @returns The step.
 */
function swipe(selector: string, distance = 100): Step {
  return {
    eval: `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      element.scrollIntoView({ block: 'center' });
      const box = element.getBoundingClientRect();
      const x = box.right - 20;
      const y = box.top + box.height / 2;
      const fire = (type, clientX) => element.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, composed: true, clientX, clientY: y,
        pointerId: 1, pointerType: 'touch', isPrimary: true,
      }));
      fire('pointerdown', x);
      fire('pointermove', x - 30);
      fire('pointermove', x - ${distance});
      fire('pointerup', x - ${distance});
    })()`,
  };
}

/**
 * A fixture whose open cruise was started by a long press.
 * @param name - Fixture.
 * @returns The fixture.
 */
function quickCruise(name: string): Fixture {
  const fixture = loadFixture(name);
  const key = 'ldb.cruise.mrltkr40tkny6';
  const stored = fixture[key];
  const cruise = (
    typeof stored === 'string' ? JSON.parse(stored) : stored
  ) as Record<string, unknown>;
  return { ...fixture, [key]: { ...cruise, quick: true } };
}

const pick = (kind: string, value: string): Step => ({
  click: `[data-pick="${kind}"][data-v="${value}"]`,
});

/** Start a track from the NavIn tab: two short touches show « START », a long press starts it. */
const START_TRACK: Step[] = [
  until('#trkMap'),
  { click: '.top-tab[data-view="tracker"]' },
  { click: '.top-tab[data-view="tracker"]' },
  { snapshot: 'start-choice' },
  { longpress: '.top-tab[data-view="tracker"]' },
  { wait: 1500 },
  { snapshot: 'started' },
];

/** PréP and dock scenarios. */
export const scenarios: Scenario[] = [
  {
    name: 'prep-lake-training',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      ...OPEN_PREP,
      { snapshot: 'purpose' },
      pick('purpose', 'Entraînement'),
      { snapshot: 'boat' },
      pick('boatId', 'savannah'),
      { snapshot: 'crew' },
      pick('crewSet', 'exc1'),
      until('.ck-list'),
      { snapshot: 'checkin' },
      { click: '#navNext' },
      until('.prep-title'),
      { snapshot: 'depart' },
      { click: '#navBack' },
      until('.ck-list'),
      { snapshot: 'back-checkin' },
      { click: '#navBack' },
      until('.prep-title'),
      { snapshot: 'back-crew' },
      { click: '#navBack' },
      { snapshot: 'back-boat' },
      { click: '#navBack' },
      { snapshot: 'back-purpose' },
    ],
  },
  {
    name: 'prep-lake-rental',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      ...OPEN_PREP,
      pick('purpose', 'Location'),
      { snapshot: 'boat' },
      pick('boatId', 'savannah'),
      { snapshot: 'tarif' },
      { click: '[data-tarif="1"]' },
      { snapshot: 'crew' },
      { click: '#prepLine [data-tj="2t"]' },
      { snapshot: 'tarif-again' },
      { click: '[data-tarif="none"]' },
      { snapshot: 'crew-no-tarif' },
    ],
  },
  {
    name: 'prep-lake-rental-no-tarif',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      ...OPEN_PREP,
      pick('purpose', 'Location'),
      pick('boatId', 'exb1'),
      { snapshot: 'no-tarif' },
      { click: '[data-p="next"]' },
      { snapshot: 'skipped' },
    ],
  },
  {
    name: 'prep-lake-invitation-paths',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      ...OPEN_PREP,
      pick('purpose', 'Invitation'),
      pick('boatId', 'exb1'),
      { snapshot: 'invitation-crew' },
      { click: '#prepLine [data-tj="0"]' },
      { snapshot: 'purpose-path-on' },
      pick('purpose', 'Entraînement'),
      pick('boatId', 'exb2'),
      { snapshot: 'two-paths' },
      { click: '#prepLine [data-tj="paths"]' },
      { snapshot: 'paths-choice' },
      pick('purpose', 'Invitation'),
      { snapshot: 'resume-invitation' },
      {
        eval: 'JSON.parse(localStorage.getItem("ldb.prepPaths")).Invitation.t',
      },
    ],
  },
  {
    name: 'prep-lake-crew-edit',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      ...OPEN_PREP,
      pick('purpose', 'Entraînement'),
      pick('boatId', 'savannah'),
      { click: '[data-p="newcrew"]' },
      { snapshot: 'empty' },
      { click: '[data-cm="ex2"]' },
      { click: '[data-cm="ex5"]' },
      { fill: '#crewSetName', value: ' Mon équipe ' },
      { snapshot: 'two-people' },
      { click: '[data-crole="1"][data-f="Second"]' },
      { snapshot: 'role' },
      { click: '[data-cm="ex2"]' },
      TOP,
      { snapshot: 'removed' },
      { click: '[data-cm="ex1"]' },
      { click: '#navOk' },
      until('.ck-list'),
      { snapshot: 'validated' },
    ],
  },
  {
    name: 'prep-lake-browse-reset',
    fixture: 'empty',
    overrides: QUIET,
    steps: [
      ...OPEN_PREP,
      { snapshot: 'purpose-empty' },
      { click: '#navNext' },
      { click: '#navOk' },
      { snapshot: 'step-boat-browsed' },
      { click: '#navOk' },
      { snapshot: 'step-crew-browsed' },
      { click: '#navOk' },
      { snapshot: 'step-checkin-no-boat' },
      { click: '#navOk' },
      { snapshot: 'step-depart-no-boat' },
      { longpress: '#navExit' },
      { snapshot: 'reset' },
      { click: '#navExit' },
      { snapshot: 'quit' },
    ],
  },
  {
    name: 'prep-sea',
    fixture: 'sample-sea',
    overrides: QUIET_SEA,
    steps: [
      ...OPEN_PREP,
      { snapshot: 'duree' },
      pick('duree', 'croisiere'),
      { snapshot: 'boat' },
      { fill: '#prepBoat', value: ' Bronze Kiss ' },
      { click: '[data-p="next"]' },
      { snapshot: 'crew' },
      pick('crewSet', 'exc2'),
      until('.ck-list'),
      { snapshot: 'checkin' },
      { click: '#navNext' },
      until('.prep-title'),
      { snapshot: 'depart' },
    ],
  },
  {
    name: 'prep-sea-empty',
    fixture: 'empty',
    overrides: QUIET_SEA,
    steps: [
      ...OPEN_PREP,
      { snapshot: 'duree' },
      pick('duree', 'jour'),
      { snapshot: 'boat' },
      { click: '#navBack' },
      { snapshot: 'back-duree' },
      { click: '#navBack' },
      { snapshot: 'quit' },
    ],
  },
  {
    name: 'prep-sea-empty-depart',
    fixture: 'empty',
    overrides: QUIET_SEA,
    steps: [
      ...OPEN_PREP,
      pick('duree', 'jour'),
      { fill: '#prepBoat', value: 'Tiki' },
      { click: '[data-p="next"]' },
      { snapshot: 'crew' },
      { click: '#navOk' },
      until('.ck-list'),
      { snapshot: 'checkin-browsed' },
      { click: '#navOk' },
      until('.prep-title'),
      { snapshot: 'depart' },
      { eval: 'localStorage.getItem("ldb.index")' },
    ],
  },
  {
    name: 'prep-fill-lake',
    fixture: quickCruise('sample-lake'),
    overrides: QUIET,
    steps: [
      ...OPEN_PREP,
      { snapshot: 'type' },
      pick('type', 'lac'),
      { snapshot: 'purpose' },
      { click: '#navBack' },
      { snapshot: 'back-type' },
      pick('type', 'lac'),
      pick('purpose', 'Invitation'),
      pick('boatId', 'exb1'),
      { snapshot: 'crew' },
    ],
  },
  {
    name: 'prep-fill-sea',
    fixture: quickCruise('sample-lake'),
    overrides: QUIET,
    steps: [
      ...OPEN_PREP,
      pick('type', 'mer'),
      { snapshot: 'duree' },
      pick('duree', 'jour'),
      { fill: '#prepBoat', value: 'Tiki' },
      { click: '[data-p="next"]' },
      { snapshot: 'crew' },
      { eval: 'document.title = localStorage.getItem("ldb.index")' },
    ],
  },
  {
    name: 'prep-departure',
    fixture: 'sample-lake',
    overrides: QUIET,
    geolocation: { latitude: 46.5, longitude: 6.5 },
    steps: [
      ...OPEN_PREP,
      pick('purpose', 'Entraînement'),
      pick('boatId', 'savannah'),
      pick('crewSet', 'exc1'),
      until('.ck-list'),
      until('#prepBar'),
      { click: '#navNext' },
      until('[data-p="depart"]'),
      { click: '#navOk' },
      until('#trkMap'),
      { snapshot: 'tracking' },
      { eval: 'document.title = localStorage.getItem("ldb.prepPaths")' },
    ],
  },
  {
    name: 'prep-crew-page',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      ...OPEN_PREP,
      pick('purpose', 'Entraînement'),
      pick('boatId', 'savannah'),
      { click: '[data-p="newcrew"]' },
      { click: '[data-cm="ex2"]' },
      { click: '[data-p="fiches"]' },
      until('#prepBar'),
      { snapshot: 'crew-page' },
      { click: '#navNext' },
      until('.ck-list'),
      { snapshot: 'checkin' },
    ],
  },
  {
    name: 'prep-long-press',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      ...OPEN_PREP,
      pick('purpose', 'Entraînement'),
      { longpress: '[data-pick="boatId"][data-v="savannah"]' },
      until('#boatList'),
      { click: '#navBack' },
      until('.prep-title'),
      { snapshot: 'back-from-boats' },
    ],
  },
  {
    name: 'quick-start-new',
    fixture: 'empty',
    overrides: QUIET,
    geolocation: { latitude: 46.5, longitude: 6.5 },
    steps: START_TRACK,
  },
  {
    name: 'quick-start-today',
    fixture: 'sample-lake',
    overrides: QUIET,
    geolocation: { latitude: 46.5, longitude: 6.5 },
    steps: START_TRACK,
  },
  {
    name: 'quick-start-next-day-lake',
    fixture: 'sample-lake',
    overrides: QUIET,
    time: '2026-07-16T10:30:00+02:00',
    geolocation: { latitude: 46.5, longitude: 6.5 },
    steps: START_TRACK,
  },
  {
    name: 'quick-start-next-day-sea',
    fixture: 'sample-sea',
    overrides: QUIET_SEA,
    time: '2026-07-17T10:30:00+02:00',
    geolocation: { latitude: 43, longitude: 16 },
    steps: START_TRACK,
  },
  {
    name: 'moor',
    fixture: 'sample-lake',
    overrides: QUIET,
    geolocation: { latitude: 46.5, longitude: 6.5 },
    steps: [
      ...START_TRACK,
      { go: 'dock' },
      until('.dock-list'),
      { click: '[data-d="moor"]' },
      { click: '[data-d="moor"]' },
      until('.ck-list'),
      { snapshot: 'check-out' },
    ],
  },
  {
    name: 'swipe-cruise',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      { go: 'cruises' },
      until('article.entry'),
      swipe('article.entry', 40),
      { snapshot: 'too-short' },
      swipe('article.entry'),
      TOP,
      { snapshot: 'confirm' },
      { click: '[data-swok]' },
      TOP,
      { snapshot: 'tap-asks-long-press' },
      { click: '[data-swno]' },
      TOP,
      { snapshot: 'cancelled' },
      swipe('article.entry'),
      { longpress: '[data-swok]' },
      { wait: 400 },
      TOP,
      { snapshot: 'deleted' },
    ],
  },
  {
    name: 'swipe-closes-alone',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      { go: 'cruises' },
      until('article.entry'),
      swipe('article.entry'),
      { wait: 5200 },
      TOP,
      { snapshot: 'closed' },
    ],
  },
  {
    name: 'swipe-member-blocked',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      { go: 'people' },
      until('[data-fiche]'),
      swipe('[data-fiche="ex1"]'),
      TOP,
      { snapshot: 'blocked' },
      swipe('[data-fiche="m-lea"]'),
      TOP,
      { snapshot: 'confirm-or-blocked' },
    ],
  },
  {
    name: 'swipe-boat',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      { go: 'boats' },
      until('details[data-b]'),
      swipe('details[data-b="exb3"] > summary'),
      TOP,
      { snapshot: 'confirm' },
      { longpress: '[data-swok]' },
      { wait: 400 },
      TOP,
      { snapshot: 'deleted' },
    ],
  },
  {
    name: 'prep-direct',
    fixture: 'empty',
    overrides: QUIET,
    steps: [{ go: 'prep' }, until('#view h1'), { snapshot: 'no-flow' }],
  },
  {
    name: 'dock-lake',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      { go: 'dock' },
      until('#view h1'),
      { snapshot: 'dock' },
      { click: 'section.field:nth-of-type(2) h2' },
      { snapshot: 'unfolded' },
      { click: '[data-i="2"]' },
      TOP,
      { snapshot: 'ticked' },
      { click: '[data-d="moor"]' },
      TOP,
      { snapshot: 'armed' },
    ],
  },
  {
    name: 'dock-sea',
    fixture: 'sample-sea',
    overrides: QUIET_SEA,
    steps: [
      { go: 'dock' },
      until('#view h1'),
      { snapshot: 'dock' },
      { click: 'section.field:nth-of-type(2) h2' },
      { click: '[data-i="7"]' },
      TOP,
      { snapshot: 'ticked' },
    ],
  },
  {
    name: 'dock-empty',
    fixture: 'empty',
    overrides: QUIET,
    steps: [{ go: 'dock' }, until('#view h1'), { snapshot: 'dock' }],
  },
];
