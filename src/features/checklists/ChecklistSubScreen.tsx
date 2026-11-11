import type { ModeKey } from '../../model/modes.ts';
import { boatById, toast } from '../../state/index.ts';

import { ChecklistEditScreen } from './ChecklistEditScreen.tsx';
import { ChecklistNewScreen } from './ChecklistNewScreen.tsx';
import { PickBaseScreen } from './PickBaseScreen.tsx';
import type { EditableItem } from './checklistEditing.ts';
import { baseItems, fromBaseItems } from './checklistEditing.ts';
import { checklistOwner, ckProp, ownerBoatId } from './checklistOwner.ts';
import { updateOwner } from './ownerUpdates.ts';
import type {
  ChecklistScreenState,
  EditScreenState,
} from './useChecklistScreens.ts';

/** Props of {@link ChecklistSubScreen}. */
interface ChecklistSubScreenProps {
  /** Editor, new list or choice of a base. */
  screen: Exclude<ChecklistScreenState, { kind: 'home' } | { kind: 'base' }>;
  /** Draws another sub-screen. */
  show: (screen: ChecklistScreenState) => void;
  /** Back to the list screen, on the given list. */
  showHome: (list?: string) => void;
}

/**
 * The screens shared by the `checklist` and `ckbases` pages.
 * @param props - Screen and navigation.
 * @returns The sub-screen.
 */
export function ChecklistSubScreen({
  screen,
  show,
  showHome,
}: ChecklistSubScreenProps) {
  if (screen.kind === 'edit') {
    return (
      <ChecklistEditScreen
        screen={screen}
        onEdit={show}
        onNewList={() =>
          show({ kind: 'new', boatId: screen.boatId, mode: screen.mode })
        }
        onPickBase={(edit) => show({ kind: 'pick', edit })}
        onDone={showHome}
      />
    );
  }
  if (screen.kind === 'new') {
    const { boatId, mode } = screen;
    return (
      <ChecklistNewScreen
        boatId={boatId}
        mode={mode}
        onBack={() => {
          if (boatId) show(editScreen(boatId, 'dep', mode));
          else showHome();
        }}
        onCreated={(list, hasItems) => {
          if (boatId) show(editScreen(boatId, list, mode));
          else if (hasItems) showHome(list);
          else show(editScreen(null, list, mode));
        }}
      />
    );
  }
  return (
    <PickBaseScreen
      onBack={() => show(screen.edit)}
      onPick={(base) => {
        addBaseItems(screen.edit, baseItems(base));
        toast(`${base.items.length} points ajoutés`);
        show(screen.edit);
      }}
    />
  );
}

function editScreen(
  boatId: string | null,
  list: string,
  mode: ModeKey,
): EditScreenState {
  return { kind: 'edit', boatId, list, mode };
}

function addBaseItems(
  { boatId, list, mode }: EditScreenState,
  items: readonly EditableItem[],
): void {
  const owner = boatId ? boatById(boatId) : checklistOwner();
  const property = ckProp(list, mode, owner);
  const added = fromBaseItems(items);
  updateOwner(boatId ?? ownerBoatId(), mode, (draft) => {
    draft[property] ??= [];
    (draft[property] as EditableItem[]).push(...added);
  });
}
