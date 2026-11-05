import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Fixture, Step } from '../types.ts';

export const QUIET = { 'ldb.tipIdx': '6' };
export const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';
const PDF = 'data:application/pdf;base64,JVBERi0xLjQK';

export function fixture(name: string): Fixture {
  const path = join(import.meta.dirname, '..', 'fixtures', `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as Fixture;
}

interface BoatRecord {
  id: string;
  [key: string]: unknown;
}

export function boatsWith(
  name: string,
  changes: Record<string, Record<string, unknown>>,
): BoatRecord[] {
  const boats = fixture(name)['ldb.boats'] as BoatRecord[];
  return boats.map((boat) => ({ ...boat, ...changes[boat.id] }));
}

export function cruiseWith(
  name: string,
  id: string,
  change: (cruise: Record<string, unknown>) => void,
): Fixture {
  const key = `ldb.cruise.${id}`;
  const cruise = structuredClone(fixture(name)[key]) as Record<string, unknown>;
  change(cruise);
  return { [key]: cruise };
}

export const LAKE_ID = 'mrltkr40tkny6';

/** Store photos in IndexedDB, in both apps. */
export const seedPhotos: Step = {
  eval: `new Promise((done) => {
    const request = indexedDB.open('ldb-photos', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('p');
    request.onsuccess = () => {
      const transaction = request.result.transaction('p', 'readwrite');
      const store = transaction.objectStore('p');
      store.put(${JSON.stringify(PIXEL)}, 'doc1');
      store.put(${JSON.stringify(PIXEL)}, 'doc2');
      store.put(${JSON.stringify(PDF)}, 'scan1');
      transaction.oncomplete = () => { request.result.close(); done(1); };
    };
  })`,
};

/** Show stored data in the DOM, so that a snapshot compares what was written. */
export function dump(...keys: string[]): Step {
  return {
    eval: `(() => {
      let node = document.getElementById('parity-dump');
      if (!node) {
        node = document.createElement('pre');
        node.id = 'parity-dump';
        node.hidden = true;
        document.body.append(node);
      }
      node.textContent = ${JSON.stringify(keys)}
        .map((key) => key + ' = ' + localStorage.getItem(key)).join(' | ');
    })()`,
  };
}

export const stubPrint: Step = { eval: 'window.print = () => undefined' };

/** Keep the blobs handed to the browser, to compare the files produced. */
export const catchBlobs: Step = {
  eval: `(() => {
    navigator.canShare = () => false;
    window.parityBlobs = [];
    const create = URL.createObjectURL;
    URL.createObjectURL = (blob) => {
      window.parityBlobs.push(blob);
      return create.call(URL, blob);
    };
  })()`,
};

/** Show the size and digest of the last file produced in the DOM. */
export const dumpBlob: Step = {
  eval: `(async () => {
    const blob = window.parityBlobs.at(-1);
    const bytes = await blob.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hex = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0')).join('');
    let node = document.getElementById('parity-blob');
    if (!node) {
      node = document.createElement('pre');
      node.id = 'parity-blob';
      node.hidden = true;
      document.body.append(node);
    }
    node.textContent = blob.type + ' ' + blob.size + ' ' + hex;
  })()`,
};

/** Slide a boat to the left with a finger. */
export function swipe(selector: string): Step {
  return {
    eval: `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      const box = element.getBoundingClientRect();
      const y = box.top + box.height / 2;
      const x = box.right - 40;
      const fire = (type, clientX) => element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true, cancelable: true, clientX, clientY: y,
          pointerId: 1, pointerType: 'touch', isPrimary: true,
        }),
      );
      fire('pointerdown', x);
      fire('pointermove', x - 30);
      fire('pointermove', x - 120);
      fire('pointerup', x - 120);
    })()`,
  };
}

export const docsBoat = {
  thumb: 'doc1',
  docs: [
    { id: 'doc1', kind: 'permis', t: '2026-07-01T08:00:00.000Z' },
    {
      id: 'doc2',
      kind: 'assurance',
      t: '2026-07-02T08:00:00.000Z',
      cap: 'Police 2026',
    },
    {
      id: 'scan1',
      kind: 'autre',
      t: '2026-07-03T08:00:00.000Z',
      pdf: true,
      cap: 'Scan permis',
    },
    { id: 'gone', kind: 'fiche', t: '2026-07-04T08:00:00.000Z' },
  ],
};

export const versionBoat = {
  hist: [
    {
      at: '2026-07-10T08:00:00.000Z',
      from: 'Avant modification',
      info: { boat: 'Savannah I', model: 'Hanse 315', year: '2013' },
    },
    {
      at: '2026-07-09T08:00:00.000Z',
      from: 'Sortie du 09.07',
      info: {},
    },
  ],
};

export const BOOT: Step = { wait: 2000 };
export const FIRST_LOAD: Step = { wait: 2500 };
/** Wait until the toast of an action is gone. */
export const TOAST_GONE: Step = { wait: 3000 };
