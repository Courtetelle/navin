import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useRef } from 'react';

import { buzz } from '../lib/dom.ts';
import { toast } from '../state/index.ts';

import {
  language,
  nextSecondLanguage,
  secondLanguage,
  toggleLanguage,
  translatable,
} from './langState.ts';
import { LANGUAGE_NAMES } from './translate.ts';

/**
 * The round language button (`button.lang-fab`, nav.js:945-1000), shown on
 * translatable screens: a tap switches FR ⇄ the other language, a long press
 * (650 ms) picks the next one (EN → IT → ES).
 * @returns The button.
 */
export function LangFab() {
  useSignals();
  const shown = language.value;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPress = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);
  const cancel = () => clearTimeout(timer.current);
  return (
    <button
      type="button"
      className={`lang-fab no-print lf-${shown}`}
      hidden={!translatable.value}
      aria-label="Langue : appui court FR ⇄ autre langue, appui long langue suivante"
      data-l2={secondLanguage.value}
      onPointerDown={() => {
        longPress.current = false;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          longPress.current = true;
          buzz();
          const next = nextSecondLanguage();
          toast(`FR ⇄ ${LANGUAGE_NAMES[next]}`);
        }, 650);
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onContextMenu={(event) => event.preventDefault()}
      onClick={(event) => {
        event.stopPropagation();
        if (longPress.current) {
          longPress.current = false;
          return;
        }
        buzz();
        toggleLanguage();
      }}
    >
      <span>{shown === 'fr' ? 'FR' : LANGUAGE_NAMES[shown]}</span>
    </button>
  );
}
