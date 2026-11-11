import { Button } from '../../components/shared/Button.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import type { ChecklistBase } from '../../model/types.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { state } from '../../state/index.ts';

import { useScreenLead } from './useScreenLead.ts';

/** Props of {@link PickBaseScreen}. */
interface PickBaseScreenProps {
  /** Receives the base chosen. */
  onPick: (base: ChecklistBase) => void;
  /** Back to the previous screen. */
  onBack: () => void;
}

/**
 * Choice of a base, to complete a list (legacy `renderPickBase`).
 * @param props - Callbacks.
 * @returns The screen.
 */
export function PickBaseScreen({ onPick, onBack }: PickBaseScreenProps) {
  const tr = useTr();
  useScreenLead('Choisir une base');
  return (
    <>
      <PageBack
        label="◀ La check-list"
        id="pbBack"
        onClick={() => {
          buzz();
          onBack();
        }}
      >
        {tr('◀ La check-list')}
      </PageBack>
      <h1>{tr('Choisir une base')}</h1>
      <div className="checks">
        {state.data.ckLib.value.map((base) => (
          <BaseButton
            key={base.id}
            base={base}
            idAttribute="data-pb"
            onClick={() => {
              buzz();
              onPick(base);
            }}
          />
        ))}
      </div>
    </>
  );
}

/** Props of {@link BaseButton}. */
interface BaseButtonProps {
  /** Base shown. */
  base: ChecklistBase;
  /** Opens or picks the base. */
  onClick: () => void;
  /**
   * Shown instead of the categories when there are none.
   * @default ''
   */
  noCategory?: string;
  /** Attribute carrying the id of the base. */
  idAttribute: 'data-pb' | 'data-from' | 'data-base';
}

/**
 * A `📚 name` button with the size and the categories of a base.
 * @param props - Base, action and data attribute.
 * @returns The button.
 */
export function BaseButton({
  base,
  noCategory = '',
  onClick,
  idAttribute,
}: BaseButtonProps) {
  const tr = useTr();
  const categories = (base.cats ?? []).join(', ') || noCategory;
  return (
    <Button {...{ [idAttribute]: base.id }} className="btn" onClick={onClick}>
      {tr(`📚 ${base.name}`)}
      <small>{tr(`${base.items.length} points · ${categories}`)}</small>
    </Button>
  );
}
