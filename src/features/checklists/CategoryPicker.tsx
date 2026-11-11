import { useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { allCkCats, toast } from '../../state/index.ts';

import { ChecklistInput } from './ChecklistInput.tsx';

/** Props of {@link CategoryPicker}. */
interface CategoryPickerProps {
  /** Categories chosen. */
  selected: readonly string[];
  /** Receives the new selection. */
  onChange: (categories: string[]) => void;
}

/**
 * Choice of several categories, with a free one (legacy `catPickerHtml` and
 * `catPickerClick`).
 * @param props - Selection and its callback.
 * @returns The chips and the row of the free category.
 */
export function CategoryPicker({ selected, onChange }: CategoryPickerProps) {
  const tr = useTr();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <div className="chips ck-catpick">
        {allCkCats(selected).map((category) => (
          <Button
            key={category}
            choice
            className={selected.includes(category) ? 'btn on' : 'btn'}
            data-pcat={category}
            onClick={() => {
              buzz();
              onChange(
                selected.includes(category)
                  ? selected.filter((item) => item !== category)
                  : [...selected, category],
              );
            }}
          >
            {tr(category)}
          </Button>
        ))}
      </div>
      <div className="row c2">
        <ChecklistInput
          fieldRef={input}
          className="text"
          id="catNew"
          placeholder={tr.placeholder('Autre catégorie')}
          autoComplete="off"
        />
        <Button
          className="btn"
          id="catAdd"
          onClick={() => {
            buzz();
            const category = (input.current?.value ?? '').trim();
            if (!category) {
              toast('Écrivez la catégorie');
              return;
            }
            onChange(
              selected.includes(category)
                ? [...selected]
                : [...selected, category],
            );
          }}
        >
          {tr('＋ Catégorie')}
        </Button>
      </div>
    </>
  );
}
