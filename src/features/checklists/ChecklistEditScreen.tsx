import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { MODES, isCkBuiltin } from '../../model/modes.ts';
import { PageDone } from '../../shell/navbar/PageBack.tsx';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import { go } from '../../shell/router.ts';
import { boatById, toast } from '../../state/index.ts';

import { CategoryPicker } from './CategoryPicker.tsx';
import { EditTabs, EditTitle } from './ChecklistEditParts.tsx';
import { ChecklistInput } from './ChecklistInput.tsx';
import { ItemsEditor } from './ItemsEditor.tsx';
import { NewPointSection } from './NewPointSection.tsx';
import { saveAsBase } from './checklistBases.ts';
import type { EditableItem } from './checklistEditing.ts';
import type { ChecklistOwnerRecord } from './checklistOwner.ts';
import {
  checklistOwner,
  ckCats,
  ckDefs,
  ckName,
  ckProp,
  ownerBoatId,
  ownerItems,
} from './checklistOwner.ts';
import { updateOwner } from './ownerUpdates.ts';
import type { EditScreenState } from './useChecklistScreens.ts';

/** Props of {@link ChecklistEditScreen}. */
export interface ChecklistEditScreenProps {
  /** Boat, list and mode edited. */
  screen: EditScreenState;
  /** Draws another list of the editor. */
  onEdit: (screen: EditScreenState) => void;
  /** Opens the screen of a new list. */
  onNewList: () => void;
  /** Opens the choice of a base. */
  onPickBase: (screen: EditScreenState) => void;
  /** Back to the checklist of the given list. */
  onDone: (list: string) => void;
}

/**
 * Editor of the lists of a boat or a cruise: name, categories and points
 * (legacy `renderChecklistEdit`).
 * @param props - Screen and navigation.
 * @returns The screen, or nothing when the owner no longer exists.
 */
export function ChecklistEditScreen({
  screen,
  onEdit,
  onNewList,
  onPickBase,
  onDone,
}: ChecklistEditScreenProps) {
  const [owner] = useState(() => resolveOwner(screen.boatId));
  if (!owner) return null;
  return (
    <EditForm
      owner={owner}
      screen={screen}
      onEdit={onEdit}
      onNewList={onNewList}
      onPickBase={onPickBase}
      onDone={onDone}
    />
  );
}

function resolveOwner(boatId: string | null): ChecklistOwnerRecord | null {
  return boatId ? (boatById(boatId) ?? null) : checklistOwner();
}

interface EditFormProps extends ChecklistEditScreenProps {
  owner: ChecklistOwnerRecord;
}

function EditForm({
  owner,
  screen,
  onEdit,
  onNewList,
  onPickBase,
  onDone,
}: EditFormProps) {
  const tr = useTr();
  useNavFields();
  const { boatId, mode } = screen;
  const definitions = ckDefs(mode, owner);
  const list = definitions.some((slot) => slot[0] === screen.list)
    ? screen.list
    : 'dep';
  const current: EditScreenState = { ...screen, list };
  const property = ckProp(list, mode, owner);
  const ownerId = boatId ?? ownerBoatId();
  const boatName = ownerId ? (owner.info.boat ?? '') : null;
  const builtin = isCkBuiltin(list);
  const name = ckName(list, mode, owner);
  const categories = ckCats(list, mode, owner);
  const [items] = useState(() => ownerItems(owner, property));
  const update = (recipe: (draft: ChecklistOwnerRecord) => void) => {
    updateOwner(ownerId, mode, recipe);
  };
  const updateItems = (recipe: (items: EditableItem[]) => void) => {
    update((draft) => {
      draft[property] ??= [];
      recipe(draft[property] as EditableItem[]);
    });
  };
  const redraw = () => onEdit(current);
  const saveMeta = (newName: string, newCategories: readonly string[]) => {
    update((draft) => {
      const meta = { name: newName, cats: [...newCategories] };
      if (builtin) {
        draft.ckMeta ??= {};
        draft.ckMeta[mode] ??= {};
        (draft.ckMeta[mode] as Record<string, typeof meta>)[list] = meta;
        return;
      }
      const definition = draft.ckLists?.find((item) => item.id === list);
      if (definition) Object.assign(definition, meta);
    });
  };
  const help = `${
    ownerId
      ? `Listes du bateau ${boatName} : elles serviront à chaque sortie.`
      : 'Listes de cette croisière ; elles servent aussi de modèle pour les prochaines croisières en mer.'
  } Enregistrement automatique.`;
  return (
    <>
      <EditTitle
        subtitle={`${MODES[mode].icon} ${MODES[mode].name}${ownerId ? ` · ${boatName}` : ''}`}
      />
      <EditTabs
        definitions={definitions}
        list={list}
        onList={(id) => onEdit({ ...screen, list: id })}
        onNewList={onNewList}
      />
      <FoldSection title="Nom et catégories">
        <ChecklistInput
          className="text"
          id="ckName"
          defaultValue={name}
          placeholder={tr.placeholder('Nom de la liste')}
          autoComplete="off"
          onCommit={(field) => {
            const value = field.value.trim();
            if (!value) return;
            saveMeta(value, categories);
            toast('Nom enregistré');
          }}
        />
        <CategoryPicker
          selected={categories}
          onChange={(selection) => {
            saveMeta(ckName(list, mode, resolveOwner(boatId)), selection);
            redraw();
          }}
        />
        <ButtonRow className="row c2">
          <Button
            className="btn"
            id="ckSaveBase"
            onClick={() => {
              buzz();
              const live = resolveOwner(boatId);
              saveAsBase(
                ckName(list, mode, live),
                categories,
                ownerItems(live, property),
              );
            }}
          >
            {tr('💾 Enregistrer comme base')}
          </Button>
          {builtin ? null : (
            <HoldDeleteButton
              className="btn danger"
              id="ckDelList"
              onClick={() => buzz()}
              onDelete={() => {
                update((draft) => {
                  draft.ckLists = draft.ckLists?.filter(
                    (item) => item.id !== list,
                  );
                  Reflect.deleteProperty(draft, property);
                });
                toast('Liste supprimée');
                onEdit({ ...screen, list: 'dep' });
              }}
            >
              {tr('🗑 Supprimer la liste')}
            </HoldDeleteButton>
          )}
        </ButtonRow>
      </FoldSection>
      <HelpText>{help}</HelpText>
      <ItemsEditor items={items} onUpdate={updateItems} onRedraw={redraw} />
      <NewPointSection
        name={name}
        list={list}
        items={items}
        onUpdate={updateItems}
        onRedraw={redraw}
        onPickBase={() => onPickBase(current)}
      />
      <ButtonRow>
        <PageDone
          label="✔ Terminé"
          className="btn big"
          id="ckBack"
          onClick={() => {
            buzz();
            if (boatId) go('boats', boatId);
            else onDone(list);
          }}
        >
          {tr('✔ Terminé')}
        </PageDone>
      </ButtonRow>
    </>
  );
}
