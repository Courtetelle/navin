import { computed, signal } from '@preact/signals-react';

import { litTab } from '../shell/litTab.ts';
import { state } from '../state/index.ts';

import type { Language, OtherLanguage } from './translate.ts';

const OTHERS: readonly OtherLanguage[] = ['en', 'it', 'es'];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function initialSecond(): OtherLanguage {
  const stored = read('ldb.lang2');
  return OTHERS.find((language) => language === stored) ?? 'en';
}

/** The other language of the FR ⇄ button (`ldb.lang2`). */
export const secondLanguage = signal<OtherLanguage>(initialSecond());

/** Language shown (`ldb.lang`, French unless it equals the other language). */
export const language = signal<Language>(
  read('ldb.lang') === secondLanguage.value ? secondLanguage.value : 'fr',
);

/** Number of mounted screens showing a sheet grid (`.cgrid`, nav.js:984). */
export const sheetOwners = signal(0);

/**
 * Whether the screen is translatable and the language button shows
 * (nav.js:984 `hasFiche`): a sheet grid on screen, a data screen (data tab
 * lit), or the check-lists.
 */
export const translatable = computed(
  () =>
    sheetOwners.value > 0 ||
    litTab() === 'more' ||
    state.view.currentView.value === 'checklist',
);

/**
 * Language used for the screen texts now: the language shown when the screen
 * is translatable, French otherwise.
 */
export const screenLanguage = computed<Language>(() =>
  translatable.value ? language.value : 'fr',
);

/** Short tap on the language button: FR ⇄ the other language (nav.js:999). */
export function toggleLanguage(): void {
  language.value = language.value === 'fr' ? secondLanguage.value : 'fr';
  saveLanguages();
}

/**
 * Long press: next other language (EN → IT → ES), shown at once unless French
 * is shown (nav.js:993-995).
 * @returns The new other language.
 */
export function nextSecondLanguage(): OtherLanguage {
  const next =
    OTHERS[(OTHERS.indexOf(secondLanguage.value) + 1) % OTHERS.length] ?? 'en';
  const was = language.value;
  secondLanguage.value = next;
  if (was !== 'fr') language.value = next;
  saveLanguages();
  return next;
}

function saveLanguages(): void {
  try {
    localStorage.setItem('ldb.lang', language.value);
    localStorage.setItem('ldb.lang2', secondLanguage.value);
  } catch {
    // Storage blocked: the choice lasts until the page is closed.
  }
}
