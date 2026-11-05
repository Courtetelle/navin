import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Fixture, Scenario, Step } from '../types.ts';

/** Skip the boot tip toast. */
export const QUIET = { 'ldb.tipIdx': '6' };

/**
 * Open the Publier window from code in both apps, whatever the state of the
 * page below it.
 * @param kind - List kind.
 * @param only - Id of the only element kept checked.
 * @returns The step.
 */
export function openWindow(kind: string, only?: string): Step {
  const args = only ? `'${kind}', '${only}'` : `'${kind}'`;
  return {
    eval: `window.lxOpen ? window.lxOpen(${args}) : import('/src/features/publish/index.ts').then((publish) => publish.openListPublish(${args}))`,
  };
}

/** Expression writing the digests of a set of image cards on `<body>`. */
export const CARD_DIGESTS = String.raw`(async () => {
  const cardsPng = window.cardsPng ?? (await import('/src/features/publish/cardsPng.ts')).cardsPng;
  const picture = (width, height, color) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = color;
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#ffffff';
    context.fillRect(width / 4, height / 4, width / 2, height / 2);
    return canvas.toDataURL('image/png');
  };
  const long = 'Une valeur assez longue pour passer à la ligne au moins une fois dans la colonne de droite';
  const sections = () => [
    { title: 'Informations générales de ce bateau avec un titre très long qui ne tient pas sur une ligne', rows: [['Nom', 'Mistral'], ['Une étiquette vraiment très longue pour la colonne de gauche', long], ['Lignes', 'un\ndeux\ntrois']] },
    { title: '', rows: [['', 'Sans titre ni étiquette']] },
    { title: 'Photos de ligne', rows: [['Point', 'avec photos', [{ url: picture(600, 300, '#336699') }, { url: picture(200, 900, '#993366') }]], ['Sans', 'rien']] },
  ];
  const variants = () => [
    { title: 'Mistral', kicker: 'Fiche bateau', sub: 'Fiche bateau · 15/07/2026', sections: sections() },
    { title: 'Un titre très long qui doit passer à la ligne dans toutes les mises en page disponibles', sub: '', sections: sections(), avatar: picture(320, 320, '#117733') },
    { title: 'Avec vignette et photos', kicker: 'Fiche', sub: 'Sous-titre', sections: sections(), avatar: picture(480, 320, '#aa4400'), avatarRect: true, photosTitle: 'Documents', photos: [{ url: picture(1600, 900, '#222222'), cap: 'Légende sur fond sombre' }, { url: picture(900, 1600, '#eeeeee'), cap: 'Légende sur fond clair, assez longue pour passer à la ligne sur la photo portrait' }] },
    { title: 'Sans rien' },
  ];
  const digests = [];
  for (const theme of [undefined, 'cards', 'carnet', 'mini']) {
    for (const variant of variants()) {
      const blob = await cardsPng({ ...variant, theme });
      const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      digests.push([...new Uint8Array(hash).slice(0, 6)].map((byte) => byte.toString(16).padStart(2, '0')).join('') + ':' + blob.size);
    }
  }
  document.body.setAttribute('card-digests', digests.join(' '));
})()`;

/**
 * Replace the file delivery and the print dialog: every file sent is written
 * on `<body>` with its name, size and digest.
 */
export const CAPTURE_SENDS: Step = {
  eval: `(() => {
    const sent = [];
    Object.defineProperty(navigator, 'canShare', { value: undefined });
    window.print = () => document.body.setAttribute('print-title', document.title);
    HTMLAnchorElement.prototype.click = function capture() {
      const name = this.download;
      fetch(this.href).then((response) => response.arrayBuffer()).then(async (buffer) => {
        const hash = await crypto.subtle.digest('SHA-256', buffer);
        const digest = [...new Uint8Array(hash).slice(0, 6)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
        sent.push(name + ':' + buffer.byteLength + ':' + digest);
        document.body.setAttribute('sent-files', sent.join(' '));
      });
    };
  })()`,
};

/** Cruise of the sample fixtures. */
export const TRACK_CRUISE = 'mrltkr40tkny6';
const TRACK_START = Date.UTC(2026, 6, 15, 6, 40);
/** A recorded track of four points. */
export const TRACK = [
  [TRACK_START, 46.45, 6.6],
  [TRACK_START + 600_000, 46.46, 6.62],
  [TRACK_START + 1_200_000, 46.48, 6.63],
  [TRACK_START + 1_800_000, 46.49, 6.61],
];

/** Expression storing two pictures in the photo store of each app. */
const STORE_PHOTOS = `(async () => {
  const put = typeof putPhoto === 'function' ? putPhoto : (await import('/src/storage/photos.ts')).putPhoto;
  const picture = (width, height, color) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = color;
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#ffee88';
    context.fillRect(width / 3, height / 3, width / 3, height / 3);
    return canvas.toDataURL('image/jpeg', 0.8);
  };
  await put('ph-a', picture(800, 600, '#225588'));
  await put('ph-b', picture(600, 800, '#eeeeee'));
  await put('ph-c', picture(640, 480, '#884422'));
})()`;

/**
 * The rich fixture, with photos on two members and documents on two boats.
 * @returns The fixture.
 */
export function photoFixture(): Fixture {
  const path = join(import.meta.dirname, '../fixtures/sample-lake.json');
  const fixture = JSON.parse(readFileSync(path, 'utf8')) as Fixture;
  const members = fixture['ldb.members'] as Array<Record<string, unknown>>;
  const boats = fixture['ldb.boats'] as Array<Record<string, unknown>>;
  const at = '2026-07-01T08:00:00.000Z';
  for (const member of members) {
    if (member.id === 'ex1') {
      member.photos = [
        { id: 'ph-a', t: at, cap: 'Au port' },
        { id: 'ph-b', t: at },
      ];
    } else if (member.id === 'ex2') {
      member.photos = [{ id: 'ph-c', t: at }];
    }
  }
  for (const boat of boats) {
    if (boat.id === 'exb1') {
      boat.thumb = 'ph-a';
      boat.docs = [
        { id: 'ph-a', kind: 'photo', t: at, cap: 'De face' },
        { id: 'ph-b', kind: 'photo', t: at },
      ];
    } else if (boat.id === 'exb2') {
      boat.docs = [{ id: 'ph-c', kind: 'photo', t: at }];
    } else if (boat.id === 'exb3') {
      boat.docs = [
        { id: 'scan', kind: 'papers', t: at, pdf: true, cap: 'Permis' },
      ];
    }
  }
  return fixture;
}

/**
 * A scenario of the Publier window of a list, over a static screen.
 * @param kind - List kind.
 * @param steps - Steps after the window opened.
 * @param options - Scenario name suffix, fixture, overrides.
 * @param options.suffix - Added to the scenario name.
 * @param options.fixture - Fixture name.
 * @param options.overrides - localStorage overrides.
 * @param options.only - Id of the only element kept checked.
 * @param options.photos - Store the sample photos first.
 * @returns The scenario.
 */
export function windowScenario(
  kind: string,
  steps: Step[],
  {
    suffix = '',
    fixture = 'sample-lake',
    overrides = {},
    only,
    photos = false,
  }: {
    suffix?: string;
    fixture?: Fixture | string;
    overrides?: Record<string, unknown>;
    only?: string;
    photos?: boolean;
  } = {},
): Scenario {
  return {
    name: `publish-${kind}-window${suffix}`,
    fixture,
    overrides: { ...QUIET, ...overrides },
    settle: 250,
    steps: [
      { go: 'beaufort' },
      { wait: 1000 },
      CAPTURE_SENDS,
      ...(photos ? [{ eval: STORE_PHOTOS }] : []),
      openWindow(kind, only),
      ...steps,
    ],
  };
}

/**
 * A scenario of a real list page: its Publier row, then its window.
 * @param view - Screen.
 * @param steps - Steps once on the screen.
 * @param overrides - localStorage overrides.
 * @param arg - Argument of the screen.
 * @returns The scenario.
 */
export function pageScenario(
  view: string,
  steps: Step[],
  overrides: Record<string, unknown> = {},
  arg?: unknown,
): Scenario {
  return {
    name: `publish-page-${view}`,
    fixture: 'sample-lake',
    overrides: { ...QUIET, ...overrides },
    settle: 300,
    steps: [{ go: view, arg }, { wait: 1200 }, ...steps],
  };
}

/** Check the Publier row of a list, then open its window. */
export const ROW_STEPS: Step[] = [
  { snapshot: 'row' },
  { click: '.lx-pub button' },
  { snapshot: 'window' },
];
