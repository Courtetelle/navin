import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { HelpText } from '../../components/shared/HelpText.tsx';
import { MarqueeInput } from '../../features/logbook/index.ts';
import { NATO, NATO_FR, NATO_KEYS } from '../../features/safety/nato.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { textOf } from '../../lib/format.ts';
import { keyedItems } from '../../lib/keyedItems.ts';
import { VIEW_LABELS } from '../../model/views.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import { go } from '../../shell/router.ts';
import { state, updateSettings } from '../../state/index.ts';

/**
 * Screen `alpha` (legacy `VIEWS.alpha`): the phonetic alphabet in big letters,
 * and the spelling of a word.
 * @returns The screen content.
 */
export function AlphaPage() {
  useSignals();
  useNavFields();
  const tr = useTr();
  const back = state.view.alphaBack.value;
  const [word, setWord] = useState(() => {
    const stored = state.preferences.settings.value.alphaWord;
    if (stored != null) return textOf(stored);
    return textOf(state.data.cruise.value?.info.boat);
  });
  return (
    <>
      <PageBack
        label={`◀ ${VIEW_LABELS[back] ?? 'Retour'}`}
        data-go={back}
        onClick={() => {
          buzz();
          go(back);
        }}
      >
        {tr(`◀ ${VIEW_LABELS[back] ?? 'Retour'}`)}
      </PageBack>
      <h1>{tr('Alphabet phonétique')}</h1>
      <label className="field alpha-spell">
        <span>{tr('Épeler un mot')}</span>
        <MarqueeInput
          id="alphaIn"
          defaultValue={word}
          placeholder={tr.placeholder('ex. nom du bateau, indicatif')}
          autoComplete="off"
          autoCapitalize="characters"
          onChange={(event) => {
            const { value } = event.target;
            setWord(value);
            updateSettings((settings) => {
              settings.alphaWord = value;
            });
          }}
        />
      </label>
      <div className="alpha-out" id="alphaOut">
        <SpelledWord word={word} />
      </div>
      <div className="alpha-grid">
        {NATO_KEYS.map((key) => (
          <div key={key} className="alpha-cell">
            <b>{key}</b>
            <span>{NATO[key]}</span>
            <small>{NATO_FR[key]}</small>
          </div>
        ))}
      </div>
      <HelpText>
        Prononciation : la syllabe en majuscules est accentuée. Le 9 se dit «
        Niner » pour ne pas le confondre avec « nein ».
      </HelpText>
    </>
  );
}

function SpelledWord({ word }: { word: string }) {
  const letters = word.toUpperCase().replaceAll(/[^A-Z0-9 ]/g, '');
  if (!letters.trim()) return null;
  return keyedItems(letters.split(''), String).map(({ key, item }) =>
    item === ' ' ? (
      <i key={key} className="sp" />
    ) : (
      <span key={key}>{NATO[item]}</span>
    ),
  );
}
