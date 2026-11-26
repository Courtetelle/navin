/*
 * Drives the built app in Chrome, by day and by night, through what must keep
 * working: map, bars, position button, search, buoyage, my maps, tracks.
 * Nothing leaves the machine: map servers are answered with nothing.
 *
 *   npm run build && npm run smoke
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Browser, BrowserContext, Page } from 'playwright-core';
import { chromium } from 'playwright-core';
import { PMTiles } from 'pmtiles';

const URL = process.argv[2] ?? 'http://localhost:11105/';
const failures: string[] = [];

function check(theme: string, name: string, ok: boolean): void {
  process.stdout.write(`${ok ? 'ok  ' : 'FAIL'} ${theme} · ${name}\n`);
  if (!ok) failures.push(`${theme} · ${name}`);
}

// A GPS the test drives: `fakeGps(lat, lon, heading)`, boat at 3 m/s.
const FAKE_GPS = `
  const watchers = [];
  navigator.geolocation.watchPosition = (success) => {
    watchers.push(success);
    return watchers.length;
  };
  navigator.geolocation.clearWatch = () => undefined;
  window.fakeGps = (latitude, longitude, heading) => {
    for (const success of watchers) {
      success({
        timestamp: Date.now(),
        coords: { latitude, longitude, heading, speed: 3, accuracy: 5 },
      });
    }
  };
`;

const PHONE = { width: 390, height: 844 };

/**
 * The buttons around the map come in packets that a swipe turns (upright
 * left and right, sideways up and down): before a touch on one of them, the
 * swipes that bring its packet on the screen, as a finger would.
 * @param page - The page.
 * @param selector - What is about to be touched.
 */
async function bringRailOf(page: Page, selector: string): Promise<void> {
  /* eslint-disable no-await-in-loop -- one swipe after the other */
  for (let turn = 0; turn < 4; turn += 1) {
    const moved = await page.evaluate((wanted) => {
      let element: Element | null = null;
      try {
        element = document.querySelector(wanted);
      } catch {
        return false;
      }
      const rail = element?.closest(
        '#clock, #searchBtn, .top-tab, .side-rail-left > *, .rail-btn',
      );
      if (!element || !rail) return false;
      const box = element.getBoundingClientRect();
      const width = globalThis.innerWidth;
      const height = globalThis.innerHeight;
      let dx = 0;
      let dy = 0;
      if (box.left >= width) dx = -120;
      else if (box.right <= 0) dx = 120;
      else if (box.top >= height) dy = -120;
      else if (box.bottom <= 0) dy = 120;
      else return false;
      const shown = [
        ...document.querySelectorAll('#clock, #searchBtn, .rail-btn'),
      ].find((item) => {
        const here = item.getBoundingClientRect();
        return (
          here.width > 0 &&
          here.left >= 0 &&
          here.right <= width &&
          here.top >= 0 &&
          here.bottom <= height
        );
      });
      if (!shown) return false;
      const here = shown.getBoundingClientRect();
      const x = here.left + here.width / 2;
      const y = here.top + here.height / 2;
      const fire = (type: string, at: [number, number]) =>
        shown.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            clientX: at[0],
            clientY: at[1],
          }),
        );
      fire('pointerdown', [x, y]);
      fire('pointermove', [x + dx / 2, y + dy / 2]);
      fire('pointerup', [x + dx, y + dy]);
      return true;
    }, selector);
    if (!moved) return;
    // The packet slides in, and the click a swipe swallows is past.
    await page.waitForTimeout(600);
  }
  /* eslint-enable no-await-in-loop */
}

/** What a finger does on a located element. */
const TOUCHES = new Set<string | symbol>([
  'click',
  'dispatchEvent',
  'boundingBox',
  'hover',
  'tap',
]);

/**
 * The page, its touches on a button of the rails preceded by the swipes
 * that show it.
 * @param page - The page.
 * @returns The same page.
 */
function railAware(page: Page): Page {
  const locate = page.locator.bind(page);
  page.locator = (selector: string, options?: object) => {
    const located = locate(selector, options);
    const wrap = (target: typeof located): typeof located =>
      new Proxy(target, {
        get(object, key, receiver) {
          const value = Reflect.get(object, key, receiver) as unknown;
          if (TOUCHES.has(key)) {
            return async (...args: unknown[]) => {
              await bringRailOf(page, selector);
              return (value as (...rest: unknown[]) => unknown).apply(
                object,
                args,
              );
            };
          }
          if (key === 'first' || key === 'last') {
            return () => wrap((value as () => typeof located).call(object));
          }
          return typeof value === 'function' ? value.bind(object) : value;
        },
      });
    return wrap(located);
  };
  return page;
}

async function open(
  browser: Browser,
  theme: string,
  viewport: { width: number; height: number } = PHONE,
  touch = false,
): Promise<{
  context: BrowserContext;
  page: Page;
  errors: string[];
}> {
  const context = await browser.newContext({
    viewport,
    hasTouch: touch,
    locale: 'fr-CH',
    serviceWorkers: 'block',
  });
  await context.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  const page = railAware(await context.newPage());
  page.setDefaultTimeout(10_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(FAKE_GPS);
  await page.goto(URL, { waitUntil: 'load' });
  await page.locator('.map-locate-btn').waitFor({ state: 'attached' });
  await page.waitForTimeout(1500);
  // The help bubbles of a first start would catch the taps.
  await page.addStyleTag({
    content: '#toast { pointer-events: none !important; }',
  });
  // Each pass shows its theme whatever the hour (night mode comes on its own
  // after dusk).
  await page.evaluate(
    (shown) => {
      document.documentElement.dataset.theme = shown;
    },
    theme === 'night' ? 'night' : 'day',
  );
  return { context, page, errors };
}

const NAVIN = 'header.topbar nav.topnav .top-tab[data-view="tracker"]';

/** Buttons on top of each other keep at least this gap, in pixels. */
const LEAST_GAP_PX = 8;

/**
 * The rule of the layouts: two buttons one above the other never touch
 * (the same gap as in the menus). Lists the pairs too close.
 * @param page - The page shown.
 * @returns The pairs closer than {@link LEAST_GAP_PX}.
 */
async function tightButtons(page: Page): Promise<string[]> {
  return page.evaluate((least) => {
    const boxes = [
      ...document.querySelectorAll(
        'main#view .btn, main#view button.lw-row, main#view .site-link-pill',
      ),
    ]
      .map((element) => ({ element, box: element.getBoundingClientRect() }))
      .filter(
        ({ element, box }) =>
          box.width > 0 &&
          box.height > 0 &&
          !element.closest('.help-i, .swipe-row, .sw-menu'),
      );
    const tight: string[] = [];
    for (const upper of boxes) {
      let below: (typeof boxes)[number] | null = null;
      for (const other of boxes) {
        if (other === upper || upper.element.contains(other.element)) continue;
        if (other.element.contains(upper.element)) continue;
        const overlap =
          Math.min(upper.box.right, other.box.right) -
          Math.max(upper.box.left, other.box.left);
        if (overlap < 20 || other.box.top < upper.box.bottom - 2) continue;
        if (!below || other.box.top < below.box.top) below = other;
      }
      if (below && below.box.top - upper.box.bottom < least) {
        const name = (element: Element) =>
          (element.textContent ?? '').trim().slice(0, 24);
        tight.push(`${name(upper.element)} / ${name(below.element)}`);
      }
    }
    return tight;
  }, LEAST_GAP_PX);
}

/**
 * The rule of the ways to Paramétrages: in a page, the button to
 * Paramétrages is always the last one, at the bottom.
 * @param page - The page shown.
 * @returns The buttons found below it.
 */
async function belowSettings(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const exit = document.querySelector('main#view [data-settings-exit]');
    if (!exit) return [];
    const bottom = exit.getBoundingClientRect().bottom;
    return [
      ...document.querySelectorAll(
        'main#view .btn, main#view button, main#view a, main#view .site-link-pill',
      ),
    ]
      .filter((element) => {
        if (element === exit || exit.contains(element)) return false;
        if (element.closest('.help-i, .swipe-row, .sw-menu')) return false;
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && box.top >= bottom - 2;
      })
      .map((element) => (element.textContent ?? '').trim().slice(0, 24));
  });
}

/**
 * The rule of the « Actualiser » buttons: every one is the shared button,
 * whose look says the refresh is running once touched.
 * @param page - The page shown.
 * @returns The « Actualiser » buttons that are not.
 */
async function plainRefresh(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('main#view button')]
      .filter((button) =>
        /Actualis|^↻/u.test((button.textContent ?? '').trim()),
      )
      .filter((button) => !button.classList.contains('refresh-btn'))
      .map((button) => (button.textContent ?? '').trim().slice(0, 24)),
  );
}

// data and the settings: under Météo sideways (the phone turns its column
// until they show), behind their tab upright (it is touched until they show).
async function showRow(page: Page): Promise<void> {
  const height = page.viewportSize()?.height ?? 0;
  /* eslint-disable no-await-in-loop -- one touch after the other */
  for (let touch = 0; touch < 3; touch++) {
    const gear = await page.locator('#gearBtn').boundingBox();
    if (
      gear &&
      (await page.locator('#gearBtn').isVisible()) &&
      gear.y >= 0 &&
      gear.y + gear.height <= height
    ) {
      return;
    }
    if (gear && (gear.y < 0 || gear.y + gear.height > height)) {
      // The phone sideways: a swipe on the column turns it a packet.
      const box = await page.locator('#clock').boundingBox();
      const x = (box?.x ?? 10) + (box?.width ?? 60) / 2;
      const y = height / 2;
      const dy = gear.y < 0 ? 150 : -150;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + dy / 2, { steps: 3 });
      await page.mouse.move(x, y + dy, { steps: 3 });
      await page.mouse.up();
      await page.waitForTimeout(450);
      continue;
    }
    await page.locator('.menus-tab').click();
    await page.waitForTimeout(400);
  }
  /* eslint-enable no-await-in-loop */
}

async function openGear(page: Page): Promise<void> {
  await showRow(page);
  await page.locator('#gearBtn').click();
}

// data goes back one step at each touch inside its menu: touch it until its
// home (the tiles) shows.
async function openData(page: Page): Promise<void> {
  /* eslint-disable no-await-in-loop -- one touch after the other */
  for (let touch = 0; touch < 5; touch++) {
    if ((await page.locator('[data-tile]').count()) > 0) return;
    await showRow(page);
    await page.locator('.top-tab.tab-data').click();
    await page.waitForTimeout(300);
  }
  /* eslint-enable no-await-in-loop */
}

async function bars(page: Page, theme: string): Promise<void> {
  // Upright: the white figures always in the bottom row, five at a time.
  const figures = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('#trkDash [data-dash]')].map(
        (cell) => (cell as HTMLElement).dataset.dash ?? '',
      ),
    );
  const dash = await page.locator('#trkDash').boundingBox();
  const firstFive = await figures();
  check(
    theme,
    'T upright: the white figures in the bottom row, five, no handle',
    dash !== null &&
      dash.y + dash.height > (page.viewportSize()?.height ?? 0) - 60 &&
      firstFive.length === 5 &&
      firstFive.includes('depth') &&
      !(await page.locator('#hBot').isVisible()),
  );
  const swipe = async (selector: string, dx: number, dy = 0) => {
    const box = await page.locator(selector).first().boundingBox();
    if (!box) return;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 3 });
    await page.mouse.move(x + dx, y + dy, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(450);
  };
  await swipe('#trkDash [data-dash="depth"]', -150);
  const nextFive = await figures();
  check(
    theme,
    'T upright: a swipe left on the figures shows the five others',
    nextFive.length === 5 && !nextFive.some((key) => firstFive.includes(key)),
  );
  await swipe('#trkDash [data-dash]', 150);
  const againFive = await figures();
  check(
    theme,
    'T upright: a swipe right on the figures brings the first five back',
    againFive.join(' ') === firstFive.join(' '),
  );
  const rowOf = (selectors: string[]) =>
    page.evaluate((wanted) => {
      const width = globalThis.innerWidth;
      return wanted.map((selector) => {
        const box = document.querySelector(selector)?.getBoundingClientRect();
        if (!box) return 'absent';
        if (box.left >= width - 1 || box.right <= 1) return 'away';
        return box.top < 60 ? `${Math.round(box.left)}` : 'elsewhere';
      });
    }, selectors);
  const first = [
    '#clock',
    '.rail-boat',
    '.rail-start',
    '.rail-pin',
    '.rail-ruler',
  ];
  const second = [
    '#searchBtn',
    '.top-tab[data-view="tracker"]',
    '.rail-photo',
    '.rail-weather',
    '.top-tab.tab-sos',
  ];
  const shownFirst = await rowOf(first);
  const awaySecond = await rowOf(second);
  check(
    theme,
    'T upright: the top row, clock, arrow, START, mark, dividers; the others to their right',
    shownFirst.every((left) => /^\d+$/.test(left)) &&
      awaySecond.every((left) => left === 'away'),
  );
  await swipe('.rail-pin', -150);
  const shownSecond = await rowOf(second);
  const awayFirst = await rowOf(first);
  check(
    theme,
    'T upright: a swipe left shows magnifier, NavIn, photo, Météo, SOS at the same places',
    shownSecond.join(' ') === shownFirst.join(' ') &&
      awayFirst.every((left) => left === 'away') &&
      (await page.locator('.navin-row').count()) === 0,
  );
  await swipe('.rail-photo', 150);
  const back = await rowOf(first);
  check(
    theme,
    'T upright: a swipe right brings the first five back',
    back.join(' ') === shownFirst.join(' '),
  );
  // A finger that slides slowly turns the buttons one by one.
  const pin = await page.locator('.rail-pin').boundingBox();
  if (pin) {
    const y = pin.y + pin.height / 2;
    await page.mouse.move(pin.x + pin.width / 2, y);
    await page.mouse.down();
    for (const dx of [-20, -40, -60, -pin.width - 12]) {
      // eslint-disable-next-line no-await-in-loop -- a slow slide
      await page.mouse.move(pin.x + pin.width / 2 + dx, y);
      // eslint-disable-next-line no-await-in-loop -- idem
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(450);
  }
  check(
    theme,
    'T upright: a slow slide turns the buttons by one',
    (await page.evaluate(() => document.documentElement.dataset.railStart)) ===
      '1',
  );
  await swipe('.rail-ruler', 150);
  check(
    theme,
    'T upright: a big swipe back shows the first ones again',
    (await page.evaluate(() => document.documentElement.dataset.railStart)) ===
      '0',
  );
  await page.locator('.rail-boat').click();
  await page.waitForTimeout(300);
  check(
    theme,
    'T upright: − then ＋ one under the other under the arrow, full size',
    await page.evaluate(() => {
      // eslint-disable-next-line unicorn/consistent-function-scoping -- runs in the page
      const box = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect();
      const [arrow, plus, minus] = [
        '.rail-boat',
        '.rail-zoom-in',
        '.rail-zoom-out',
      ].map(box);
      if (!arrow || !plus || !minus) return false;
      return (
        minus.top >= arrow.bottom &&
        plus.top >= minus.bottom &&
        Math.abs(plus.left - minus.left) < 2 &&
        plus.height >= arrow.height - 2
      );
    }),
  );
  await page.locator(NAVIN).click();
  await page.waitForTimeout(400);
  check(
    theme,
    'T upright: NavIn unrolls its menus in a column under it',
    await page.evaluate(() => {
      // eslint-disable-next-line unicorn/consistent-function-scoping -- runs in the page
      const box = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect();
      const column = [
        '.top-tab[data-view="tracker"]',
        '.navin-row .rail-prep',
        '.navin-row .rail-comm',
      ].map(box);
      if (column.some((item) => !item)) return false;
      const boxes = column as DOMRect[];
      const [first] = boxes;
      return boxes.every((item, index) => {
        const below = boxes[index - 1];
        return (
          !below ||
          !first ||
          (item.top >= below.bottom - 1 && Math.abs(item.left - first.left) < 6)
        );
      });
    }),
  );
  await page.locator(NAVIN).click();
  await page.waitForTimeout(400);
}

async function layers(page: Page, theme: string): Promise<void> {
  check(
    theme,
    'no layer menu on the map: it is in my maps',
    !(await page.locator('.leaflet-control-layers').isVisible()),
  );
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
    'the magnifier opens one field at once, and blinks while open',
    (await page.locator('#searchInput').count()) === 1 &&
      ((await page.locator('#searchBtn').getAttribute('class')) ?? '').includes(
        'search-open',
      ),
  );
  await page.locator('#searchInput').fill('alarme');
  check(
    theme,
    'on the map it looks only on the map: no function',
    (await page.locator('.search-hit[data-hit=function]').count()) === 0,
  );
  await page.locator('#searchInput').fill('chillon');
  const firstGroup = await page.locator('.search-group').first().textContent();
  check(
    theme,
    'on the map, the places of the map',
    firstGroup?.includes('Lieux') === true,
  );
  await page.locator('.search-hit', { hasText: 'Chillon' }).first().click();
  await page.waitForTimeout(800);
  check(
    theme,
    'a place shows on the map',
    (await page.locator('.leaflet-tooltip').count()) > 0,
  );
}

async function buoyage(page: Page, theme: string): Promise<void> {
  // Map servers answer nothing here: the buoyage of the app must take over.
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const box = document.querySelector('.leaflet-control-zoom-in');
    (box as HTMLElement | null)?.click();
  });
  await page.waitForTimeout(800);
  const dot = await page.evaluate(() => {
    const seen = [...document.querySelectorAll('.vec-port')].find((item) => {
      const { x, y } = item.getBoundingClientRect();
      return x > 60 && x < 330 && y > 200 && y < 700;
    });
    const box = seen?.getBoundingClientRect();
    return box ? [box.x + box.width / 2, box.y + box.height / 2] : null;
  });
  check(theme, 'without network the buoyage shows', dot !== null);
  if (!dot) return;
  await page.mouse.click(dot[0] as number, dot[1] as number);
  await page.waitForTimeout(400);
  const text = await page.evaluate(
    () => document.querySelector('.leaflet-popup-content')?.textContent ?? '',
  );
  check(
    theme,
    'a tap names the mark, not the depth',
    text !== '' && !text.includes('Profondeur'),
  );
  await page.keyboard.press('Escape');
}

// A real vector tile, from a map file of the fixtures: the stand-in of the
// tiles of OpenFreeMap when the plan downloads a sheet.
async function fixtureTile(): Promise<Buffer> {
  const bytes = await readFile(
    path.join(import.meta.dirname, 'fixtures', 'porquerolles.pmtiles'),
  );
  const reader = new PMTiles({
    getKey: () => 'fixture',
    getBytes: async (offset, length) => ({
      data: bytes.buffer.slice(
        bytes.byteOffset + offset,
        bytes.byteOffset + offset + length,
      ),
    }),
  });
  const header = await reader.getHeader();
  const zoom = header.maxZoom;
  const count = 2 ** zoom;
  const x = Math.floor(((header.centerLon + 180) / 360) * count);
  const sin = Math.sin((header.centerLat * Math.PI) / 180);
  const y = Math.floor(
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * count,
  );
  const tile = await reader.getZxy(zoom, x, y);
  if (!tile) throw new Error('no fixture tile');
  return Buffer.from(tile.data);
}

// « Fonds de cartes » › Plan des cartes: the plan over the whole screen, a
// touch lists what covers the place, a sheet downloads into a map file of
// this device, nothing overflows.
async function mapPlan(page: Page, theme: string): Promise<void> {
  const tile = await fixtureTile();
  const cors = { 'access-control-allow-origin': '*' };
  await page.route(/tiles\.openfreemap\.org/u, (route) =>
    route.request().url().endsWith('/planet')
      ? route.fulfill({
          json: {
            tiles: ['https://tiles.openfreemap.org/planet/t/{z}/{x}/{y}.pbf'],
          },
          headers: cors,
        })
      : route.fulfill({ body: tile, headers: cors }),
  );
  await openGear(page);
  await page.waitForTimeout(300);
  await openData(page);
  await page.waitForTimeout(300);
  await page.locator('[data-tile="cartes"]').click();
  await page.waitForTimeout(500);
  await page.locator('#mapPlanOpen').click();
  await page.locator('#mapPlanMap.leaflet-container').waitFor();
  await page.waitForTimeout(800);
  const plan = await page.locator('#mapPlan').boundingBox();
  check(
    theme,
    'map plan: over the whole screen',
    plan?.width === page.viewportSize()?.width &&
      plan?.height === page.viewportSize()?.height,
  );
  const shown = await page.locator('#mapPlanMap').boundingBox();
  if (!shown) throw new Error('no plan');
  await page.mouse.click(
    shown.x + shown.width * 0.3,
    shown.y + shown.height * 0.45,
  );
  await page.waitForTimeout(500);
  check(
    theme,
    'map plan: a touch offers the large and the detailed sheet',
    (await page.locator('#mapPlanHere [data-download]').count()) === 2,
  );
  const sheet =
    (await page
      .locator('[data-download^="Grande carte"]')
      .getAttribute('data-download')) ?? '';
  await page.locator('[data-download^="Grande carte"]').click();
  await page.locator('#mapPlanJob').waitFor({ state: 'detached' });
  await page.waitForTimeout(500);
  check(
    theme,
    'map plan: the large sheet is now on this device',
    (await page.locator(`[data-plan-map="${sheet}"]`).count()) === 1,
  );
  check(
    theme,
    'map plan: nothing overflows',
    await page.evaluate(() =>
      [...document.querySelectorAll('#mapPlan *')].every(
        (element) =>
          element.closest('.leaflet-container') !== null ||
          element.scrollWidth <= element.clientWidth + 1,
      ),
    ),
  );
  await page.locator(`[data-plan-show="${sheet}"]`).click();
  check(
    theme,
    'map plan: a map of this device can be hidden',
    (await page
      .locator(`[data-plan-show="${sheet}"]`)
      .getAttribute('aria-pressed')) === 'false',
  );
  await page.locator('#mapPlanClose').click();
  await page.waitForTimeout(500);
  check(
    theme,
    'map plan: the sheet is listed with the maps of this device',
    (await page.locator(`[data-offline-map="${sheet}"]`).count()) === 1,
  );
}

async function myMaps(page: Page, theme: string): Promise<void> {
  await openGear(page);
  await page.waitForTimeout(300);
  check(
    theme,
    'my maps and my marks are not in the settings',
    (await page.locator('[data-go="cartes"], [data-go="marks"]').count()) === 0,
  );
  await openData(page);
  await page.waitForTimeout(300);
  check(
    theme,
    'my marks are in data',
    (await page.locator('[data-tile="marks"]').count()) === 1,
  );
  await page.locator('[data-tile="cartes"]').click();
  await page.waitForTimeout(500);
  const title =
    (await page.locator('#navTitle h1, main h1').first().textContent()) ?? '';
  check(theme, 'data leads to my maps', title.includes('Fonds de cartes'));
  check(
    theme,
    'my maps list the background and layers of the map',
    (await page.locator('#mapLayers input[type=radio]').count()) >= 1 &&
      (await page.locator('#mapLayers input[type=checkbox]').count()) >= 1,
  );
  await page.locator('#mapLayers label', { hasText: 'OpenSeaMap' }).click();
  await page.locator('#mapLayers label', { hasText: 'OpenSeaMap' }).click();
  await page.setInputFiles('#offlineFile', {
    name: 'notes.pmtiles',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('pas une carte'),
  });
  await page.waitForTimeout(500);
  const failure = (await page.locator('#offlineFailure').textContent()) ?? '';
  check(
    theme,
    'a refused map import says why, under the button',
    failure.includes('notes.pmtiles') && failure.includes('pas une carte'),
  );
  // The fixed title line: ◀ back to data, the title, no Sortir nor magnifier.
  const back = await page.locator('#navBack').boundingBox();
  const heading = await page.locator('#navTitle h1').boundingBox();
  check(
    theme,
    'the title line holds ◀ and the title of the page, nothing else',
    back !== null &&
      heading !== null &&
      heading.x >= back.x + back.width &&
      !(await page.locator('#navExit').isVisible()) &&
      !(await page.locator('#navSearch').isVisible()),
  );
}

// How far the boat is from the middle of the map, in pixels.
const boatOffCentre = (page: Page) =>
  page.evaluate(() => {
    const boat = document.querySelector('.trk-arrow')?.getBoundingClientRect();
    const map = document.querySelector('#trkMap')?.getBoundingClientRect();
    if (!boat || !map) return Number.POSITIVE_INFINITY;
    return Math.hypot(
      boat.x + boat.width / 2 - (map.x + map.width / 2),
      boat.y + boat.height / 2 - (map.y + map.height / 2),
    );
  });

// The way the map is turned, in degrees.
const mapTurn = (page: Page) =>
  page.evaluate(() => {
    const pane = document.querySelector<HTMLElement>('.leaflet-rotate-pane');
    const matrix = new DOMMatrix(pane?.style.transform);
    return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
  });

async function follow(page: Page, theme: string): Promise<void> {
  const sail = (lat: number, lon: number, heading: number) =>
    page.evaluate(
      (point) => {
        (
          globalThis as unknown as {
            fakeGps: (lat: number, lon: number, heading: number) => void;
          }
        ).fakeGps(point.lat, point.lon, point.heading);
      },
      { lat, lon, heading },
    );
  await sail(46.45, 6.6, 0);
  await page.waitForTimeout(300);
  // The GPS, the real zone, is active only once the boat arrow is touched.
  await page.locator('.rail-boat').click();
  await page.waitForTimeout(800);
  for (let step = 1; step <= 3; step++) {
    // eslint-disable-next-line no-await-in-loop -- one GPS point per second
    await sail(46.45 + step * 0.0001, 6.6, 0);
    // eslint-disable-next-line no-await-in-loop -- one GPS point per second
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(1300);
  check(
    theme,
    'the boat stays in the middle of the map',
    (await boatOffCentre(page)) < 3,
  );
  check(
    theme,
    'the map opens north up',
    (await page.locator('.leaflet-container.course-up').count()) === 0,
  );
  // A long press on the arrow turns the map to the course.
  await longPress(page, '.rail-boat');
  await page.waitForTimeout(400);
  check(
    theme,
    'the arrow puts the course up',
    (await page.locator('.leaflet-container.course-up').count()) > 0,
  );
  const turns: number[] = [];
  await sail(46.4504, 6.6, 90);
  for (let step = 0; step < 8; step++) {
    // eslint-disable-next-line no-await-in-loop -- sampling the turn
    await page.waitForTimeout(150);
    // eslint-disable-next-line no-await-in-loop -- sampling the turn
    turns.push(await mapTurn(page));
  }
  const between = turns.filter((turn) => turn < -5 && turn > -85);
  check(theme, 'the map turns gradually, without a jump', between.length >= 2);
  check(
    theme,
    'the course reaches the top within 1.5 s',
    Math.abs((turns.at(-1) ?? 0) + 90) < 2,
  );
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(700);
  check(
    theme,
    'turning the phone keeps the boat in the middle',
    (await boatOffCentre(page)) < 3,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700);
  check(theme, 'turning it back too', (await boatOffCentre(page)) < 3);
  // On a phone the map often gets its final size after the turn of the screen.
  await page.evaluate(() => {
    document
      .querySelector<HTMLElement>('#trkMap')
      ?.style.setProperty('height', '320px', 'important');
  });
  await page.waitForTimeout(700);
  check(
    theme,
    'a late change of the map size keeps the boat in the middle',
    (await boatOffCentre(page)) < 3,
  );
  await page.evaluate(() => {
    localStorage.setItem('ldb.mapOrientation', 'north');
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'load' });
  await page.locator('.map-locate-btn').waitFor({ state: 'attached' });
  await page.waitForTimeout(1000);
  await page.addStyleTag({
    content: '#toast { pointer-events: none !important; }',
  });
  // Each pass shows its theme whatever the hour (night mode comes on its own
  // after dusk).
  await page.evaluate(
    (shown) => {
      document.documentElement.dataset.theme = shown;
    },
    theme === 'night' ? 'night' : 'day',
  );
}

async function recenter(page: Page, theme: string): Promise<void> {
  await page.evaluate(() => {
    (
      globalThis as unknown as {
        fakeGps: (lat: number, lon: number, heading: number) => void;
      }
    ).fakeGps(46.45, 6.6, 0);
  });
  await page.waitForTimeout(500);
  const box = await page.locator('#trkMap').boundingBox();
  if (!box) return;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const followed = () =>
    page.locator('.map-locate-btn.on').count().then(Boolean);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 60, y - 60, { steps: 6 });
  await page.mouse.move(x - 120, y - 120, { steps: 6 });
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(5000);
  check(
    theme,
    'a map moved by hand stays there for a while',
    (await boatOffCentre(page)) > 50 && !(await followed()),
  );
  await page.waitForTimeout(16_000);
  check(
    theme,
    'without a track it does not come back to the boat by itself',
    (await boatOffCentre(page)) > 50 && !(await followed()),
  );
}

async function crewCard(page: Page, theme: string): Promise<void> {
  const button = page.locator('#navOk');
  const name = page.locator('#fPrenom');
  const shown = async () => {
    const text = await button.textContent();
    return text?.trim();
  };
  const isPencil = async () =>
    (await button.getAttribute('aria-label')) === 'Modifier' &&
    (await button.locator('svg').count()) === 1 &&
    (await shown()) === '';
  await openData(page);
  await page.locator('[data-tile="people"]').click();
  await page.locator('#mNew').click();
  check(theme, 'a new crew card has the green tick', (await shown()) === '✔');
  check(theme, 'it can be typed in', !(await name.getAttribute('readonly')));
  await name.fill('Marie');
  await page.locator('#view details.section:not(.cv-sec) > summary').click();
  await page.locator('[data-k="nationalite"]').fill('Suisse');
  await button.click();
  await page.waitForTimeout(300);
  check(
    theme,
    'validated, the tick becomes a pencil, without text',
    await isPencil(),
  );
  check(
    theme,
    'and the card is read-only',
    (await name.getAttribute('readonly')) !== null,
  );
  const labels = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('#view .cf label')]
        .filter((item) => item.offsetParent !== null)
        .map((item) => item.textContent.trim().replaceAll(' *', '')),
    );
  check(
    theme,
    'read-only, only what is filled shows',
    JSON.stringify(await labels()) === '["Prénom","Nationalité"]',
  );
  check(
    theme,
    'no empty photo section',
    !(await page.locator('.f-photos').isVisible()),
  );
  await page.locator('#navBack').click();
  await page.waitForTimeout(300);
  await page.locator('[data-fiche]').first().click();
  await page.waitForTimeout(300);
  check(
    theme,
    'it opens read-only again',
    (await name.getAttribute('readonly')) !== null,
  );
  await button.click();
  await page.waitForTimeout(300);
  check(
    theme,
    'the pencil makes it editable, with the tick back',
    (await name.getAttribute('readonly')) === null && (await shown()) === '✔',
  );
  const editing = await labels();
  check(theme, 'editing shows every field again', editing.length > 5);
  await name.fill('Marie-Claire');
  const address = page.locator('[data-k="adresse"]');
  await address.fill(
    'Chemin de la très longue adresse postale 123, 1000 Lausanne, Suisse romande',
  );
  await button.click();
  await page.waitForTimeout(1800);
  check(
    theme,
    'read-only, a long text scrolls',
    await address.evaluate((field) => field.scrollLeft > 0),
  );
  check(
    theme,
    'the change is kept',
    (await name.inputValue()) === 'Marie-Claire' &&
      (await name.getAttribute('readonly')) !== null,
  );
}

async function crewAndBoat(page: Page, theme: string): Promise<void> {
  const button = page.locator('#navOk');
  const isPencil = async () =>
    (await button.getAttribute('aria-label')) === 'Modifier';
  // A crew: built, then read-only.
  await openData(page);
  await page.locator('[data-tile="crews"]').click();
  await page.locator('#csNew').click();
  await page.locator('[data-cem]').first().click();
  await page.waitForTimeout(200);
  await button.click();
  await page.waitForTimeout(300);
  check(theme, 'a validated crew is read-only', await isPencil());
  check(
    theme,
    'it lists its members, without the pick list',
    (await page.locator('.crew-read-line').count()) === 1 &&
      (await page.locator('[data-cem]').count()) === 0,
  );
  await button.click();
  await page.waitForTimeout(300);
  check(
    theme,
    'the pencil opens the crew for editing',
    (await page.locator('[data-cem]').count()) > 0 && !(await isPencil()),
  );
  await button.click();
  await page.waitForTimeout(300);
  check(
    theme,
    'the tick brings the crew back to reading',
    (await page.locator('#ceRead').count()) === 1 && (await isPencil()),
  );
  // A boat: filled, then only what is filled.
  await openData(page);
  await page.locator('[data-tile="boats"]').click();
  await page.locator('#addBoat').click();
  await page.waitForTimeout(300);
  const details = page.locator('#boatList [data-k="boat"]').first();
  await details.fill('Savannah');
  const before = await page.locator('#boatList .cf:visible').count();
  await button.click();
  await page.waitForTimeout(300);
  const after = await page.locator('#boatList .cf:visible').count();
  check(theme, 'a validated boat shows a pencil', await isPencil());
  check(
    theme,
    'and only what is filled',
    after > 0 && after < before && (await details.inputValue()) === 'Savannah',
  );
  check(
    theme,
    'and no delete button',
    !(await page.locator('[data-del]').first().isVisible()),
  );
  await button.click();
  await page.waitForTimeout(300);
  check(
    theme,
    'the pencil opens the boat for editing',
    (await page.locator('#boatList .cf:visible').count()) === before,
  );
}

async function boatPolar(page: Page, theme: string): Promise<void> {
  // The polar of a boat, found in the ORC certificates kept with the site.
  await openData(page);
  await page.locator('[data-tile="boats"]').click();
  await page.waitForTimeout(300);
  const polar = page.locator('[data-polar]').first();
  if (!(await polar.isVisible())) {
    await page.locator('#boatList summary').first().click();
    await page.waitForTimeout(300);
  }
  await polar.click();
  await page.waitForTimeout(300);
  await page.locator('#polSearch').fill('Hanse 325 2011');
  await page.locator('#polSearchBtn').click();
  const first = page.locator('#polFound li').first();
  await first.waitFor({ timeout: 10_000 });
  const found = (await first.textContent()) ?? '';
  check(
    theme,
    'Bateaux › polaire: the ORC certificates find the Hanse 325',
    found.startsWith('Hanse 325'),
  );
  await page.locator('.pol-take').first().click();
  await page.waitForTimeout(300);
  const digest = (await page.locator('.pol-digest').textContent()) ?? '';
  const rows = await page.locator('#polTable tbody tr').count();
  check(
    theme,
    'and keeps its polar, at 85 % for a cruise',
    /85 %.*près [\d,]+ nd à \d+°/.test(digest) && rows > 8,
  );
  // The sails of the boat, and those up for the real polar.
  await page.locator('#sailAdd').fill('Code 0');
  await page.locator('#sailAddBtn').click();
  await page.waitForTimeout(300);
  await page.locator('#sailHead').selectOption('Code 0');
  await page.waitForTimeout(200);
  check(
    theme,
    'a sail of the boat is added and set up',
    (await page.locator('#sailsExtra li').count()) === 1 &&
      (await page.locator('#sailHead').inputValue()) === 'Code 0',
  );
  const last = (await page.locator('#view .btn').last().textContent()) ?? '';
  check(theme, 'and Partager comes last', last.includes('Partager'));
  await page.locator('#navBack').click();
  await page.waitForTimeout(300);
  const button = (await polar.textContent()) ?? '';
  check(theme, 'the boat shows its polar', button.includes('Hanse 325'));
}

async function swipeMenu(page: Page, theme: string): Promise<void> {
  await openData(page);
  await page.locator('[data-tile="people"]').click();
  await page.waitForTimeout(300);
  const row = page.locator('[data-fiche]').first();
  check(
    theme,
    'no bin on the rows',
    (await page.locator('.row-delete').count()) === 0,
  );
  const box = await row.boundingBox();
  if (!box) return;
  check(theme, 'rows keep their full width', box.width > 300);
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 20, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 60, y, { steps: 4 });
  await page.mouse.move(box.x + box.width - 140, y, { steps: 4 });
  await page.mouse.move(-10, y, { steps: 2 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const back = await row.boundingBox();
  check(theme, 'the row slides back', back?.x === box.x);
  check(
    theme,
    'swiping left opens the menu: share, delete (no 👁: a touch on the band shows it)',
    (await page.locator('.sw-menu').isVisible()) &&
      (await page.locator('.sw-menu [data-swview]').count()) === 0 &&
      (await page.locator('.sw-menu .share-btn').count()) === 1 &&
      (await page.locator('.sw-menu [data-swdel]').count()) === 1,
  );
  // A tap on the trash deletes nothing: only a long press does.
  await page.locator('.sw-menu [data-swdel]').click();
  check(
    theme,
    'a tap on the trash keeps the row',
    (await page.locator('[data-fiche]').count()) > 0,
  );
  // A touch elsewhere closes the menu.
  await page.locator('h1, .page-title').first().click({ force: true });
  await page.waitForTimeout(200);
  check(
    theme,
    'a touch elsewhere closes the menu',
    (await page.locator('.sw-menu').count()) === 0,
  );
}

async function marksShare(page: Page, theme: string): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem(
      'ldb.marks',
      JSON.stringify([
        {
          id: 'mk1',
          n: 1,
          name: 'M001',
          lat: 46.45,
          lon: 6.6,
          at: '2026-11-14T10:00:00Z',
        },
      ]),
    );
  });
  await page.reload();
  await page.waitForTimeout(1500);
  await openData(page);
  await page.locator('[data-tile="marks"]').click();
  await page.waitForTimeout(400);
  check(
    theme,
    'marks: one « Tout partager » only, no list row beside it',
    (await page.locator('[data-mk="gpx"], [data-mk="txt"]').count()) === 0 &&
      (await page.locator('[data-lxpub="marks"]').count()) === 1,
  );
  await page.locator('[data-lxpub="marks"]').click();
  await page.waitForTimeout(200);
  check(
    theme,
    'marks: Tout partager goes straight to the network or the PDF, no GPX',
    (await page.locator('.lx-pub [data-share-kind]').count()) === 0 &&
      (await page.locator('.lx-pub [data-share-fmt]').count()) === 2,
  );
  await page.locator('h1, .page-title').first().click({ force: true });
  await page.waitForTimeout(200);
  await longPress(page, '.mark-item .mark-head');
  await page.locator('[data-mk="text"]').fill('Bouée verte');
  await page.locator('[data-mk="text"]').press('Enter');
  await page.waitForTimeout(300);
  check(
    theme,
    'marks: no chevron, a long press changes the text in place',
    (await page.locator('.mark-item summary').count()) === 0 &&
      (await page.locator('.mark-item .b-nm').first().textContent()) ===
        'Bouée verte',
  );
  await page.locator('.mark-item .mark-head').first().click();
  await page.waitForTimeout(800);
  check(
    theme,
    'marks: a touch shows the mark on the map',
    await page.evaluate(() => document.body.classList.contains('trk-mode')),
  );
  await openData(page);
  await page.locator('[data-tile="marks"]').click();
  await page.waitForTimeout(400);
  await page.locator('[data-lxpub="marks"]').click();
  await page.waitForTimeout(200);
  // Rule of the layout: Envoyer has the height of the action buttons
  // (« Partager » before it), never the height of a menu tile.
  await page.locator('.lx-pub [data-share-fmt]').first().click();
  await page.waitForTimeout(300);
  check(
    theme,
    'marks: Envoyer as tall as the action buttons around it',
    await page.evaluate(() => {
      // eslint-disable-next-line unicorn/consistent-function-scoping -- runs in the page
      const height = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect().height ?? -1;
      const send = height('.share-send');
      const share = height('[data-lxpub]');
      return send > 0 && Math.abs(send - share) <= 1;
    }),
  );
}

/**
 * The rule of the layouts on the menus and their pages: two buttons one
 * above the other never touch (Météorologie and its pages, data,
 * Paramétrages and each of its sections).
 * @param page - The page.
 * @param theme - Theme checked.
 */
async function layoutGaps(page: Page, theme: string): Promise<void> {
  const tight: string[] = [];
  const look = async (where: string) => {
    await page.waitForTimeout(500);
    for (const pair of await tightButtons(page)) {
      tight.push(`${where}: ${pair}`);
    }
    for (const below of await belowSettings(page)) {
      tight.push(`${where}: « ${below} » below the way to Paramétrages`);
    }
    for (const plain of await plainRefresh(page)) {
      tight.push(`${where}: « ${plain} » without the look of a refresh`);
    }
  };
  /* eslint-disable no-await-in-loop -- one page after the other */
  for (const entry of ['', 'forecast', 'lightning', 'check']) {
    await page.locator(NAVIN).click();
    await page.waitForTimeout(500);
    await page.locator('.rail-weather').first().click();
    await page.waitForTimeout(500);
    if (entry) {
      await page.locator(`[data-wx="${entry}"]`).click();
      await page.waitForTimeout(800);
    }
    await look(entry || 'Météorologie');
  }
  await openData(page);
  await look('data');
  await openGear(page);
  await look('Paramétrages');
  const sections = await page
    .locator('button[data-sec]')
    .evaluateAll((items) =>
      items.map((item) => (item as HTMLElement).dataset.sec ?? ''),
    );
  for (const section of sections) {
    // Back on the menu of Paramétrages by its ◀ (twice from a section of Alertes).
    while ((await page.locator('.set-menu').count()) === 0) {
      await page.locator('#navBack').click();
      await page.waitForTimeout(400);
    }
    await page.locator(`button[data-sec="${section}"]`).click();
    await look(`Paramétrages › ${section}`);
    // Alertes holds its own sections: each one looked at too.
    const subs = await page
      .locator('.set-page button[data-sec]')
      .evaluateAll((items) =>
        items.map((item) => (item as HTMLElement).dataset.sec ?? ''),
      );
    for (const sub of subs) {
      if ((await page.locator(`button[data-sec="${sub}"]`).count()) === 0) {
        await page.locator('#navBack').click();
        await page.waitForTimeout(400);
      }
      await page.locator(`button[data-sec="${sub}"]`).click();
      await look(`Paramétrages › ${section} › ${sub}`);
    }
  }
  await page.locator(NAVIN).click();
  await page.waitForTimeout(400);
  /* eslint-enable no-await-in-loop */
  check(
    theme,
    `layouts: buttons one above the other never touch, the way to Paramétrages last${tight.length > 0 ? ` (${tight.join(' · ')})` : ''}`,
    tight.length === 0,
  );
}

/**
 * The rule of the scales: in French and in English, the same columns, the
 * same fonts and sizes; nothing moves when the language changes. Opened from
 * the forecast of Météo, their ◀ comes back to it.
 * @param page - The page.
 * @param theme - Theme checked.
 */
async function scalesSteady(page: Page, theme: string): Promise<void> {
  const layout = () =>
    page.evaluate(() =>
      [
        ...document.querySelectorAll(
          '.scale-tbl th, .scale-tbl tr:nth-child(2) td',
        ),
      ]
        .map((cell) => {
          const box = cell.getBoundingClientRect();
          const style = globalThis.getComputedStyle(cell);
          return `${Math.round(box.left)}:${Math.round(box.width)}:${style.fontSize}:${style.fontFamily}`;
        })
        .join('|'),
    );
  // A clean start, on the map.
  await page.reload();
  await page.waitForTimeout(1500);
  await page.locator('.rail-weather').click();
  await page.waitForTimeout(400);
  await page.locator('[data-wx="forecast"]').click();
  await page.waitForTimeout(600);
  check(
    theme,
    'Prévisions: now, next hours, next days, general situation, bulletin of the zone, sources, in that order',
    await page.evaluate(() => {
      const order = [
        '.wx-now',
        '.wx-fc',
        '.wx-days',
        '.wx-analysis',
        '.wx-bulletin',
        '.wx-links',
      ].map((selector) => document.querySelector(selector));
      for (let at = 1; at < order.length; at += 1) {
        const before = order[at - 1];
        const section = order[at];
        if (!before || !section) return false;
        if (
          !(
            before.compareDocumentPosition(section) &
            Node.DOCUMENT_POSITION_FOLLOWING
          )
        ) {
          return false;
        }
      }
      return order[0] !== null;
    }),
  );
  check(
    theme,
    'Prévisions: go / no-go of today and of the next days, the analysis of the place of the zone or of the GPS (no list of zones; versions by date, refresh, rerun), the BMS of the zone and the tides of the SHOM; no fixed alerts here',
    (await page.locator('[data-page-link="gonogo-today"]').count()) === 1 &&
      (await page.locator('[data-page-link="gonogo"]').count()) === 1 &&
      (await page.locator('[data-analysis-point]').count()) === 1 &&
      (await page.locator('[data-analysis="refresh"]').count()) === 1 &&
      (await page.locator('[data-analysis="rerun"]').count()) === 1 &&
      (await page.locator('[data-analysis-zone]').count()) === 0 &&
      (await page.locator('[data-page-link="analysis-offline"]').count()) +
        (await page.locator('[data-analysis-none]').count()) ===
        1 &&
      (await page
        .locator(
          '.wx-links [data-site-link="wx-bms-manche"], .wx-links [data-site-link="wx-bms-provence"], .wx-links [data-site-link="wx-meteoswiss"]',
        )
        .count()) === 1 &&
      (await page.locator('[data-page-link="fixed"]').count()) === 0,
  );
  const offline = await page.request.get(
    new globalThis.URL('analyse/saint-quay/index.html', page.url()).href,
  );
  const copyText = await offline.text();
  check(
    theme,
    'Prévisions: the analysis kept offline is served with NavIn',
    offline.ok() && copyText.includes('data-copie'),
  );
  for (const view of ['beaufort']) {
    /* eslint-disable no-await-in-loop -- one scale after the other */
    await page.locator(`[data-page-link="${view}"]`).click();
    await page.waitForTimeout(400);
    check(
      theme,
      `${view}: the combined reading says at which point`,
      (await page.locator('[data-bd-point]').count()) === 1,
    );
    await page.locator('[data-slang="fr"]').click();
    await page.waitForTimeout(200);
    const french = await layout();
    await page.locator('[data-slang="en"]').click();
    await page.waitForTimeout(200);
    const english = await layout();
    await page.locator('[data-slang="fr"]').click();
    check(
      theme,
      `${view}: the same columns and fonts in French and in English`,
      french.length > 0 && french === english,
    );
    await page.locator('#navBack').click();
    await page.waitForTimeout(400);
    check(
      theme,
      `${view}: its ◀ comes back to the forecast it was opened from`,
      (await page.locator('.wx-links').count()) === 1,
    );
    /* eslint-enable no-await-in-loop */
  }
  // The fixed alerts: from the forecast to the zone on the map, and from the
  // zone back to the list, its alert blinking.
  await page.locator('.rail-weather').click();
  await page.waitForTimeout(400);
  await page.locator('[data-wx="fixed"]').click();
  await page.waitForTimeout(400);
  check(
    theme,
    'Météo › Alertes fixes: the seas and their alerts',
    (await page.locator('[data-fixed-sea]').count()) === 4 &&
      (await page.locator('[data-fixed]').count()) > 20,
  );
  check(
    theme,
    'Alertes fixes: no 🗺 on the bands, the map is in the swipe',
    (await page.locator('[data-fixed-map]').count()) === 0,
  );
  check(
    theme,
    'Alertes fixes: no ⚠ on the bands, the name alone, where opens first',
    (await page
      .locator('[data-fixed] .mk-pin, [data-fixed] .mk-text small')
      .count()) === 0,
  );
  // The GPS sort: the whole list from the nearest zone (Saint-Quay here).
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = (success) => {
      success({
        timestamp: Date.now(),
        coords: { latitude: 48.65, longitude: -2.83, accuracy: 5 },
      } as GeolocationPosition);
    };
  });
  // One button turns A → Z, by use, GPS.
  check(
    theme,
    'Alertes fixes: one sort button at the right of the title',
    (await page.locator('h1 .menu-sort').count()) === 1,
  );
  await page.locator('[data-fixed-gps]').click();
  await page.waitForTimeout(300);
  check(
    theme,
    'Alertes fixes: the first touch turns to the order of use',
    (await page.locator('[data-fixed-order="use"]').count()) === 1,
  );
  await page.locator('[data-fixed-gps]').click();
  await page.waitForTimeout(400);
  check(
    theme,
    'Alertes fixes › GPS: one list, the bay of Saint-Brieuc first',
    (await page.locator('[data-fixed-sea]').count()) === 1 &&
      (await page
        .locator('[data-fixed-sea="gps"] [data-fixed]')
        .first()
        .getAttribute('data-fixed')) === 'st-brieuc',
  );
  await page.locator('[data-fixed-gps]').click();
  await page.waitForTimeout(400);
  check(
    theme,
    'Alertes fixes: the third touch comes back to A → Z, sea by sea',
    (await page.locator('[data-fixed-order="alpha"]').count()) === 1 &&
      (await page.locator('[data-fixed-sea]').count()) === 4,
  );
  const bandRow = page.locator('[data-sw-id="fixed:raz-blanchard"]');
  await bandRow.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const band = await bandRow.boundingBox();
  if (band) {
    const y = band.y + band.height / 2;
    await page.mouse.move(band.x + band.width - 20, y);
    await page.mouse.down();
    await page.mouse.move(band.x + band.width - 60, y, { steps: 4 });
    await page.mouse.move(band.x + band.width - 140, y, { steps: 4 });
    await page.mouse.move(-10, y, { steps: 2 });
    await page.mouse.up();
    await page.waitForTimeout(300);
  }
  await page.locator('.sw-menu [data-swview]').click();
  await page.waitForTimeout(1500);
  check(
    theme,
    'a fixed alert touched: its zone on the map',
    (await page.locator('path.fixed-zone').count()) === 1,
  );
  await page.locator('path.fixed-zone').dispatchEvent('click');
  await page.waitForTimeout(1000);
  check(
    theme,
    'its zone touched: back to the list, the alert blinking, its card open',
    (await page
      .locator('[data-sw-id="fixed:raz-blanchard"].band-blink')
      .count()) === 1 &&
      (await page.locator('[data-fixed-card="raz-blanchard"]').count()) === 1,
  );
  // The GoNoGo: in Prévisions only (no more in the Météo menu), its own page,
  // the boat asked for (out of a cruise) or shown.
  await page.locator('.rail-weather').click();
  await page.waitForTimeout(400);
  check(
    theme,
    'Météo: no GoNoGo in the menu, it is in Prévisions',
    (await page.locator('[data-wx="gonogo"]').count()) === 0,
  );
  await page.locator('[data-wx="forecast"]').click();
  await page.waitForTimeout(600);
  await page.locator('[data-page-link="gonogo"]').click();
  await page.waitForTimeout(800);
  check(
    theme,
    'Prévisions › GoNoGo: the point, and the boat asked for or shown',
    (await page.locator('[data-gng="page"] [data-gng-point]').count()) === 1 &&
      (await page.locator('[data-gng="choose"], [data-gng="boat"]').count()) ===
        1,
  );
  // The lightning alert: its own page in the Météo menu (the button of
  // Météo climbs one level at a time: GoNoGo, Prévisions, the menu).
  check(
    theme,
    'GoNoGo: the Météo button comes back to Prévisions first',
    await (async () => {
      await page.locator('.rail-weather').click();
      await page.waitForTimeout(400);
      return (await page.locator('[data-page-link="gonogo"]').count()) === 1;
    })(),
  );
  await page.locator('.rail-weather').click();
  await page.waitForTimeout(400);
  await page.locator('[data-wx="lightning"]').click();
  await page.waitForTimeout(400);
  check(
    theme,
    'Météo › Alerte orage: the map, a look now and the way to its settings',
    (await page.locator('[data-lightning="map"]').count()) === 1 &&
      (await page.locator('[data-lightning="settings"]').count()) === 1 &&
      (await page.locator('[data-lightning-radius]').count()) === 0,
  );
  // The rule of the « Actualiser » buttons: touched, the look « en cours ».
  await page.locator('[data-lightning="look"]').click();
  await page.waitForTimeout(150);
  check(
    theme,
    'Météo › Alerte orage: « Actualiser maintenant » touched shows the refresh running',
    (await page.locator('[data-lightning="look"].refreshing').count()) === 1,
  );
  const lightningTight = await tightButtons(page);
  check(
    theme,
    `Météo › Alerte orage: the buttons one above the other never touch${lightningTight.length > 0 ? ` (${lightningTight.join(', ')})` : ''}`,
    lightningTight.length === 0,
  );
  await page.locator('[data-lightning="settings"]').click();
  await page.waitForTimeout(500);
  check(
    theme,
    'Alerte orage: its switch, its four comebacks and its four distances',
    (await page.locator('[data-lightning="toggle"]').count()) === 1 &&
      (await page.locator('[data-reon]').count()) === 4 &&
      (await page.locator('[data-lightning-radius]').count()) === 4,
  );
  // Back to the map, Paramétrages left.
  await page.locator(NAVIN).click();
  await page.waitForTimeout(500);
}

/**
 * Alerts coming together (wind, lightning, warning lights) never pile up:
 * their bubbles come one after the other, each at a touch on the one before.
 * @param page - The page.
 * @param theme - Theme checked.
 */
async function alertsInTurn(page: Page, theme: string): Promise<void> {
  await openGear(page);
  await page.waitForTimeout(500);
  await page.locator('.set-entry[data-sec="alerts"]').click();
  await page.waitForTimeout(400);
  await page.locator('.set-entry[data-sec="tests"]').click();
  await page.waitForTimeout(400);
  await page.locator('[data-alerts="in-turn"]').click();
  const seen: string[] = [];
  /* eslint-disable no-await-in-loop -- one bubble after the other */
  for (let turn = 0; turn < 4; turn++) {
    await page.waitForTimeout(1200);
    const shown = await page
      .locator('.wind-pop')
      .evaluateAll((pops) => pops.map((pop) => pop.id));
    seen.push(shown.join('+') || 'none');
    if (shown.length > 0) {
      await page.locator('.wind-pop .wp-close').first().click();
    }
  }
  /* eslint-enable no-await-in-loop */
  check(
    theme,
    'alerts together come one after the other, never piled up',
    seen.join(' ') === 'windPop lightningPop lakeWarnPop none',
  );
}

// Where the side buttons of the tablet stand, to the pixel.
const TABLET_BUTTONS = [
  '#clock',
  '.top-tab[data-view="tracker"]',
  '.top-tab.tab-sos',
  '#searchBtn',
  '.side-rail-left .rail-btn',
  '.rail-pin',
  '.rail-boat',
  '.rail-ruler',
  '.rail-photo',
  '.rail-weather',
];

async function tabletPlaces(page: Page): Promise<string> {
  const places: string[] = [];
  for (const selector of TABLET_BUTTONS) {
    // eslint-disable-next-line no-await-in-loop -- one button after the other
    const box = await page.locator(selector).first().boundingBox();
    places.push(
      box
        ? `${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)}`
        : 'absent',
    );
  }
  return places.join(' ');
}

/**
 * The rule of the landscape tablet: on every screen the clock, the boat and
 * the pin stand on the left, SOS, settings, NavIn, magnifier, VHF and data on
 * the right, at the
 * same places, and the page stays between the two columns.
 */
/**
 * The rule of the menu buttons: the one of the open menu blinks between the
 * yellow of PréP and white by day (never on a dark face), on PréP's night
 * colour at night.
 * @param page - The page, a menu just opened.
 * @param theme - Theme checked.
 * @param name - The menu.
 */
async function menuBlink(page: Page, theme: string, name: string) {
  // The theme shown: after dusk the day pass is in night mode on its own.
  const { face, night } = await page.evaluate(() => {
    const button = document.querySelector('.menu-here');
    return {
      face: button
        ? globalThis.getComputedStyle(button).backgroundColor
        : 'absent',
      night: document.documentElement.dataset.theme === 'night',
    };
  });
  check(
    theme,
    `the ${name} button blinks on ${night ? 'its night face' : 'white'}`,
    night ? face !== 'absent' : face === 'rgb(255, 255, 255)',
  );
}

/**
 * By day the data button is never grey: black writing on white; it is not
 * lit on a menu of another button.
 * @param page - The page.
 * @param theme - Theme checked.
 * @param name - The screen shown.
 */
async function dataFace(page: Page, theme: string, name: string) {
  if (name === 'settings') {
    // The settings have their own button: data does not stay lit.
    check(
      theme,
      'data is not lit on the settings',
      !(await page.locator('.top-tab.tab-data.active').count()),
    );
  }
  if (theme === 'night') return;
  const face = await page.evaluate(() => {
    const tab = document.querySelector('.top-tab.tab-data');
    if (!tab) return 'absent';
    const style = globalThis.getComputedStyle(tab);
    return `${style.backgroundColor} ${style.color}`;
  });
  check(
    theme,
    `data is black on white on ${name}`,
    face === 'rgb(255, 255, 255) rgb(0, 0, 0)',
  );
}

const longPress = async (page: Page, selector: string) => {
  const box = await page.locator(selector).boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();
  await page.waitForTimeout(1500);
};

const zoneChosen = (page: Page) =>
  page.evaluate(() => localStorage.getItem('ldb.zoneSim'));

/**
 * The zones of NavIn on the tablet: the Swiss map gives way to OpenStreetMap
 * out of Switzerland; after the boat arrow (GPS on Lake Geneva) a long press
 * on NavIn goes to sea.
 * @param page - The tablet page, on the map.
 * @param theme - Theme checked.
 */
/**
 * The next zone of navigation, from the settings (as the long press on
 * NavIn), then back to the map.
 * @param page - The tablet page.
 */
async function nextZoneX(page: Page): Promise<void> {
  if (!(await page.locator('#gearBtn').isVisible())) {
    await page.locator(NAVIN).click();
    await page.waitForTimeout(400);
  }
  await openGear(page);
  await page.waitForTimeout(500);
  // Paramétrages is a menu: the section of the zone opens on its own page.
  await page.locator('.set-entry[data-sec="zone"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-zonesim]').click();
  await page.waitForTimeout(300);
  await page.locator(NAVIN).click();
  await page.waitForTimeout(1200);
}

async function zones(page: Page, theme: string): Promise<void> {
  // The theme chosen, as kept: the one shown follows dusk on its own.
  const night = () =>
    page.evaluate(
      () =>
        (
          JSON.parse(localStorage.getItem('ldb.settings') ?? '{}') as {
            theme?: string;
          }
        ).theme,
    );
  const before = await night();
  await longPress(page, '#searchBtn');
  const after = await night();
  await longPress(page, '#searchBtn');
  check(
    theme,
    'tablet: a long press on the magnifier turns night and day',
    before !== after &&
      (await night()) === before &&
      (await page.locator('#searchBtn .dn-sun').count()) === 1 &&
      (await page.locator('#searchBtn .dn-moon').count()) === 1,
  );
  const logo = () => page.locator(NAVIN).innerHTML();
  const logo0 = await logo();
  await longPress(page, NAVIN);
  const logo1 = await logo();
  await longPress(page, NAVIN);
  const logo2 = await logo();
  await longPress(page, NAVIN);
  const logo3 = await logo();
  check(
    theme,
    'tablet: a long press on NavIn turns Atlantique, Méditerranée, Lacs, each with its logo',
    new Set([logo1, logo2, logo3]).size === 3 && logo3 === logo0,
  );
  if ((await zoneChosen(page)) !== 'lac') await nextZoneX(page);
  if ((await zoneChosen(page)) !== 'lac') await nextZoneX(page);
  await page.evaluate(() => {
    const label = [
      ...document.querySelectorAll('.leaflet-control-layers label'),
    ].find((one) => one.textContent?.includes('nationale suisse'));
    label?.querySelector('input')?.click();
  });
  const checked = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.leaflet-control-layers label')]
        .filter((one) => one.querySelector('input')?.checked)
        .map((one) => one.textContent?.trim())
        .join('|'),
    );
  const onLake = await checked();
  check(
    theme,
    'tablet: on the lake the Swiss map can be chosen',
    onLake.includes('nationale suisse'),
  );
  await nextZoneX(page);
  const background = await checked();
  check(
    theme,
    'tablet: at sea the Swiss map gives way to OpenStreetMap',
    background.includes('Plan OpenStreetMap') &&
      !background.includes('nationale'),
  );
  await page.evaluate(() => {
    (
      globalThis as unknown as {
        fakeGps: (lat: number, lon: number, heading: number) => void;
      }
    ).fakeGps(46.45, 6.6, 0);
  });
  await page.waitForTimeout(500);
  await page.locator('.rail-boat').click();
  await page.waitForTimeout(1200);
  check(
    theme,
    'tablet: the boat arrow goes back to the GPS',
    (await zoneChosen(page)) === 'auto',
  );
}

async function tablet(page: Page, theme: string): Promise<void> {
  const home = await tabletPlaces(page);
  check(theme, 'tablet: every side button is shown', !home.includes('absent'));
  // One column on the left: the buttons of the right one under the others,
  // in their order, and SOS alone at the very bottom.
  const column = await page.evaluate(() =>
    [
      '#clock',
      '.rail-boat',
      '.rail-start',
      '.side-rail #routesBtn',
      '.rail-pin',
      '.rail-ruler',
      '#searchBtn',
      '.top-tab[data-view="tracker"]',
      '.rail-photo',
      '.rail-weather',
      '.top-tab.tab-data',
      '#gearBtn',
      '.top-tab.tab-sos',
    ].map((selector) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box ? { x: box.x, y: box.y, bottom: box.bottom } : null;
    }),
  );
  const sos = column.at(-1);
  const tall = (page.viewportSize()?.height ?? 0) >= 640;
  check(
    theme,
    `X landscape: ${tall ? 'one column on the left, in order, SOS at the very bottom' : 'the phone sideways keeps its two columns'}`,
    !tall ||
      (column.every((box) => box !== null && box.x < 40) &&
        column.every(
          (box, index) =>
            index === 0 || (box?.y ?? 0) > (column[index - 1]?.y ?? 0),
        ) &&
        sos !== null &&
        sos !== undefined &&
        sos.bottom > (page.viewportSize()?.height ?? 0) - 30),
  );
  check(
    theme,
    'tablet: data and the settings always shown, under Météo',
    (await page.locator('.top-tab.tab-data').isVisible()) &&
      (await page.locator('#gearBtn').isVisible()),
  );
  if (tall) {
    const start = await page.locator('.rail-start').boundingBox();
    const routes = await page.locator('#routesBtn').boundingBox();
    check(
      theme,
      'tablet: Routes in the column under START, no tab of the menus',
      start !== null &&
        routes !== null &&
        Math.abs(routes.x - start.x) < 2 &&
        routes.y > start.y + start.height &&
        (await page.locator('.menus-tab').count()) === 0 &&
        (await page.locator('#routesBtn').count()) === 1,
    );
    await page.locator('#routesBtn').click();
    await page.waitForTimeout(500);
    const made = await page.locator('#routeNewBtn').boundingBox();
    const wx = await page.locator('#routeWxBtn').boundingBox();
    check(
      theme,
      'tablet: Routes unrolls Nouvelle route and Routage météo at its right',
      routes !== null &&
        made !== null &&
        wx !== null &&
        Math.abs(made.y - routes.y) < 2 &&
        made.x > routes.x + routes.width &&
        wx.x > made.x + made.width,
    );
    await page.locator('#routesBtn').click();
    await page.waitForTimeout(500);
    check(
      theme,
      'tablet: a second touch rolls them back',
      (await page.locator('#routeNewBtn').count()) === 0,
    );
    await page.locator(NAVIN).click();
    await page.waitForTimeout(400);
    await page.locator(NAVIN).click();
    await page.waitForTimeout(400);
  } else {
    check(
      theme,
      'phone sideways: Routes behind the tab',
      !(await page.locator('#routesBtn').isVisible()),
    );
    await page.locator('.menus-tab').click();
    await page.waitForTimeout(400);
    const tab = await page.locator('.menus-tab').boundingBox();
    const routes = await page.locator('#routesBtn').boundingBox();
    check(
      theme,
      'phone sideways: the tab at the top in the middle unrolls Routes under it',
      tab !== null &&
        routes !== null &&
        tab.y < 2 &&
        routes.y >= tab.y + tab.height &&
        routes.x < tab.x + tab.width / 2 &&
        routes.x + routes.width > tab.x + tab.width / 2,
    );
    await page.waitForTimeout(5300);
    check(
      theme,
      'phone sideways: left alone, Routes fades and goes after 5 s; data and the settings stay',
      !(await page.locator('#routesBtn').isVisible()) &&
        (await page.locator('#gearBtn').isVisible()),
    );
  }
  await page.locator(NAVIN).click();
  await page.waitForTimeout(400);
  check(
    theme,
    'tablet: a touch on NavIn unrolls PréP and the phone, not data nor the settings',
    (await page.locator('.navin-row .rail-prep').isVisible()) &&
      (await page.locator('.navin-row .top-tab.tab-data').count()) === 0 &&
      (await page.locator('.navin-row #gearBtn').count()) === 0 &&
      (await page.locator('.navin-row .rail-comm').isVisible()),
  );
  await page.locator(NAVIN).click();
  await page.waitForTimeout(400);
  check(
    theme,
    'tablet: a second touch rolls it back',
    (await page.locator('.navin-row').count()) === 0,
  );
  check(
    theme,
    'tablet: ＋ hides until the arrow is touched',
    (await page.locator('.rail-zoom-in').count()) === 0,
  );
  await page.locator('.rail-boat').click();
  await page.waitForTimeout(300);
  check(
    theme,
    'tablet: the arrow shows ＋ at its right',
    await page.locator('.rail-zoom-in').isVisible(),
  );
  await page.waitForTimeout(3300);
  check(
    theme,
    'tablet: ＋ fades out from 2 s',
    (await page.locator('.rail-zoom-in.fading').count()) === 1,
  );
  await page.waitForTimeout(2000);
  check(
    theme,
    'tablet: ＋ goes away after 2 s shown and 3 s fading',
    (await page.locator('.rail-zoom-in').count()) === 0,
  );
  const screens: Array<[string, string]> = [
    ['data', '.top-tab.tab-data'],
    ['SOS', '.top-tab.tab-sos'],
    ['settings', '#gearBtn'],
  ];
  for (const [name, opener] of screens) {
    /* eslint-disable no-await-in-loop -- one screen after the other */
    if (!(await page.locator(opener).isVisible())) await showRow(page);
    const at = await page.locator(opener).boundingBox();
    const tall = page.viewportSize()?.height ?? 0;
    // The phone sideways: data and the settings on the next packet of the
    // column, touched there without turning it (the places stay compared).
    if (at && at.y + at.height > tall) {
      await page.locator(opener).dispatchEvent('click');
    } else {
      await page.locator(opener).click();
    }
    // The button touched sinks in a moment (pressFeedback): wait it is back.
    await page.waitForTimeout(1100);
    const here = await tabletPlaces(page);
    check(theme, `tablet: same side buttons on ${name}`, here === home);
    if (name !== 'SOS') await menuBlink(page, theme, name);
    await dataFace(page, theme, name);
    const view = await page.locator('main#view').boundingBox();
    const left = await page.locator('#clock').boundingBox();
    const width = page.viewportSize()?.width ?? 0;
    /* eslint-enable no-await-in-loop */
    check(
      theme,
      `tablet: the ${name} page stays beside the column`,
      view !== null &&
        left !== null &&
        view.x >= left.x + left.width &&
        view.x + view.width <= width,
    );
  }
  // NavIn away from the map: back on the map, the row rolled back.
  await page.locator(NAVIN).click();
  await page.waitForTimeout(800);
  check(
    theme,
    'tablet: NavIn brings the map back and rolls its row',
    (await page.locator('#trkMap').isVisible()) &&
      (await page.locator('.navin-row').count()) === 0,
  );
}

/**
 * The 💬 pill touched with a finger opens its window, which stays open: the
 * click a finger makes as it lifts once closed it at once.
 * @param page - A page with a touch screen.
 * @param theme - Theme checked.
 * @param where - Phone or tablet.
 */
async function remarkPill(
  page: Page,
  theme: string,
  where: string,
): Promise<void> {
  const pill = await page.locator('#remPill').boundingBox();
  check(theme, `${where}: the 💬 pill is shown`, pill !== null);
  if (!pill) return;
  await page.touchscreen.tap(pill.x + pill.width / 2, pill.y + pill.height / 2);
  await page.waitForTimeout(800);
  check(
    theme,
    `${where}: a finger on the 💬 pill opens its window`,
    await page.locator('.rem-modal textarea').isVisible(),
  );
}

/**
 * A short tap on the map lays the cross of four logos; the map slid under it
 * leaves it in its place; a logo opens its menu; a tap beside closes it.
 * @param page - A page with a touch screen.
 * @param theme - Theme checked.
 * @param where - Phone or tablet.
 */
async function tapCross(
  page: Page,
  theme: string,
  where: string,
): Promise<void> {
  const map = await page.locator('.trk-map').boundingBox();
  if (!map) {
    check(theme, `${where}: the map is shown for the cross`, false);
    return;
  }
  // A finger is drawn to the nearest port or mark: those are set aside here.
  await page.addStyleTag({
    content:
      '.leaflet-marker-icon:not(.tap-cross) { visibility: hidden !important; pointer-events: none !important; }',
  });
  // A bare place of the map: not the boat, a port or a mark.
  const spot = await page.evaluate(
    (box) => {
      // Near the middle: the logos stand 13 cm around the point.
      for (const fy of [0.5, 0.55, 0.45, 0.6, 0.4]) {
        for (const fx of [0.5, 0.45, 0.55, 0.4, 0.6]) {
          const px = Math.round(box.x + box.width * fx);
          const py = Math.round(box.y + box.height * fy);
          const element = document.elementFromPoint(px, py);
          if (element?.closest('.leaflet-marker-icon, .leaflet-control')) {
            continue;
          }
          if (element?.closest('.trk-map')) return { x: px, y: py };
        }
      }
      return null;
    },
    { x: map.x, y: map.y, width: map.width, height: map.height },
  );
  if (!spot) {
    check(theme, `${where}: a bare place on the map for the cross`, false);
    return;
  }
  const { x, y } = spot;
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(500);
  check(
    theme,
    `${where}: a tap on the map lays the cross of four logos`,
    (await page.locator('.tap-cross .tap-logo').count()) === 4,
  );
  check(
    theme,
    `${where}: the logos of the cross are on screen`,
    await page.locator('.tap-logo-info').isVisible(),
  );
  await page.locator('.tap-logo-info').tap();
  await page.waitForTimeout(500);
  check(
    theme,
    `${where}: a logo of the cross opens its menu with the position`,
    (await page.locator('.lp-pop [data-lp="send"]').count()) === 1,
  );
  await page.touchscreen.tap(x, Math.round(map.y + map.height - 160));
  await page.waitForTimeout(400);
  check(
    theme,
    `${where}: a tap beside closes the menu`,
    (await page.locator('.lp-pop, .tap-cross').count()) === 0,
  );
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(500);
  const laid = (await page.locator('.tap-cross').count()) === 1;
  await page.waitForTimeout(3600);
  check(
    theme,
    `${where}: the cross goes away 3 s after the map last moved`,
    laid && (await page.locator('.tap-cross').count()) === 0,
  );
}

// Whether a map file draws at the middle of the map (its tiles are canvases).
const offlineDrawn = (page: Page) =>
  page.evaluate(() => {
    const box = document.querySelector('#trkMap')?.getBoundingClientRect();
    if (!box) return false;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2 + 40;
    return [...document.querySelectorAll('.leaflet-layer canvas')].some(
      (tile) => {
        const canvas = tile as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        if (x < rect.left || x >= rect.right) return false;
        if (y < rect.top || y >= rect.bottom) return false;
        const pixel = canvas
          .getContext('2d')
          ?.getImageData(
            Math.floor(((x - rect.left) * canvas.width) / rect.width),
            Math.floor(((y - rect.top) * canvas.height) / rect.height),
            1,
            1,
          ).data;
        return (pixel?.[3] ?? 0) > 0;
      },
    );
  });

/** A blue square, the radar tile the test answers. */
const RAIN_TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * LiveMétéo on the map of the tablet: buttons of the size of Météo at its
 * right, no band, the rain of the radar on the zone, the page never
 * scrolls (SOS stays in its place), the buttons fade when left alone.
 * Routes unrolls Nouvelle route and Routage météo; the map has no route
 * button of its own.
 * @param page - The tablet page, on the map.
 * @param theme - Day or night.
 */
async function liveButtons(page: Page, theme: string): Promise<void> {
  await page.route('https://api.rainviewer.com/**', (route) =>
    route.fulfill({
      json: {
        host: 'https://tilecache.rainviewer.com',
        radar: {
          past: [{ time: Math.floor(Date.now() / 1000), path: '/v2/radar/1' }],
        },
      },
    }),
  );
  await page.route('https://tilecache.rainviewer.com/**', (route) =>
    route.fulfill({ body: RAIN_TILE, contentType: 'image/png' }),
  );
  await page.locator(NAVIN).click();
  await page.waitForTimeout(800);
  check(
    theme,
    'map: no route button of its own on the map',
    (await page.locator('.trk-map .route-btn').count()) === 0,
  );
  const weather = await page.locator('.rail-weather').boundingBox();
  if (!weather) {
    check(theme, 'LiveMétéo: Météo is shown', false);
    return;
  }
  await page.mouse.move(
    weather.x + weather.width / 2,
    weather.y + weather.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
  await page.waitForTimeout(2500);
  const settled =
    (await page.locator('.rail-weather').boundingBox()) ?? weather;
  const slots = await page.evaluate(() =>
    [...document.querySelectorAll('.live-slot')].map((slot) => {
      const box = slot.getBoundingClientRect();
      return { x: box.x, y: box.y, w: box.width, h: box.height };
    }),
  );
  const [zoneSlot, ...column] = slots;
  const screenWidth = page.viewportSize()?.width ?? 0;
  check(
    theme,
    `LiveMétéo: the zone button at the right of Météo, the others in a column at the right edge, of its size (${slots.length})`,
    slots.length >= 5 &&
      zoneSlot !== undefined &&
      Math.abs(zoneSlot.y - settled.y) < 1 &&
      zoneSlot.x > settled.x &&
      slots.every(
        (slot) =>
          Math.abs(slot.w - settled.width) < 1 &&
          Math.abs(slot.h - settled.height) < 1,
      ) &&
      column.every(
        (slot, index) =>
          slot.x + slot.w > screenWidth - settled.width - 30 &&
          (index === 0 || slot.y > (column[index - 1]?.y ?? 0)),
      ),
  );
  check(
    theme,
    'LiveMétéo: no band of stations nor bar of layers',
    (await page.locator('.live-chip, .wx-bar').count()) === 0,
  );
  check(
    theme,
    'LiveMétéo: no button for the stations and buoys (the hour now only)',
    (await page.locator('.live-layer[data-layer="stations"]').count()) === 0,
  );
  const rain = await page.evaluate(() => {
    const tiles = [
      ...document.querySelectorAll<HTMLImageElement>(
        '.leaflet-wxRain-pane img',
      ),
    ];
    const inside = tiles.filter((tile) =>
      tile.closest('.leaflet-rotatePane-pane, .leaflet-rotate-pane'),
    );
    const seen = tiles.filter((tile) => {
      const box = tile.getBoundingClientRect();
      return (
        box.right > 0 &&
        box.left < globalThis.innerWidth &&
        box.bottom > 0 &&
        box.top < globalThis.innerHeight
      );
    });
    return { all: tiles.length, inside: inside.length, seen: seen.length };
  });
  check(
    theme,
    `LiveMétéo: the rain of the radar lies on the zone, turning with the map (${JSON.stringify(rain)})`,
    rain.all > 0 && rain.inside === rain.all && rain.seen > 0,
  );
  check(
    theme,
    'LiveMétéo: the page does not scroll, SOS stays at the bottom',
    await page.evaluate(
      () =>
        (document.scrollingElement?.scrollHeight ?? 0) <=
        globalThis.innerHeight + 1,
    ),
  );
  await page.locator('.live-step').first().click();
  await page.waitForTimeout(300);
  check(
    theme,
    'LiveMétéo: an hour ahead, the stations and the lightning are hidden',
    (await page.locator('.trk-map.live-ahead').count()) === 1,
  );
  await page.locator('.live-hour').click();
  await page.waitForTimeout(300);
  check(
    theme,
    'LiveMétéo: back at the hour now, they are shown again',
    (await page.locator('.trk-map.live-ahead').count()) === 0,
  );
  await page.waitForTimeout(9800);
  check(
    theme,
    'LiveMétéo: left alone, its buttons stay (no fading)',
    (await page.locator('.live-btns.live-shown').count()) === 1,
  );
  await page.locator('.live-radius-btn').click();
  await page.waitForTimeout(300);
  check(
    theme,
    'LiveMétéo: the zone button takes it away',
    (await page.locator('.live-btns').count()) === 0,
  );
  // The tablet sideways: Routes in the column, its two buttons at its
  // right; elsewhere behind the tab, under it.
  const inColumn = (await page.locator('.menus-tab').count()) === 0;
  await page.locator(inColumn ? '#routesBtn' : '.menus-tab').click();
  // The button touched sinks in a moment (pressFeedback): wait it is back.
  await page.waitForTimeout(inColumn ? 1100 : 400);
  const unrolled = await page.evaluate((side) => {
    const routes = document
      .querySelector('#routesBtn')
      ?.getBoundingClientRect();
    const made = document
      .querySelector('#routeNewBtn')
      ?.getBoundingClientRect();
    const wx = document.querySelector('#routeWxBtn')?.getBoundingClientRect();
    if (!routes || !made || !wx) return false;
    return side
      ? Math.abs(made.y - routes.y) < 2 &&
          made.x > routes.right &&
          Math.abs(wx.y - routes.y) < 2 &&
          wx.x > made.right
      : Math.abs(made.x - routes.x) < 1 &&
          made.y > routes.bottom &&
          Math.abs(wx.x - routes.x) < 1 &&
          wx.y > made.bottom;
  }, inColumn);
  check(
    theme,
    'Routes: Nouvelle route and Routage météo unroll beside it',
    unrolled,
  );
  await page.locator('#routeWxBtn').click();
  await page.waitForTimeout(500);
  check(
    theme,
    'Routes: Routage météo opens its part',
    (await page
      .locator('[data-part="routing"][aria-selected="true"]')
      .count()) === 1,
  );
  await page.locator(NAVIN).click();
  await page.waitForTimeout(600);
  await page
    .locator(
      (await page.locator('.menus-tab').count()) === 0
        ? '#routesBtn'
        : '.menus-tab',
    )
    .click();
  await page.waitForTimeout(400);
  await page.locator('#routeNewBtn').click();
  await page.waitForTimeout(800);
  check(
    theme,
    'Routes: Nouvelle route opens the route panel on the map',
    await page.locator('.route-panel').isVisible(),
  );
  await page.locator('.route-panel [data-rp="done"]').click();
  await page.waitForTimeout(300);
  await page.unroute('https://api.rainviewer.com/**');
  await page.unroute('https://tilecache.rainviewer.com/**');
}

/**
 * A route across Porquerolles, the map file of the island on the device:
 * « Contourner la terre » bends it round the island, at the margin.
 * @param page - The page shown, the map files imported.
 * @param theme - Day or night.
 */
async function routeAround(page: Page, theme: string): Promise<void> {
  await page.evaluate(() => {
    const now = new Date().toISOString();
    localStorage.setItem(
      'ldb.routes',
      JSON.stringify([
        {
          id: 'smoke-porquerolles',
          name: 'Travers de Porquerolles',
          at: now,
          mod: now,
          points: [
            { lat: 43.03, lon: 6.2 },
            { lat: 42.975, lon: 6.2 },
          ],
          speed: 6.5,
        },
      ]),
    );
  });
  await page.reload({ waitUntil: 'load' });
  await page.locator('.map-locate-btn').waitFor({ state: 'attached' });
  await page.waitForTimeout(800);
  // Routes has its own button, between data and the settings.
  await showRow(page);
  check(
    theme,
    'Routes is not a tile of data',
    (await page.locator('[data-tile="routes"]').count()) === 0,
  );
  await page.locator('#routesBtn').click();
  await page.waitForTimeout(500);
  await page.locator('#rtList .mark-head').first().click();
  await page.waitForTimeout(1500);
  await page.locator('.route-panel [data-rp="auto"]').click();
  await page.waitForFunction(
    () => !document.querySelector<HTMLElement>('.rp-msg')?.hidden,
    null,
    { timeout: 30_000 },
  );
  const said = (await page.locator('.rp-msg').textContent()) ?? '';
  const laid = await page.locator('.route-pt').count();
  check(
    theme,
    `a route across Porquerolles goes round the island (${laid} points)`,
    said.includes('contourné') && laid > 2,
  );
  check(
    theme,
    'the way round says rocks and shallows are not avoided',
    said.includes('hauts-fonds'),
  );
}

// Two map files side by side, network gone: both show where the boat sails.
async function offlineFiles(page: Page, theme: string): Promise<void> {
  await openGear(page);
  await page.waitForTimeout(300);
  await openData(page);
  await page.waitForTimeout(300);
  await page.locator('[data-tile="cartes"]').click();
  await page.waitForTimeout(500);
  /* eslint-disable no-await-in-loop -- one file after the other */
  for (const name of ['porquerolles', 'port-cros']) {
    await page.setInputFiles(
      '#offlineFile',
      path.join(import.meta.dirname, 'fixtures', `${name}.pmtiles`),
    );
    await page.waitForTimeout(1500);
  }
  /* eslint-enable no-await-in-loop */
  check(
    theme,
    'two map files are imported',
    (await page.locator('[data-offline-map]').count()) === 2,
  );
  await page.reload({ waitUntil: 'load' });
  await page.locator('.map-locate-btn').waitFor({ state: 'attached' });
  await page.evaluate(
    (shown) => {
      document.documentElement.dataset.theme = shown;
    },
    theme === 'night' ? 'night' : 'day',
  );
  await page.evaluate(() => {
    (
      window as unknown as {
        fakeGps: (lat: number, lon: number, heading: number) => void;
      }
    ).fakeGps(43, 6.2, 90);
  });
  await page.waitForTimeout(500);
  // On the GPS (the boat arrow), the map follows the boat.
  await page.locator('.rail-boat').click();
  await page.waitForTimeout(3000);
  const ticked = await page.evaluate(() =>
    [...document.querySelectorAll('.leaflet-control-layers-overlays label')]
      .filter((label) => label.textContent?.includes('Hors ligne'))
      .map((label) => label.querySelector('input')?.checked),
  );
  check(
    theme,
    'every map file is ticked in the layer menu by default',
    ticked.length === 2 && ticked.every(Boolean),
  );
  check(
    theme,
    'without network the map file shows under the boat',
    await offlineDrawn(page),
  );
  await page.evaluate(() => {
    (
      window as unknown as {
        fakeGps: (lat: number, lon: number, heading: number) => void;
      }
    ).fakeGps(43, 6.42, 90);
  });
  await page.waitForTimeout(3000);
  check(
    theme,
    'sailing on, the next map file shows too',
    await offlineDrawn(page),
  );
}

// Tablet track button: short touches only; the pause holds until its button
// is touched again (a tap on the map does nothing); FIN beside it, in two
// touches; the tick shows on the button, not on NavIn.
async function trackButton(page: Page, theme: string): Promise<void> {
  const has = (selector: string) =>
    page.evaluate((query) => document.querySelector(query) !== null, selector);
  await longPress(page, '.rail-start');
  const title = await page.locator('h1, .page-title').first().textContent();
  check(
    theme,
    'tablet: a long press on START opens Traces',
    title?.includes('Traces') === true && !(await has('.rail-run')),
  );
  await page.locator(NAVIN).click();
  await page.waitForTimeout(1200);
  await page.locator('.rail-start').click();
  await page.waitForTimeout(800);
  check(
    theme,
    'tablet: a short touch on START records',
    await has('.rail-run'),
  );
  check(
    theme,
    'tablet: Amarrage stands at the right of START during a track',
    await has('.rail-depart .rail-moor'),
  );
  await page.locator(NAVIN).click();
  await page.waitForTimeout(400);
  check(
    theme,
    'tablet: during a track the row of NavIn keeps PréP, Météo has its own button',
    (await page.locator('.navin-row .rail-prep').count()) === 1 &&
      (await page.locator('.navin-row .rail-weather').count()) === 0 &&
      (await page.locator('.rail-weather').count()) === 1,
  );
  await page.locator(NAVIN).click();
  await page.waitForTimeout(400);
  await page.locator('.rail-track').click();
  await page.waitForTimeout(300);
  const box = await page.locator('#trkMap').boundingBox();
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + 200);
  await page.waitForTimeout(1500);
  check(
    theme,
    'tablet: the pause holds, whatever is touched beside',
    (await has('.rail-paused')) && (await has('.rail-fin')),
  );
  await page.locator('.rail-track').click();
  await page.waitForTimeout(300);
  check(theme, 'tablet: a touch on II resumes', await has('.rail-run'));
  await page.locator('.rail-track').click();
  await page.waitForTimeout(300);
  await page.locator('.rail-fin').click();
  await page.waitForTimeout(300);
  await page.locator('.rail-fin').click();
  await page.waitForTimeout(800);
  const navinFace = await page.locator('.top-tab').first().innerHTML();
  check(
    theme,
    'tablet: FIN in two touches ends the track, the tick on its button',
    (await has('.rail-done')) && !navinFace.includes('tb-done'),
  );
  await page.waitForTimeout(3500);
  check(theme, 'tablet: START comes back', await has('.rail-start'));
}

// Phone: the track has its own button on the map, with every step; NavIn
// keeps none of them.
async function phoneTrack(page: Page, theme: string): Promise<void> {
  const has = (selector: string) =>
    page.evaluate((query) => document.querySelector(query) !== null, selector);
  await page.locator('.side-rail-left .rail-start').click();
  await page.waitForTimeout(800);
  check(
    theme,
    'phone: START records at a short touch',
    await has('.side-rail-left .rail-run'),
  );
  const navin =
    (await page
      .locator('.top-tab[data-view="tracker"]')
      .getAttribute('aria-label')) ?? '';
  check(
    theme,
    'phone: NavIn does not turn into the track',
    !navin.includes('TRACK'),
  );
  await page.locator('.side-rail-left .rail-track').click();
  await page.waitForTimeout(300);
  check(
    theme,
    'phone: the pause holds, FIN beside it',
    (await has('.side-rail-left .rail-paused')) &&
      (await has('.side-rail-left .rail-fin')),
  );
  await page.locator('.side-rail-left .rail-fin').click();
  await page.waitForTimeout(300);
  await page.locator('.side-rail-left .rail-fin').click();
  await page.waitForTimeout(800);
  check(
    theme,
    'phone: FIN ends the track, the tick on its button',
    await has('.side-rail-left .rail-done'),
  );
  await page.waitForTimeout(3500);
}

// The phone held upright has the buttons of T; sideways the column of X.
async function turnPhone(browser: Browser): Promise<void> {
  const context = await browser.newContext({ viewport: PHONE });
  await context.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  const page = railAware(await context.newPage());
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  check(
    'day',
    'an upright phone has the buttons of T, no notice to turn it',
    (await page.locator('.side-rail-left').count()) === 1 &&
      (await page.locator('.turn-phone').count()) === 0,
  );
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(800);
  check(
    'day',
    'a phone sideways has the column of X',
    (await page.locator('.side-rail-left').count()) === 1,
  );
  await context.close();
}

/**
 * A route drawn by hand: the route button of the map, three taps lay three
 * points (no cross), the panel gives the length, the Routes button keeps it,
 * and the Routes page lists it with Partager last.
 * @param page - The page shown.
 * @param theme - Day or night.
 */
// Routes › Routage météo: the route drawn, the boat and its polar, a wind
// of the west (Open-Meteo answered here), then the times of the routing.
async function shomSection(page: Page, theme: string): Promise<void> {
  await openGear(page);
  await page.waitForTimeout(400);
  await page.locator('button[data-sec="shom"]').click();
  await page.waitForTimeout(400);
  const href = (await page.locator('#shomBuy').getAttribute('href')) ?? '';
  const said = (await page.locator('#shomState').textContent()) ?? '';
  check(
    theme,
    'Paramétrages: Copernicus by default, a button to buy a SHOM subscription',
    href.includes('shom.fr') && said.includes('Copernicus'),
  );
  await page.locator(NAVIN).click();
  await page.waitForTimeout(400);
}

async function routingWeather(page: Page, theme: string): Promise<void> {
  await page.route(/api\.open-meteo\.com\/v1\/forecast/, async (route) => {
    const url = new globalThis.URL(route.request().url());
    const places = (url.searchParams.get('latitude') ?? '').split(',').length;
    const start = Math.floor(Date.now() / 3_600_000) * 3600 - 3600;
    const time = Array.from({ length: 72 }, (_, hour) => start + hour * 3600);
    const one = {
      hourly: {
        time,
        // eslint-disable-next-line camelcase -- name in the API
        wind_speed_10m: time.map(() => 12),
        // eslint-disable-next-line camelcase -- name in the API
        wind_direction_10m: time.map(() => 270),
        // eslint-disable-next-line camelcase -- name in the API
        wind_gusts_10m: time.map(() => 20),
        cape: time.map(() => 700),
      },
    };
    await route.fulfill({
      json: places > 1 ? Array.from({ length: places }, () => one) : one,
    });
  });
  await page.route(/marine-api\.open-meteo\.com\/v1\/marine/, async (route) => {
    const url = new globalThis.URL(route.request().url());
    const places = (url.searchParams.get('latitude') ?? '').split(',').length;
    const start = Math.floor(Date.now() / 3_600_000) * 3600 - 3600;
    const time = Array.from({ length: 72 }, (_, hour) => start + hour * 3600);
    const one = {
      hourly: {
        time,
        // eslint-disable-next-line camelcase -- name in the API
        wave_height: time.map(() => 1.5),
        // eslint-disable-next-line camelcase -- name in the API
        wave_direction: time.map(() => 300),
        // eslint-disable-next-line camelcase -- name in the API
        wave_period: time.map(() => 6),
        // eslint-disable-next-line camelcase -- name in the API
        ocean_current_velocity: time.map(() => 2),
        // eslint-disable-next-line camelcase -- name in the API
        ocean_current_direction: time.map(() => 90),
      },
    };
    await route.fulfill({
      json: places > 1 ? Array.from({ length: places }, () => one) : one,
    });
  });
  await showRow(page);
  await page.locator('#routesBtn').click();
  await page.waitForTimeout(400);
  check(
    theme,
    'Planification d’itinéraire has two parts, Route and Routage',
    (await page.locator('#rtParts [data-part]').count()) === 2 &&
      ((await page.locator('[data-part="draw"]').textContent()) ?? '').includes(
        'Route',
      ),
  );
  await page.locator('[data-part="routing"]').click();
  await page.waitForTimeout(300);
  await page.locator('#rtgRun').click();
  await page
    .locator('#rtgResult, #rtgMsg')
    .first()
    .waitFor({ timeout: 15_000 });
  const said =
    (await page.locator('#rtgResult, #rtgMsg').first().textContent()) ?? '';
  check(
    theme,
    `Routage: the arrival and the hours of the routing (${said.slice(0, 80)})`,
    said.includes('Arrivée') &&
      (await page.locator('#rtgSteps tbody tr').count()) > 0,
  );
  check(
    theme,
    'and it says whether the land was seen during the boards',
    ((await page.locator('#rtgLand').textContent()) ?? '').includes('Terre'),
  );
  check(
    theme,
    'and that the currents and waves were taken into account',
    ((await page.locator('#rtgSea').textContent()) ?? '').includes(
      'pris en compte',
    ),
  );
  const last = (await page.locator('#view .btn').last().textContent()) ?? '';
  check(theme, 'and Partager comes last', last.includes('Partager'));
  await page.locator('#rtgShow').click();
  await page.waitForTimeout(1500);
  check(
    theme,
    'Terminer shows the routing on the map, wind, current and waves along it',
    (await page.locator('.rtm').count()) > 0 &&
      (await page.locator('.rtm .wx-cur').count()) > 0 &&
      (await page.locator('.rtm .wx-dg').count()) > 0,
  );
  check(
    theme,
    'with the barbs and arrows of LiveMétéo and the angle to the apparent wind',
    (await page.locator('.rtm svg').count()) >= 3 &&
      (
        (await page.locator('.rtm .rtm-aw').first().textContent()) ?? ''
      ).includes('∡'),
  );
  check(
    theme,
    'only the route: ETD at the start, ETA at the end',
    (await page.locator('.rtm-end').count()) === 2 &&
      ((await page.locator('.rtm-end').last().textContent()) ?? '').includes(
        'ETA',
      ),
  );
  const label = (await page.locator('#rtgLabel').textContent()) ?? '';
  check(
    theme,
    `a label gives the length, manoeuvres, wind, gusts, waves and storms (${label.slice(0, 160)})`,
    label.includes('Durée') &&
      label.includes('Distance') &&
      /De (?:nuit|jour)/u.test(label) &&
      label.includes('virement') &&
      label.includes('rafales 20 nd') &&
      label.includes('Vagues max') &&
      label.includes('Risque orageux possible'),
  );
  const etd = (await page.locator('#rtgInfo').textContent()) ?? '';
  check(
    theme,
    `the middle button gives the hour of departure (${etd.slice(0, 40)})`,
    etd.includes('Départ à'),
  );
  await page.locator('#rtgLater').click();
  await page.waitForTimeout(2000);
  const later = (await page.locator('#rtgInfo').textContent()) ?? '';
  check(
    theme,
    `▲ moves the ETD 30 min later, routed again (${later.slice(0, 40)})`,
    later !== etd &&
      later.includes('Départ à') &&
      (await page.locator('.rtm-end.rtm-blink').count()) === 0,
  );
  check(
    theme,
    'the routing labels are framed and tied to the track, with the speed',
    (await page.locator('.rtm-lead').count()) > 0 &&
      (
        (await page.locator('.rtm .rtm-tag').first().textContent()) ?? ''
      ).includes('nd'),
  );
  await page.locator('#rtgLabelX').click();
  await page.waitForTimeout(300);
  const hidden = (await page.locator('#rtgLabel').count()) === 0;
  await page.locator('.rtm-end:has([data-end="eta"])').click();
  await page.waitForTimeout(300);
  check(
    theme,
    'its ✕ hides the label, a touch on the ETA shows it again',
    hidden && (await page.locator('#rtgLabel').isVisible()),
  );
  await page.locator('#rtgInfo').click();
  await page.waitForTimeout(2000);
  check(
    theme,
    'a touch in the middle: Départ imminent, ▼ greyed, the button of the wind measured',
    ((await page.locator('#rtgInfo').textContent()) ?? '').includes(
      'Départ imminent',
    ) &&
      (await page.locator('#rtgEarlier[aria-disabled="true"]').count()) === 1 &&
      (await page.locator('#rtgOverlay').isVisible()),
  );
  await page.locator('#rtgOverlay').click();
  await page.waitForTimeout(300);
  check(
    theme,
    'the wind measured and the storms over the routing leaving now',
    (await page.locator('#rtgOverlay[aria-pressed="true"]').count()) === 1,
  );
  await page.locator('#rtgOverlay').click();
  await page.waitForTimeout(300);
  const labelBox = await page.locator('#rtgLabel').boundingBox();
  if (labelBox) {
    await page.mouse.move(labelBox.x + 20, labelBox.y + 10);
    await page.mouse.down();
    await page.mouse.move(labelBox.x - 60, labelBox.y + 160, { steps: 6 });
    await page.mouse.up();
  }
  await page.waitForTimeout(300);
  const moved = await page.locator('#rtgLabel').boundingBox();
  check(
    theme,
    'the label moves with the finger',
    labelBox !== null &&
      moved !== null &&
      Math.abs(moved.y - labelBox.y - 150) < 12,
  );
  await page.evaluate(() => localStorage.removeItem('ldb.routingLabel'));
  const middleBox = await page.locator('#rtgInfo').boundingBox();
  if (middleBox) {
    await page.mouse.move(
      middleBox.x + middleBox.width / 2,
      middleBox.y + middleBox.height / 2,
    );
    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
  }
  await page
    .locator('#rtgBar.rtg-green')
    .waitFor({ timeout: 20_000 })
    .catch(() => null);
  await page.waitForTimeout(500);
  check(
    theme,
    'a long press in the middle sorts the routings of the 6 next hours',
    (await page.locator('#rtgBar.rtg-green').count()) === 1 &&
      ((await page.locator('#rtgInfo').textContent()) ?? '').includes(
        'n° 1/',
      ) &&
      (await page.locator('#rtgLater[aria-disabled="true"]').count()) === 1,
  );
  if (middleBox) {
    await page.mouse.move(
      middleBox.x + middleBox.width / 2,
      middleBox.y + middleBox.height / 2,
    );
    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
  }
  await page.waitForTimeout(300);
  const upBox = await page.locator('#rtgLater').boundingBox();
  if (upBox) {
    await page.mouse.move(
      upBox.x + upBox.width / 2,
      upBox.y + upBox.height / 2,
    );
    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
  }
  await page.waitForTimeout(600);
  check(
    theme,
    'a long press on an arrow opens Paramétrages › Routages',
    await page.locator('#rtgShiftPrefs').isVisible(),
  );
  await page.locator('#rtgShiftPrefs [data-step="60"]').click();
  check(
    theme,
    'big buttons choose the step and the span of the sort, no ETA any more',
    (await page
      .locator('#rtgShiftPrefs [data-step="60"][aria-pressed="true"]')
      .count()) === 1 &&
      (await page.locator('#rtgShiftPrefs select').count()) === 0 &&
      (await page.locator('#rtgShiftPrefs [data-moves]').count()) === 0 &&
      (await page.locator('#rtgShiftPrefs [data-span="12"]').isVisible()),
  );
  await page.locator('#rtgShiftPrefs [data-step="30"]').click();
  await page.locator('#navBack').click();
  await page.waitForTimeout(600);
  check(
    theme,
    'and ◀ comes back to the routing on the map',
    await page.locator('#rtgBar').isVisible(),
  );
  check(
    theme,
    'Routes stays shown with a red cross on it',
    (await page.locator('#routesBtn.routing-on .routes-x').isVisible()) &&
      (await page.locator('#routesBtn.routing-on.menu-here').count()) === 0,
  );
  await page.locator('#routesBtn').click();
  await page.waitForTimeout(400);
  check(
    theme,
    'a tap on it leaves the routing, back to the map',
    (await page.locator('.rtm').count()) === 0 &&
      (await page.locator('#routesBtn.routing-on').count()) === 0 &&
      (await page.locator('#rtgBar').count()) === 0,
  );
  await showRow(page);
  await page.locator('#routesBtn').click();
  await page.waitForTimeout(400);
  check(
    theme,
    'and the routing is kept in Routages, named « Routage » with its date',
    (await page.locator('#rtgSaved [data-routing]').count()) > 0 &&
      /^Routage \d/u.test(
        (
          (await page
            .locator('#rtgSaved [data-routing] .b-nm')
            .first()
            .textContent()) ?? ''
        ).trim(),
      ) &&
      (
        (await page
          .locator('#rtgSaved [data-routing] small')
          .first()
          .textContent()) ?? ''
      ).includes('Route'),
  );
  check(
    theme,
    'big buttons, no dropdown, to choose the route, the boat and the model',
    (await page.locator('#rtgForm select').count()) === 0 &&
      (await page.locator('#rtgModel [aria-pressed="true"]').count()) === 1,
  );
  await page.locator('[data-part="draw"]').click();
  await page.unroute(/api\.open-meteo\.com\/v1\/forecast/);
  await page.unroute(/marine-api\.open-meteo\.com\/v1\/marine/);
}

/**
 * What Open-Meteo answers in the smoke test of the bulletin of the zone.
 * @param marine - The marine model.
 * @returns The answer.
 */
function bulletinAnswer(marine: boolean) {
  const start = Math.floor(Date.now() / 3_600_000) * 3_600_000 - 3_600_000;
  const time = Array.from({ length: 96 }, (_, hour) =>
    new Date(start + hour * 3_600_000).toISOString().slice(0, 16),
  );
  const series = (value: (hour: number) => number) =>
    time.map((_, hour) => value(hour));
  /* eslint-disable camelcase -- names in the API */
  const hourly = marine
    ? {
        time,
        wave_height: series(() => 1.2),
        wave_period: series(() => 8),
        wind_wave_height: series(() => 0.5),
        wind_wave_period: series(() => 3),
        wind_wave_direction: series(() => 250),
        swell_wave_height: series(() => 1),
        swell_wave_period: series(() => 11),
        swell_wave_direction: series(() => 280),
        wave_direction: series(() => 270),
      }
    : {
        time,
        wind_speed_10m: series((hour) => 10 + (hour % 12)),
        wind_direction_10m: series(() => 240),
        wind_gusts_10m: series((hour) => 16 + (hour % 12)),
        cape: series(() => 50),
        convective_inhibition: series(() => 0),
        pressure_msl: series((hour) => 1015 - hour / 10),
        precipitation: series((hour) => (hour % 10 === 0 ? 0.5 : 0)),
        temperature_2m: series(() => 11),
        dew_point_2m: series(() => 7),
      };

  return { utc_offset_seconds: 0, hourly };
  /* eslint-enable camelcase */
}

// Prévisions › Bulletin de la zone: Open-Meteo answered here, the five
// levels in order, every table with its units at the head and the foot,
// the official links of level 1, and no page wider than the screen.
async function zoneBulletinSmoke(page: Page, theme: string): Promise<void> {
  await page.route(
    /open-meteo\.com\/v1\/(?:forecast|marine)/,
    async (route) => {
      const url = new globalThis.URL(route.request().url());
      const places = (url.searchParams.get('latitude') ?? '').split(',').length;
      const one = bulletinAnswer(url.pathname.includes('marine'));
      await route.fulfill({
        json: places > 1 ? Array.from({ length: places }, () => one) : one,
      });
    },
  );
  await page.locator('.rail-weather').click();
  await page.waitForTimeout(400);
  await page.locator('[data-wx="forecast"]').click();
  await page
    .locator('[data-zb-level="5"]')
    .waitFor({ timeout: 15_000 })
    .catch(() => null);
  check(
    theme,
    'Bulletin de la zone: alerts, situation, wind, sea, weather, in that order',
    await page.evaluate(
      () =>
        [...document.querySelectorAll('.wx-bulletin [data-zb-level]')]
          .map((level) => (level as HTMLElement).dataset.zbLevel)
          .join('') === '12345',
    ),
  );
  check(
    theme,
    'Bulletin de la zone: every table has its units at the head and at the foot',
    await page.evaluate(() => {
      const tables = [...document.querySelectorAll('.wx-bulletin table')];
      return (
        tables.length >= 3 &&
        tables.every(
          (table) =>
            table.querySelector('thead')?.textContent ===
              table.querySelector('tfoot')?.textContent &&
            (table.querySelector('thead')?.textContent ?? '').includes('('),
        )
      );
    }),
  );
  check(
    theme,
    'Bulletin de la zone: the official bulletin is one tap away at level 1',
    (await page
      .locator(
        '[data-zb-level="1"] [data-site-link^="wx-bms"], [data-zb-level="1"] [data-site-link="wx-meteoswiss"]',
      )
      .count()) === 1,
  );
  check(
    theme,
    'Bulletin de la zone: the page is no wider than the screen',
    await page.evaluate(
      () =>
        (document.scrollingElement?.scrollWidth ?? 0) <=
        globalThis.innerWidth + 1,
    ),
  );
  await page.unroute(/open-meteo\.com\/v1\/(?:forecast|marine)/);
}

async function routeByHand(page: Page, theme: string): Promise<void> {
  await page.locator(NAVIN).click();
  await page.waitForTimeout(900);
  const kept = () =>
    page.evaluate(
      () =>
        (JSON.parse(localStorage.getItem('ldb.routes') ?? '[]') as unknown[])
          .length,
    );
  const before = await kept();
  await showRow(page);
  await page.locator('#routeNewBtn').click();
  await page.waitForTimeout(400);
  check(
    theme,
    'the route button opens its panel',
    await page.locator('.route-panel').isVisible(),
  );
  const map = await page.locator('.trk-map').boundingBox();
  if (!map) {
    check(theme, 'the map is shown for the route', false);
    return;
  }
  // Bare places of the map: not a mark, a port, a button or a bar.
  const spots = await page.evaluate(
    (box) => {
      const found: Array<{ x: number; y: number }> = [];
      for (let fy = 0.25; fy <= 0.6 && found.length < 3; fy += 0.05) {
        for (let fx = 0.25; fx <= 0.75 && found.length < 3; fx += 0.1) {
          const x = Math.round(box.x + box.width * fx);
          const y = Math.round(box.y + box.height * fy);
          const element = document.elementFromPoint(x, y);
          const far = found.every(
            (spot) => Math.hypot(spot.x - x, spot.y - y) > 80,
          );
          if (
            far &&
            element?.closest('.trk-map') &&
            !element.closest('.leaflet-marker-icon, .leaflet-control')
          ) {
            found.push({ x, y });
          }
        }
      }
      return found;
    },
    { x: map.x, y: map.y, width: map.width, height: map.height },
  );
  /* eslint-disable no-await-in-loop -- one tap after the other */
  for (const { x, y } of spots) {
    await page.mouse.click(x, y);
    await page.waitForTimeout(400);
  }
  /* eslint-enable no-await-in-loop */
  const laid = await page.locator('.route-pt').count();
  check(
    theme,
    `three taps lay three points of the route, and no cross (${spots.length} places, ${laid} points)`,
    laid === 3 && (await page.locator('.tap-cross').count()) === 0,
  );
  check(
    theme,
    'the panel gives the length and the time of the route',
    /3 points · [\d,]+ NM · \d+ h \d\d à 6,5 nd/.test(
      (await page.locator('.route-panel .rp-sum').textContent()) ?? '',
    ),
  );
  await page.locator('.route-panel [data-rp="list"]').click();
  await page.waitForTimeout(900);
  const after = await kept();
  check(theme, 'the route is kept', after === before + 1);
  check(
    theme,
    'the route is listed, the panel gone',
    (await page.locator('#rtList .rt-band').count()) === after &&
      (await page.locator('.route-panel').count()) === 0,
  );
  const last = await page.evaluate(() => {
    const view = document.querySelector('main#view');
    const buttons = [...(view?.querySelectorAll('button') ?? [])].filter(
      (button) => button.getBoundingClientRect().height > 0,
    );
    return buttons.at(-1)?.textContent ?? '';
  });
  check(
    theme,
    'Partager is the last button of Routes',
    last.toLowerCase().includes('partager'),
  );
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
/* eslint-disable no-await-in-loop -- one theme after the other */
for (const theme of ['day', 'night']) {
  const { context, page, errors } = await open(browser, theme);
  try {
    await follow(page, theme);
    await phoneTrack(page, theme);
    await recenter(page, theme);
    await bars(page, theme);
    await layers(page, theme);
    await search(page, theme);
    await buoyage(page, theme);
    await myMaps(page, theme);
    await crewCard(page, theme);
    await swipeMenu(page, theme);
    await crewAndBoat(page, theme);
    await boatPolar(page, theme);
    await marksShare(page, theme);
    await scalesSteady(page, theme);
    await alertsInTurn(page, theme);
    await layoutGaps(page, theme);
    await routeByHand(page, theme);
    await routingWeather(page, theme);
    await shomSection(page, theme);
    await zoneBulletinSmoke(page, theme);
  } catch (error) {
    check(theme, `no step blocks: ${String(error).slice(0, 700)}`, false);
  }
  check(theme, 'no error in the page', errors.length === 0);
  await context.close();
}
for (const theme of ['day', 'night']) {
  const { context, page, errors } = await open(browser, theme);
  try {
    await offlineFiles(page, theme);
    await routeAround(page, theme);
  } catch (error) {
    check(
      theme,
      `map files: no step blocks: ${String(error).slice(0, 700)}`,
      false,
    );
  }
  check(theme, 'map files: no error in the page', errors.length === 0);
  await context.close();
}
await turnPhone(browser);
for (const [theme, viewport] of [
  ['day', { width: 1280, height: 800 }],
  ['night', { width: 1280, height: 800 }],
  ['day', { width: 844, height: 390 }],
  ['night', { width: 844, height: 390 }],
] as const) {
  const { context, page, errors } = await open(browser, theme, viewport);
  try {
    await tablet(page, theme);
    await zones(page, theme);
    await trackButton(page, theme);
    if (viewport.width === 1280) await liveButtons(page, theme);
    if (viewport.width === 1280) await mapPlan(page, theme);
  } catch (error) {
    check(
      theme,
      `tablet: no step blocks: ${String(error).slice(0, 700)}`,
      false,
    );
  }
  check(theme, 'tablet: no error in the page', errors.length === 0);
  await context.close();
}
// The tablet held upright: the places of T, the sizes of X.
for (const theme of ['day', 'night']) {
  const { context, page, errors } = await open(browser, theme, {
    width: 800,
    height: 1280,
  });
  try {
    await bars(page, theme);
    // ＋ and − shown by the arrow go away first.
    await page.waitForTimeout(3500);
    const home = await tabletPlaces(page);
    await showRow(page);
    await page.locator('.top-tab.tab-data').click();
    await page.waitForTimeout(1100);
    const onData = await tabletPlaces(page);
    check(
      theme,
      `X upright: the same buttons at the same places on data${onData === home ? '' : ` (${home} / ${onData})`}`,
      onData === home,
    );
    await page.locator(NAVIN).click();
    await page.waitForTimeout(800);
    check(
      theme,
      'X upright: the buttons have the sizes of X',
      await page.evaluate(() => {
        const box = document
          .querySelector('.rail-boat')
          ?.getBoundingClientRect();
        return box?.width === 96 && box.height === 52;
      }),
    );
  } catch (error) {
    check(
      theme,
      `X upright: no step blocks: ${String(error).slice(0, 700)}`,
      false,
    );
  }
  check(theme, 'X upright: no error in the page', errors.length === 0);
  await context.close();
}
for (const theme of ['day', 'night']) {
  for (const [where, viewport] of [
    ['phone', PHONE],
    ['tablet', { width: 1280, height: 800 }],
  ] as const) {
    const { context, page, errors } = await open(
      browser,
      theme,
      viewport,
      true,
    );
    try {
      await tapCross(page, theme, where);
      await remarkPill(page, theme, where);
    } catch (error) {
      check(
        theme,
        `${where} 💬: no step blocks: ${String(error).slice(0, 700)}`,
        false,
      );
    }
    check(theme, `${where} 💬: no error in the page`, errors.length === 0);
    await context.close();
  }
}
/* eslint-enable no-await-in-loop */
await browser.close();
process.stdout.write(
  failures.length > 0 ? `\n${failures.length} FAILED\n` : '\nALL OK\n',
);
process.exitCode = failures.length > 0 ? 1 : 0;
