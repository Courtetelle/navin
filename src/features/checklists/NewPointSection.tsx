import { useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { uid } from '../../lib/format.ts';
import { relevesItems } from '../../model/checklistSeeds.ts';
import type { ChecklistItem } from '../../model/types.ts';
import { state, toast } from '../../state/index.ts';

import type { ItemsEditorProps } from './ItemsEditor.tsx';
import { addPoint } from './checklistBases.ts';

/** Props of {@link NewPointSection}. */
export interface NewPointSectionProps {
  /** Name of the list. */
  name: string;
  /** List id. */
  list: string;
  /** Items of the list. */
  items: readonly ChecklistItem[];
  /** Changes the stored items and saves them. */
  onUpdate: ItemsEditorProps['onUpdate'];
  /** Draws the screen again. */
  onRedraw: () => void;
  /** Opens the choice of a base. */
  onPickBase: () => void;
}

/**
 * The section adding a point, the readings or the points of a base to a list.
 * @param props - List and callbacks.
 * @returns The section.
 */
export function NewPointSection({
  name,
  list,
  items,
  onUpdate,
  onRedraw,
  onPickBase,
}: NewPointSectionProps) {
  const tr = useTr();
  const field = useRef<HTMLTextAreaElement>(null);
  const noReadings = !items.some(
    (item) => item.action === 'releves' || item.key,
  );
  return (
    <FoldSection title={`Nouveau point · ${name}`}>
      <textarea
        ref={field}
        className="text"
        id="ckNew"
        rows={2}
        placeholder={tr.placeholder('ex. Fermer la vanne des WC')}
      />
      <ButtonRow>
        <Button
          className="btn big primary"
          id="ckAdd"
          onClick={() => {
            buzz();
            addPoint(field.current, onUpdate, onRedraw);
          }}
        >
          {tr('＋ Ajouter ce point')}
        </Button>
      </ButtonRow>
      {list === 'dep' && noReadings ? (
        <ButtonRow>
          <Button
            className="btn"
            id="ckRel"
            onClick={() => {
              buzz();
              onUpdate((stored) => {
                stored.unshift(...relevesItems(`${uid()}-`));
              });
              toast('Points ajoutés en tête');
              onRedraw();
            }}
          >
            {tr(
              '＋ Points « relevés » : heures moteur, carburant, batteries, eau',
            )}
          </Button>
        </ButtonRow>
      ) : null}
      {state.data.ckLib.value.length > 0 ? (
        <ButtonRow>
          <Button
            className="btn"
            id="ckFromBase"
            onClick={() => {
              buzz();
              onPickBase();
            }}
          >
            {tr('＋ Ajouter les points d’une base')}
          </Button>
        </ButtonRow>
      ) : null}
    </FoldSection>
  );
}
