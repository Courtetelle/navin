import type { CSSProperties, FocusEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { Button } from '../../components/shared/Button.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { PROCHES, intlPhone } from '../../lib/phone.ts';
import { MEMBER_FIELDS } from '../../model/crewFields.ts';
import { memberFieldsX } from '../../state/index.ts';
import { CompactForm } from '../logbook/index.ts';

import { packRelatives, shownRelatives } from './ficheRecord.ts';
import type { FicheRecord } from './useFicheRecord.ts';

/** Props of {@link FicheForm}. */
export interface FicheFormProps {
  /** The card. */
  record: FicheRecord;
}

const HIDDEN: CSSProperties = { display: 'none' };

/**
 * The fields of a card. The second and third relatives stay hidden while empty
 * and « ＋ Ajouter un proche » reveals them; a relative emptied disappears and
 * a phone is put in international format on leaving the field (lake.js:2210-2243).
 * @param props - The card.
 * @returns `div#fForm`.
 */
export function FicheForm({ record }: FicheFormProps) {
  const tr = useTr();
  const { data, change, persist, latest } = record;
  const [shown, setShown] = useState(() => shownRelatives(data));
  const shownCount = useRef(shown);
  const box = useRef<HTMLDivElement>(null);
  const show = (count: number) => {
    shownCount.current = count;
    setShown(count);
  };
  const cellStyle = (key: string) => {
    const relative = PROCHES.findIndex((keys) => keys.includes(key));
    return relative >= shown ? HIDDEN : undefined;
  };
  const afterCell = (key: string): ReactNode => {
    if (key !== PROCHES[shown - 1]?.[1]) return null;
    return (
      <div
        key="add-relative"
        className="cf wide"
        style={shown >= PROCHES.length ? HIDDEN : undefined}
      >
        <Button
          type="button"
          className="btn primary no-navact"
          id="fAddProche"
          onClick={(event) => {
            event.preventDefault();
            buzz();
            const count = Math.min(PROCHES.length, shownCount.current + 1);
            flushSync(() => show(count));
            const name = PROCHES[count - 1]?.[0] ?? '';
            box.current
              ?.querySelector<HTMLElement>(`[data-k="${CSS.escape(name)}"]`)
              ?.focus();
          }}
        >
          {tr('＋ Ajouter un proche')}
        </Button>
      </div>
    );
  };
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const input = event.target as HTMLElement & { value?: string };
    const field = MEMBER_FIELDS.find((item) => item.key === input.dataset.k);
    const typed = input.value?.trim();
    if (field?.phone && typed) {
      change({ ...latest(), [field.key]: intlPhone(input.value) });
      persist();
    }
    setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      const activeKey = active?.dataset?.k;
      if (activeKey && PROCHES.slice(1).flat().includes(activeKey)) return;
      const before = shownCount.current;
      const packed = packRelatives(latest());
      show(packed.shown);
      if (packed.shown < before || packed.changed) {
        change(packed.data);
        persist();
      }
    }, 0);
  };
  return (
    <div ref={box} id="fForm" onBlur={onBlur}>
      <CompactForm
        flat
        sections={[
          {
            fields: memberFieldsX().filter((field) => field.key !== 'sexe'),
          },
        ]}
        data={data}
        cellStyle={cellStyle}
        afterCell={afterCell}
        onChange={(next) => {
          change(next);
          persist();
        }}
      />
    </div>
  );
}
