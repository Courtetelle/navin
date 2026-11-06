import { useRef, useState } from 'react';

import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { CategoryPicker } from '../../features/checklists/CategoryPicker.tsx';
import { ChecklistInput } from '../../features/checklists/ChecklistInput.tsx';
import { ItemsEditor } from '../../features/checklists/ItemsEditor.tsx';
import {
  addBaseToOuting,
  addPoint,
} from '../../features/checklists/checklistBases.ts';
import type { EditableItem } from '../../features/checklists/checklistEditing.ts';
import { baseItems } from '../../features/checklists/checklistEditing.ts';
import { useScreenLead } from '../../features/checklists/useScreenLead.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import type { ChecklistBase } from '../../model/types.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import { go } from '../../shell/router.ts';
import { state, toast, updateCkLib } from '../../state/index.ts';

/** Props of {@link BaseEditScreen}. */
export interface BaseEditScreenProps {
  /** The base edited. */
  base: ChecklistBase;
  /** Draws the screen again. */
  onRedraw: () => void;
  /** Back to the list of the bases. */
  onBack: () => void;
}

/**
 * Editor of a base: name, categories, points (legacy `renderBaseEdit`).
 * @param props - Base and navigation.
 * @returns The screen content.
 */
export function BaseEditScreen({
  base,
  onRedraw,
  onBack,
}: BaseEditScreenProps) {
  const tr = useTr();
  useNavFields();
  const [{ id, name }] = useState(() => base);
  useScreenLead(`📚 ${name}`);
  const [items] = useState(() => baseItems(base));
  const categories = base.cats ?? [];
  const newPoint = useRef<HTMLTextAreaElement>(null);
  const change = (recipe: (draft: ChecklistBase) => void) => {
    updateCkLib((library) => {
      const draft = library.find((item) => item.id === id);
      if (!draft) return;
      recipe(draft);
      draft.at = new Date().toISOString();
    });
  };
  const updateItems = (recipe: (stored: EditableItem[]) => void) => {
    change((draft) => {
      recipe(draft.items as EditableItem[]);
    });
  };
  return (
    <>
      <PageBack
        label="◀ Mes bases"
        id="beBack"
        onClick={() => {
          buzz();
          onBack();
        }}
      >
        {tr('◀ Mes bases')}
      </PageBack>
      <h1>{tr(`📚 ${name}`)}</h1>
      <FoldSection title="Nom et catégories">
        <ChecklistInput
          className="text"
          id="beName"
          defaultValue={name}
          autoComplete="off"
          onCommit={(field) => {
            const value = field.value.trim();
            if (!value) return;
            change((draft) => {
              draft.name = value;
            });
            toast('Nom enregistré');
          }}
        />
        <CategoryPicker
          selected={categories}
          onChange={(selection) => {
            change((draft) => {
              draft.cats = selection;
            });
            onRedraw();
          }}
        />
      </FoldSection>
      <ItemsEditor items={items} onUpdate={updateItems} onRedraw={onRedraw} />
      <FoldSection title="Nouveau point">
        <textarea
          ref={newPoint}
          className="text"
          id="ckNew"
          rows={2}
          placeholder={tr.placeholder('ex. Eau : 2 L par personne et par jour')}
        />
        <ButtonRow>
          <Button
            className="btn big primary"
            id="ckAdd"
            onClick={() => {
              buzz();
              addPoint(newPoint.current, updateItems, onRedraw);
            }}
          >
            {tr('＋ Ajouter ce point')}
          </Button>
        </ButtonRow>
      </FoldSection>
      <ButtonRow className="row c2">
        {state.data.cruise.value ? (
          <Button
            className="btn"
            id="beUse"
            onClick={() => {
              buzz();
              const current = state.data.ckLib.value.find(
                (item) => item.id === id,
              );
              if (current) go('checklist', addBaseToOuting(current));
            }}
          >
            {tr('✅ Ajouter aux check-lists de la sortie')}
          </Button>
        ) : null}
        <ArmedButton
          className="btn danger"
          id="beDel"
          armedLabel={tr('Toucher encore : effacer')}
          onClick={() => buzz()}
          onConfirm={() => {
            updateCkLib((library) => {
              const position = library.findIndex((item) => item.id === id);
              if (position !== -1) library.splice(position, 1);
            });
            toast('Base effacée');
            onBack();
          }}
        >
          {tr('🗑 Effacer cette base')}
        </ArmedButton>
      </ButtonRow>
    </>
  );
}
