import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Browser, Page } from 'playwright-core';

import type { Fixture, Scenario, Step } from './types.ts';

export const DEFAULT_TIME = '2026-07-15T10:30:00+02:00';
export const DEFAULT_SETTLE = 500;
// react-dom draws two Math.random() values when its module loads (internal
// property keys), before any app code: hand it throwaway values so the app
// sees the same random sequence as legacy.
const REACT_WARMUP = 2;

interface ParityWindow {
  go?: (view: string, arg: unknown) => void;
  __parity?: { go: (view: string, arg: unknown) => void };
}

/**
 * Resolve a scenario fixture: inline object, or the name of a JSON file in `fixtures/`.
 * @param fixture - Inline fixture or file name without extension.
 * @returns The localStorage seed.
 */
export function loadFixture(fixture: Fixture | string | undefined): Fixture {
  if (fixture === undefined) return {};
  if (typeof fixture !== 'string') return fixture;
  const path = join(import.meta.dirname, 'fixtures', `${fixture}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as Fixture;
}

/**
 * Open one app in a fresh phone-like context: seeded storage, frozen clock,
 * deterministic Math.random, no network except localhost, no service worker.
 * @param browser - Shared browser.
 * @param url - App URL.
 * @param scenario - Scenario being replayed.
 * @param isReact - Whether the page is the React app.
 * @returns The page and the list collecting its uncaught errors.
 */
export async function openApp(
  browser: Browser,
  url: string,
  scenario: Scenario & { fixture?: Fixture | string },
  isReact: boolean,
): Promise<{ page: Page; errors: string[]; close: () => Promise<void> }> {
  const context = await browser.newContext({
    viewport: scenario.viewport ?? { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    locale: 'fr-FR',
    timezoneId: 'Europe/Zurich',
    serviceWorkers: 'block',
    geolocation: scenario.geolocation,
    permissions: scenario.geolocation ? ['geolocation'] : [],
  });
  await context.route('**/*', async (route) => {
    const { hostname } = new URL(route.request().url());
    await (hostname === 'localhost' || hostname === '127.0.0.1'
      ? route.continue()
      : route.abort());
  });
  await context.addInitScript(
    ({ seed, warmup }: { seed: Fixture; warmup: number }) => {
      let state = 42;
      let skipped = 0;
      Math.random = () => {
        if (skipped < warmup) {
          skipped++;
          return 0.5;
        }
        state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
        return state / 4_294_967_296;
      };
      if (sessionStorage.getItem('__parity_seeded')) return;
      localStorage.clear();
      for (const [key, value] of Object.entries(seed)) {
        localStorage.setItem(
          key,
          typeof value === 'string' ? value : JSON.stringify(value),
        );
      }
      sessionStorage.setItem('__parity_seeded', '1');
    },
    {
      seed: { ...loadFixture(scenario.fixture), ...scenario.overrides },
      warmup: isReact ? REACT_WARMUP : 0,
    },
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date(scenario.time ?? DEFAULT_TIME));
  await page.goto(url);
  await page.waitForLoadState('load');
  await page.waitForTimeout(scenario.settle ?? DEFAULT_SETTLE);
  return { page, errors, close: () => context.close() };
}

/**
 * Replay one non-snapshot step.
 * @param page - Target page.
 * @param step - Step to replay.
 * @param isReact - Whether the page is the React app (router hook differs).
 */
export async function runStep(
  page: Page,
  step: Exclude<Step, { snapshot: string }>,
  isReact: boolean,
): Promise<void> {
  if ('go' in step) {
    await page.evaluate(
      ({ view, arg, react }) => {
        const target = globalThis as unknown as ParityWindow;
        const go = react ? target.__parity?.go : target.go;
        if (!go) throw new Error('router hook missing');
        go(view, arg);
      },
      { view: step.go, arg: step.arg ?? null, react: isReact },
    );
  } else if ('click' in step) {
    await page.locator(step.click).first().click({ timeout: 3000 });
  } else if ('longpress' in step) {
    const box = await page.locator(step.longpress).first().boundingBox();
    if (!box) throw new Error(`not visible: ${step.longpress}`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(step.ms ?? 800);
    await page.mouse.up();
  } else if ('fill' in step) {
    await page.locator(step.fill).first().fill(step.value, { timeout: 3000 });
  } else if ('press' in step) {
    await page.locator(step.press).first().press(step.key, { timeout: 3000 });
  } else if ('wait' in step) {
    await page.waitForTimeout(step.wait);
  } else {
    await page.evaluate(step.eval);
  }
}
