import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { language, setLanguage } from '../../i18n/langState.ts';
import type { Language } from '../../i18n/translate.ts';
import { buzz } from '../../lib/dom.ts';

/** The languages offered, as written on their buttons. */
const LANGUAGES: ReadonlyArray<[Language, string]> = [
  ['fr', 'FR'],
  ['en', 'EN'],
  ['it', 'IT'],
  ['es', 'ES'],
];

/**
 * The language of the sheets (data, check-lists), chosen here only.
 * @returns The row.
 */
export function LangRow() {
  useSignals();
  const shown = language.value;
  return (
    <section className="field lang-set">
      <h3>🌐 Langue des fiches</h3>
      <ButtonRow className="row c4">
        {LANGUAGES.map(([code, name]) => (
          <Button
            key={code}
            className={shown === code ? 'btn on' : 'btn'}
            data-lang={code}
            aria-pressed={shown === code}
            onClick={() => {
              buzz();
              setLanguage(code);
            }}
          >
            {name}
          </Button>
        ))}
      </ButtonRow>
      <HelpText>
        Les fiches de data et les check-lists s’affichent dans cette langue.
      </HelpText>
    </section>
  );
}
