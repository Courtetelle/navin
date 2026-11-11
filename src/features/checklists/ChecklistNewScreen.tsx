import { useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { uid } from '../../lib/format.ts';
import type { ModeKey } from '../../model/modes.ts';
import type { ChecklistItem } from '../../model/types.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import { state, toast } from '../../state/index.ts';

import { CategoryPicker } from './CategoryPicker.tsx';
import { ChecklistInput } from './ChecklistInput.tsx';
import { BaseButton } from './PickBaseScreen.tsx';
import { baseItems, fromBaseItems } from './checklistEditing.ts';
import { ownerBoatId } from './checklistOwner.ts';
import { updateOwner } from './ownerUpdates.ts';
import { useScreenLead } from './useScreenLead.ts';

/** Props of {@link ChecklistNewScreen}. */
export interface ChecklistNewScreenProps {
  /** Boat asked for, `null` for the owner of the open cruise. */
  boatId: string | null;
  /** Mode of the list. */
  mode: ModeKey;
  /** Back to the previous screen. */
  onBack: () => void;
  /** Receives the id of the list created and whether it has items. */
  onCreated: (list: string, hasItems: boolean) => void;
}

/**
 * A new list, empty or from a base (legacy `renderCkNew`).
 * @param props - Owner and navigation.
 * @returns The screen.
 */
export function ChecklistNewScreen({
  boatId,
  mode,
  onBack,
  onCreated,
}: ChecklistNewScreenProps) {
  const tr = useTr();
  useNavFields();
  useScreenLead('Nouvelle check-list');
  const [categories, setCategories] = useState<readonly string[]>([]);
  const [pickerKey, setPickerKey] = useState(0);
  const nameField = useRef<HTMLInputElement>(null);
  const library = state.data.ckLib.value;
  const create = (
    name: string,
    listCategories: readonly string[],
    items: ChecklistItem[],
  ) => {
    const id = uid();
    updateOwner(boatId ?? ownerBoatId(), mode, (owner) => {
      owner.ckLists ??= [];
      owner.ckLists.push({ id, name, cats: [...listCategories] });
      owner[`ckx_${id}`] = items;
    });
    toast(`Liste « ${name} » créée`);
    onCreated(id, items.length > 0);
  };
  return (
    <>
      <PageBack
        label="◀ Check-lists"
        id="nlBack"
        onClick={() => {
          buzz();
          onBack();
        }}
      >
        {tr('◀ Check-lists')}
      </PageBack>
      <h1>{tr('Nouvelle check-list')}</h1>
      {library.length > 0 ? (
        <FoldSection title="À partir d’une base">
          <div className="checks">
            {library.map((base) => (
              <BaseButton
                key={base.id}
                base={base}
                idAttribute="data-from"
                onClick={() => {
                  buzz();
                  create(
                    base.name,
                    base.cats ?? [],
                    fromBaseItems(baseItems(base)),
                  );
                }}
              />
            ))}
          </div>
        </FoldSection>
      ) : null}
      <FoldSection title="Liste vide">
        <ChecklistInput
          fieldRef={nameField}
          className="text"
          id="nlName"
          placeholder={tr.placeholder('Nom, ex. Avitaillement')}
          autoComplete="off"
        />
        <CategoryPicker
          key={pickerKey}
          selected={categories}
          onChange={(selection) => {
            setCategories(selection);
            setPickerKey((key) => key + 1);
          }}
        />
        <ButtonRow>
          <Button
            className="btn big primary"
            id="nlCreate"
            onClick={() => {
              buzz();
              const name = (nameField.current?.value ?? '').trim();
              if (!name) {
                toast('Donnez un nom à la liste');
                nameField.current?.focus();
                return;
              }
              create(name, categories, []);
            }}
          >
            {tr('＋ Créer la liste')}
          </Button>
        </ButtonRow>
      </FoldSection>
    </>
  );
}
