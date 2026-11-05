import { useState } from 'react';

import { ChecklistSubScreen } from '../../features/checklists/ChecklistSubScreen.tsx';
import {
  checklistUi,
  selectChecklist,
} from '../../features/checklists/checklistUi.ts';
import {
  photosFor,
  removePhoto,
} from '../../features/checklists/neighbours.ts';
import type { ChecklistScreenState } from '../../features/checklists/useChecklistScreens.ts';
import { useChecklistScreens } from '../../features/checklists/useChecklistScreens.ts';
import type { ModeKey } from '../../model/modes.ts';
import type { PageProps } from '../../shell/pageTypes.ts';
import { curMode } from '../../state/index.ts';

import { ChecklistScreen } from './ChecklistScreen.tsx';
import { PhotoAsk } from './PhotoAsk.tsx';
import type { ChecklistNavigation } from './screenActions.ts';

/** Argument of `go('checklist', …)` opening the editor. */
interface EditArgument {
  /** @default undefined */
  edit?: boolean;
  /** @default undefined */
  boatId?: string;
  /** @default undefined */
  list?: string;
  /** @default undefined */
  mode?: ModeKey;
}

/**
 * Screen `checklist` (legacy `VIEWS.checklist`): the list being done, or with
 * `{ edit }` / `{ boatId }` the editor of the lists.
 * @param props - Page props: a list id, `{ edit, list }` or `{ boatId, list, mode }`.
 * @returns The screen content, rendered inside `<main id="view">`.
 */
export function ChecklistPage({ arg }: PageProps) {
  const { screen, revision, show } = useChecklistScreens(() =>
    firstScreen(arg),
  );
  const [center, setCenter] = useState<string | null>(null);
  const [asked, setAsked] = useState<string | null>(null);
  const showHome = (list?: string) => {
    selectChecklist(list);
    show({ kind: 'home' });
  };
  const list = checklistUi.list.value ?? 'dep';
  const navigation: ChecklistNavigation = {
    redraw: (centerOn = null) => {
      setCenter(centerOn);
      showHome();
    },
    showList: showHome,
    showEdit: () => show({ kind: 'edit', boatId: null, list, mode: curMode() }),
    showNew: () => show({ kind: 'new', boatId: null, mode: curMode() }),
    removePhoto: (id) => {
      removePhoto(id);
      showHome();
    },
    askPhoto: (id) => {
      if (photosFor(list).some((photo) => photo.item === id)) setAsked(id);
    },
  };
  const askedPhotos = photosFor(list).filter((photo) => photo.item === asked);
  return (
    <>
      {screen.kind === 'home' || screen.kind === 'base' ? (
        <ChecklistScreen
          key={revision}
          navigation={navigation}
          centerOn={center}
        />
      ) : (
        <ChecklistSubScreen
          key={revision}
          screen={screen}
          show={show}
          showHome={showHome}
        />
      )}
      {asked && askedPhotos.length > 0 ? (
        <PhotoAsk
          count={askedPhotos.length}
          onDelete={() => {
            for (const photo of askedPhotos) removePhoto(photo.id);
            showHome();
          }}
          onClose={() => setAsked(null)}
        />
      ) : null}
    </>
  );
}

function firstScreen(arg: unknown): ChecklistScreenState {
  if (!arg || typeof arg !== 'object') return { kind: 'home' };
  const { edit, boatId, list, mode } = arg as EditArgument;
  if (!edit && !boatId) return { kind: 'home' };
  return {
    kind: 'edit',
    boatId: boatId ?? null,
    list: list || checklistUi.list.value || 'dep',
    mode: mode || curMode(),
  };
}
