import type { Scenario, Step } from '../types.ts';

/** No boot tip, and the remark pill away from the language button. */
const quiet = { 'ldb.tipIdx': '6', 'ldb.remPill': { x: 10, y: 300 } };
/** An address book and a crew list without the example cards. */
export const noCards = { ...quiet, 'ldb.members': '[]', 'ldb.crewSets': '[]' };
/** Nothing protects the cards. */
export const noCrews = { ...quiet, 'ldb.crewSets': '[]' };

/** The lazy page needs some time on the first visit. */
export function open(view: string): Step[] {
  return [{ go: view }, { wait: 1200 }];
}

/** Snapshot from the top of the page. */
export function shot(name: string): Step[] {
  return [{ eval: 'window.scrollTo(0, 0)' }, { snapshot: name }];
}

/**
 * Snapshot once the long texts stopped scrolling and the bubble is gone. The
 * harness captures the two apps one after the other, which can outlast a
 * bubble: its text is compared through an attribute read right after the action.
 */
export function settled(name: string): Step[] {
  return [
    {
      eval: "document.body.setAttribute('x-toast', document.querySelector('#toast').textContent)",
    },
    { wait: 3000 },
    ...shot(name),
  ];
}

/** Bring an element into the viewport, for the long presses. */
export function reveal(selector: string): Step {
  return { eval: `document.querySelector('${selector}').scrollIntoView()` };
}

/** Run a click without being blocked by the bubble that covers the button. */
export function tap(selector: string): Step {
  return { eval: `document.querySelector('${selector}').click()` };
}

/** Copy storage keys into compared attributes of `<body>`. */
export function stored(...keys: string[]): Step {
  const parts = keys.map(
    (key) =>
      `document.body.setAttribute('x-${key}', localStorage.getItem('${key}'))`,
  );
  return { eval: parts.join(';') };
}

/** Slide a row to the left, as a finger does. */
export function swipe(selector: string): Step {
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

/** Store two small pictures in the photo database of the phone. */
export const seedPhotos: Step = {
  eval: `new Promise((done, fail) => {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 160;
    const context = canvas.getContext('2d');
    context.fillStyle = '#4488aa';
    context.fillRect(0, 0, 120, 160);
    context.fillStyle = '#ffcc88';
    context.fillRect(30, 40, 60, 60);
    const url = canvas.toDataURL('image/jpeg', 0.8);
    const request = indexedDB.open('ldb-photos', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('p');
    request.onerror = fail;
    request.onsuccess = () => {
      const transaction = request.result.transaction('p', 'readwrite');
      transaction.objectStore('p').put(url, 'p1');
      transaction.objectStore('p').put(url, 'p2');
      transaction.oncomplete = () => {
        request.result.close();
        done();
      };
      transaction.onerror = fail;
    };
  })`,
};

/** A card with two photos, the first one framed; a composition with a photo. */
export const withPhotos = {
  ...quiet,
  'ldb.members': [
    {
      id: 'ph',
      prenom: 'Pia',
      nom: 'Photo',
      photos: [
        { id: 'p1', t: '2026-07-15T08:00:00.000Z' },
        { id: 'p2', t: '2026-07-15T08:05:00.000Z', cap: 'Portrait' },
      ],
      face: { id: 'p1', x: 0.5, y: 0.4, z: 2 },
    },
  ],
  'ldb.crewSets': [
    {
      id: 'cs1',
      ident: 'EQ001',
      name: 'Avec photo',
      crew: [{ memberId: 'ph', fonction: 'Skipper' }],
      photo: 'p2',
      photoCap: 'Au port',
    },
  ],
};

export function scenario(
  name: string,
  fixture: string,
  steps: Step[],
  overrides: Scenario['overrides'] = quiet,
): Scenario {
  return { name, fixture, overrides, steps };
}

export const received = [
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
export const receivedNew = [
  'NavIn · Crew member sheet',
  'First name : Ana',
  'Last name : Silva',
  'Man or woman (write M or W) : W',
  'Phone (with country code, e.g. +41) : 0041 79 222 33 44',
  'Identity card : X',
].join('\n');

export const publishButton = '#view .lx-pub button';
export const readSheet = '.lx-modal button:has-text("Charger la fiche reçue")';
