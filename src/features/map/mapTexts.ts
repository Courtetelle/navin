import { effect } from '@preact/signals-react';
import type { Map as LeafletMap } from 'leaflet';

import { screenLanguage } from '../../i18n/langState.ts';
import type { Language } from '../../i18n/translate.ts';
import { translateOrKeep } from '../../i18n/translate.ts';
import { applyUiEditsIn } from '../../shell/uiEdit/domUiEdit.ts';

interface Translated {
  french: string;
  language: Language;
}

const HELP_ELEMENTS = '.help, small.rule, .exp-note, .fiche-lock';
const RESCAN_DELAY_MS = 40;

/**
 * Leaflet draws its popups, layer names and attribution outside React, so they
 * get here what the rest of the page gets from `tr` and `Button`: the language
 * of the screen, one text node at a time (nav.js:974-983), and the stored label
 * edits of their buttons. Lasts as long as the map.
 * @param map - The map.
 */
export function followMapTexts(map: LeafletMap): void {
  const box = map.getContainer();
  const translated = new WeakMap<Text, Translated>();
  const refresh = () => {
    applyUiEditsIn(box);
    translateTexts(box, screenLanguage.peek(), translated);
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(refresh, RESCAN_DELAY_MS);
  });
  observer.observe(box, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  const stopFollowing = effect(() => {
    translateTexts(box, screenLanguage.value, translated);
  });
  map.on('unload', () => {
    clearTimeout(timer);
    observer.disconnect();
    stopFollowing();
  });
}

function translateTexts(
  box: HTMLElement,
  language: Language,
  translated: WeakMap<Text, Translated>,
): void {
  const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    translateText(node as Text, language, translated);
  }
}

function translateText(
  node: Text,
  language: Language,
  translated: WeakMap<Text, Translated>,
): void {
  const parent = node.parentElement;
  if (!parent || parent.closest('textarea, script, style, input')) return;
  const done = translated.get(node);
  if (done?.language === language) return;
  if (done) {
    node.textContent = done.french;
    translated.delete(node);
  }
  if (language === 'fr') return;
  const french = node.textContent ?? '';
  const text = translateOrKeep(
    french,
    language,
    Boolean(parent.closest(HELP_ELEMENTS)),
  );
  if (text === french) return;
  translated.set(node, { french, language });
  node.textContent = text;
}
