import type { Fixture, Scenario, Step } from '../types.ts';

const bubbleWithoutTouch: Step = {
  eval: `document.head.append(Object.assign(document.createElement('style'), { textContent: '#toast { pointer-events: none !important; }' }))`,
};
// A full-page screenshot of a scrolled page can move the scroll of the page
// (sometimes in one app only), so every snapshot is taken from the top.
const beforeSnapshot: Step = {
  eval: `document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); scrollTo(0, 0);`,
};
export const quiet: Fixture = { 'ldb.tipIdx': '6' };
export const lakeZone: Fixture = { ...quiet, 'ldb.zoneSim': 'lac' };
export const seaZone: Fixture = { ...quiet, 'ldb.zoneSim': 'mer' };
export const lausanne = { latitude: 46.47, longitude: 6.62 };
export const meillerie = { latitude: 46.418, longitude: 6.72 };
export const toulon = { latitude: 43.06, longitude: 5.98 };

export const scenario = (
  name: string,
  fixture: string,
  overrides: Fixture,
  steps: Step[],
  geolocation?: { latitude: number; longitude: number },
): Scenario => ({
  name,
  fixture,
  overrides,
  // In the development server the React app boots after `load`, and every
  // page is a lazily compiled chunk. The bubble lasts a few seconds and covers
  // buttons: its text is compared, not whether it is still showing.
  steps: [
    { wait: 1200 },
    bubbleWithoutTouch,
    ...steps.flatMap((step): Step[] => {
      if ('go' in step) return [step, { wait: 500 }];
      return 'snapshot' in step ? [beforeSnapshot, step] : [step];
    }),
  ],
  geolocation,
});

/** Create a settings-like button and touch it, in both apps. */
export const touchButton = (attribute: string, value: string): Step => ({
  eval: `(() => { const b = document.createElement('button'); b.setAttribute('${attribute}', '${value}'); document.body.append(b); b.click(); b.remove(); })()`,
});
