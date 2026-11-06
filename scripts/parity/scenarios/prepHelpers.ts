import { loadFixture } from '../browser.ts';
import type { Fixture, Step } from '../types.ts';

export const QUIET = { 'ldb.tipIdx': '6', 'ldb.zoneSim': 'lac' };
export const QUIET_SEA = { 'ldb.tipIdx': '6', 'ldb.zoneSim': 'mer' };

/**
 * Wait for a screen loaded lazily (the dev server can take a few seconds).
 * @param selector - Element of the screen.
 * @returns The step.
 */
export function until(selector: string): Step {
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

/** The fields of the boats screen take random ids, drawn in another order. */
export const RANDOM_IDS = '^(?:data-.*|for|id)$';

/** Open the PréP from the NavIn tab: a short touch shows « PréP », a long press starts it. */
export const OPEN_PREP: Step[] = [
  until('#trkMap'),
  { click: '.top-tab[data-view="tracker"]' },
  { longpress: '.top-tab[data-view="tracker"]' },
  until('.prep-title'),
];

/** Full page screenshots show fixed elements at the scroll position. */
export const TOP: Step = { eval: 'window.scrollTo(0, 0)' };

/**
 * Slide an element to the left with a touch.
 * @param selector - Element.
 * @param distance - Distance in px.
 * @returns The step.
 */
export function swipe(selector: string, distance = 100): Step {
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
export function quickCruise(name: string): Fixture {
  const fixture = loadFixture(name);
  const key = 'ldb.cruise.mrltkr40tkny6';
  const stored = fixture[key];
  const cruise = (
    typeof stored === 'string' ? JSON.parse(stored) : stored
  ) as Record<string, unknown>;
  return { ...fixture, [key]: { ...cruise, quick: true } };
}

export const pick = (kind: string, value: string): Step => ({
  click: `[data-pick="${kind}"][data-v="${value}"]`,
});

/** Start a track from the NavIn tab: two short touches show « START », a long press starts it. */
export const START_TRACK: Step[] = [
  until('#trkMap'),
  { click: '.top-tab[data-view="tracker"]' },
  { click: '.top-tab[data-view="tracker"]' },
  { snapshot: 'start-choice' },
  { longpress: '.top-tab[data-view="tracker"]' },
  { wait: 5000 },
  { snapshot: 'started' },
];
