/*
 * Drives the built app in Chrome, by day and by night, through what must keep
 * working: map, bars, position button, search, buoyage, my maps, tracks.
 * Nothing leaves the machine: map servers are answered with nothing.
 *
 *   npm run build && npm run smoke
 */

import path from 'node:path';

import type { Browser, BrowserContext, Page } from 'playwright-core';
import { chromium } from 'playwright-core';

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
  const page = await context.newPage();
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

// data and the settings wait in the row NavIn unrolls (X and T): NavIn is
// touched until they show (away from the map, it first brings the map).
async function showRow(page: Page): Promise<void> {
  /* eslint-disable no-await-in-loop -- one touch after the other */
  for (let touch = 0; touch < 3; touch++) {
    if (await page.locator('#gearBtn').isVisible()) return;
    await page.locator(NAVIN).click();
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
    if (!(await page.locator('.top-tab.tab-data').isVisible())) {
      await showRow(page);
    }
    await page.locator('.top-tab.tab-data').click();
    await page.waitForTimeout(300);
  }
  /* eslint-enable no-await-in-loop */
}

const bodyHas = (page: Page, name: string) =>
  page.evaluate(
    (className) => document.body.classList.contains(className),
    name,
  );

async function bars(page: Page, theme: string): Promise<void> {
  check(
    theme,
    'the figures of the track folded without a recording',
    await bodyHas(page, 'bot-hidden'),
  );
  await page.locator('#hBot').click();
  check(theme, 'their handle opens them', !(await bodyHas(page, 'bot-hidden')));
  await page.locator('.bar-chevron-bottom').click();
  check(theme, 'their chevron folds them', await bodyHas(page, 'bot-hidden'));
  check(
    theme,
    'T upright: the top row, clock, arrow, START, mark, dividers',
    await page.evaluate(() => {
      // eslint-disable-next-line unicorn/consistent-function-scoping -- runs in the page
      const top = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect().top ?? -1;
      const row = [
        '#clock',
        '.rail-boat',
        '.rail-start',
        '.rail-pin',
        '.rail-ruler',
      ].map(top);
      return row.every((y) => y >= 0 && y < 60);
    }),
  );
  check(
    theme,
    'T upright: the bottom row, magnifier, NavIn, photo, SOS',
    await page.evaluate(() => {
      // eslint-disable-next-line unicorn/consistent-function-scoping -- runs in the page
      const bottom = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect().bottom ?? -1;
      const row = [
        '#searchBtn',
        '.top-tab[data-view="tracker"]',
        '.rail-photo',
        '.top-tab.tab-sos',
      ].map(bottom);
      return row.every((y) => y > globalThis.innerHeight - 60);
    }),
  );
  await page.locator('.rail-boat').click();
  await page.waitForTimeout(300);
  check(
    theme,
    'T upright: ＋ and − one under the other under the arrow, full size',
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
        plus.top >= arrow.bottom &&
        minus.top >= plus.bottom &&
        Math.abs(plus.left - minus.left) < 2 &&
        plus.height >= arrow.height - 2
      );
    }),
  );
  await page.locator(NAVIN).click();
  await page.waitForTimeout(400);
  check(
    theme,
    'T upright: NavIn unrolls its menus in a column above it',
    await page.evaluate(() => {
      // eslint-disable-next-line unicorn/consistent-function-scoping -- runs in the page
      const box = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect();
      const column = [
        '.top-tab[data-view="tracker"]',
        '.navin-row .rail-prep',
        '.top-tab.tab-data',
        '#gearBtn',
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
          (item.bottom <= below.top + 1 && Math.abs(item.left - first.left) < 6)
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
  const title = (await page.locator('main h1').first().textContent()) ?? '';
  check(theme, 'data leads to my maps', title.includes('Mes cartes'));
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
  const box = await page.locator('#navSearch').boundingBox();
  const back = await page.locator('#navBack').boundingBox();
  const exit = await page.locator('#navExit').boundingBox();
  check(
    theme,
    'the magnifier sits in the nav bar, between ◀ and Sortir',
    box !== null &&
      back !== null &&
      exit !== null &&
      box.x >= back.x + back.width &&
      box.x + box.width <= exit.x &&
      Math.abs(box.y + box.height / 2 - (back.y + back.height / 2)) < 6,
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
  await page.locator('#view details.section > summary').click();
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
    'swiping left opens the menu: view, share, delete',
    (await page.locator('.sw-menu').isVisible()) &&
      (await page.locator('.sw-menu [data-swview]').count()) === 1 &&
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
 * The next zone of navigation, from the settings (the long press on NavIn is
 * night and day on the tablet), then back to the map.
 * @param page - The tablet page.
 */
async function nextZoneX(page: Page): Promise<void> {
  if (!(await page.locator('#gearBtn').isVisible())) {
    await page.locator(NAVIN).click();
    await page.waitForTimeout(400);
  }
  await openGear(page);
  await page.waitForTimeout(500);
  const section = page.locator('details[data-sec="zone"]');
  if (!(await section.evaluate((one) => (one as HTMLDetailsElement).open))) {
    await section.locator('summary').click();
    await page.waitForTimeout(300);
  }
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
  await longPress(page, NAVIN);
  const after = await night();
  await longPress(page, NAVIN);
  check(
    theme,
    'tablet: a long press on NavIn turns night and day',
    before !== after && (await night()) === before,
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
    !(await zoneChosen(page)),
  );
}

async function tablet(page: Page, theme: string): Promise<void> {
  const home = await tabletPlaces(page);
  check(theme, 'tablet: every side button is shown', !home.includes('absent'));
  check(
    theme,
    'tablet: data and the settings wait in the row of NavIn',
    !(await page.locator('.top-tab.tab-data').isVisible()) &&
      !(await page.locator('#gearBtn').isVisible()),
  );
  await page.locator(NAVIN).click();
  await page.waitForTimeout(400);
  check(
    theme,
    'tablet: a touch on NavIn unrolls PréP, data, settings and phone',
    (await page.locator('.navin-row .rail-prep').isVisible()) &&
      (await page.locator('.top-tab.tab-data').isVisible()) &&
      (await page.locator('#gearBtn').isVisible()) &&
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
    'tablet: ＋ goes away after 3 s',
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
    await page.locator(opener).click();
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
  await page.touchscreen.tap(x, Math.round(map.y + map.height - 60));
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
    'tablet: during a track the row of NavIn starts with Météo',
    (await page.locator('.navin-row .rail-btn[aria-label="Météo"]').count()) ===
      1 && (await page.locator('.navin-row .rail-prep').count()) === 0,
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
  const page = await context.newPage();
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
