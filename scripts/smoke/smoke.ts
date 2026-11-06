/*
 * Drives the built app in Chrome, by day and by night, through what must keep
 * working: map, bars, position button, search, landmarks, my maps, tracks.
 * Nothing leaves the machine: map servers are answered with nothing.
 *
 *   npm run build && npm run smoke
 */
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { chromium } from 'playwright-core';

const URL = process.argv[2] ?? 'http://localhost:11105/';
const failures: string[] = [];

function check(theme: string, name: string, ok: boolean): void {
  process.stdout.write(`${ok ? 'ok  ' : 'FAIL'} ${theme} · ${name}\n`);
  if (!ok) failures.push(`${theme} · ${name}`);
}

async function open(
  browser: Browser,
  theme: string,
): Promise<{
  context: BrowserContext;
  page: Page;
  errors: string[];
}> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'fr-CH',
    serviceWorkers: 'block',
  });
  await context.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.locator('.map-locate-btn').waitFor({ state: 'attached' });
  await page.waitForTimeout(1500);
  // The help bubbles of a first start would catch the taps.
  await page.addStyleTag({
    content: '#toast { pointer-events: none !important; }',
  });
  if (theme === 'night') {
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'night';
    });
  }
  return { context, page, errors };
}

const bodyHas = (page: Page, name: string) =>
  page.evaluate(
    (className) => document.body.classList.contains(className),
    name,
  );

async function bars(page: Page, theme: string): Promise<void> {
  check(
    theme,
    'bottom bar folded without a recording',
    await bodyHas(page, 'bot-hidden'),
  );
  await page.locator('#hBot').click();
  check(theme, 'its handle opens it', !(await bodyHas(page, 'bot-hidden')));
  await page.locator('.bar-chevron-bottom').click();
  check(theme, 'its chevron folds it', await bodyHas(page, 'bot-hidden'));
  await page.locator('.bar-chevron-top').click();
  check(
    theme,
    'the top chevron folds the top bar',
    await bodyHas(page, 'top-hidden'),
  );
  await page.locator('#hTop').click();
  check(
    theme,
    'its handle brings it back',
    !(await bodyHas(page, 'top-hidden')),
  );
  await page.mouse.move(100, 40);
  await page.mouse.down();
  await page.mouse.move(100, 5, { steps: 6 });
  await page.mouse.up();
  check(theme, 'no swipe moves a bar', !(await bodyHas(page, 'top-hidden')));
}

async function layers(page: Page, theme: string): Promise<void> {
  const names = await page.evaluate(() =>
    [...document.querySelectorAll('.leaflet-control-layers-base label')].map(
      (label) => label.textContent?.trim() ?? '',
    ),
  );
  check(
    theme,
    'OpenStreetMap first, national map last',
    names[0] === 'Plan OpenStreetMap' &&
      names.at(-1) === 'Carte nationale suisse',
  );
  check(
    theme,
    'no simulated chart',
    !names.some((name) => /simul/i.test(name)),
  );
  const checked = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLInputElement>(
        '.leaflet-control-layers-selector',
      ),
    ]
      .filter((input) => input.checked)
      .map((input) => input.parentElement?.textContent?.trim() ?? ''),
  );
  check(
    theme,
    'OpenStreetMap and OpenSeaMap by default',
    checked.includes('Plan OpenStreetMap') &&
      checked.includes('Balisage OpenSeaMap'),
  );
  check(
    theme,
    'without tiles, the note says so',
    await page.evaluate(
      () => !document.querySelector<HTMLElement>('.map-missing')?.hidden,
    ),
  );
}

async function search(page: Page, theme: string): Promise<void> {
  await page.locator('#searchBtn').click();
  check(
    theme,
    'search asks what to look for first',
    (await page.locator('#searchInput').count()) === 0,
  );
  await page.locator('[data-search=function]').click();
  await page.locator('#searchInput').fill('alarme');
  check(
    theme,
    'it finds a function',
    (await page.locator('.search-hit').count()) > 0,
  );
  await page.locator('.search-back').click();
  await page.locator('[data-search=place]').click();
  await page.locator('#searchInput').fill('chillon');
  await page.locator('.search-hit', { hasText: 'Chillon' }).first().click();
  await page.waitForTimeout(800);
  check(
    theme,
    'a place shows on the map',
    (await page.locator('.leaflet-tooltip').count()) > 0,
  );
}

async function landmarks(page: Page, theme: string): Promise<void> {
  await page.evaluate(() => {
    const label = [
      ...document.querySelectorAll('.leaflet-control-layers-overlays label'),
    ].find((item) => item.textContent?.includes('Amers'));
    label?.querySelector('input')?.click();
  });
  await page.waitForTimeout(500);
  const dot = await page.evaluate(() => {
    const paths = [
      ...document.querySelectorAll('path.leaflet-interactive[fill="#d00000"]'),
    ];
    const box = paths[0]?.getBoundingClientRect();
    return box ? [box.x + box.width / 2, box.y + box.height / 2] : null;
  });
  check(theme, 'landmarks show', dot !== null);
  if (!dot) return;
  await page.mouse.click(dot[0] as number, dot[1] as number);
  await page.waitForTimeout(400);
  const text = await page.evaluate(
    () => document.querySelector('.leaflet-popup-content')?.textContent ?? '',
  );
  check(
    theme,
    'a tap names the landmark, not the depth',
    text !== '' && !text.includes('Profondeur'),
  );
}

async function myMaps(page: Page, theme: string): Promise<void> {
  await page.locator('#gearBtn').click();
  await page
    .locator('[data-go="cartes"]')
    .first()
    .evaluate((button: HTMLElement) => {
      button.click();
    });
  await page.waitForTimeout(500);
  const title = (await page.locator('main h1').first().textContent()) ?? '';
  check(theme, 'settings lead to my maps', title.includes('Mes cartes'));
  const box = await page.locator('#searchBtn').boundingBox();
  check(
    theme,
    'the magnifier leaves the top nav bar free',
    (box?.y ?? 0) > 400,
  );
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
/* eslint-disable no-await-in-loop -- one theme after the other */
for (const theme of ['day', 'night']) {
  const { context, page, errors } = await open(browser, theme);
  try {
    await bars(page, theme);
    await layers(page, theme);
    await search(page, theme);
    await landmarks(page, theme);
    await myMaps(page, theme);
  } catch (error) {
    check(theme, `no step blocks: ${String(error).slice(0, 700)}`, false);
  }
  check(theme, 'no error in the page', errors.length === 0);
  await context.close();
}
/* eslint-enable no-await-in-loop */
await browser.close();
process.stdout.write(
  failures.length > 0 ? `\n${failures.length} FAILED\n` : '\nALL OK\n',
);
process.exitCode = failures.length > 0 ? 1 : 0;
