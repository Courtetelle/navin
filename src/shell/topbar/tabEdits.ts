import { effect, signal } from '@preact/signals-react';

import type { UiEdit } from '../../model/logTypes.ts';
import { state } from '../../state/index.ts';

import { tabDisplays } from './tabDisplays.ts';
import type { TabFace, TopTabKey } from './topMenuModel.ts';

// Legacy read the attributes of a tab at the first label pass of the boot, when
// its `data-base` may or may not be there yet: both keys exist in stored edits.
const TAB_KEYS: Readonly<Record<TopTabKey, readonly string[]>> = {
  tracker: [
    'onglets|data-view=tracker&data-pt=1',
    'onglets|data-view=tracker&data-pt=1&data-base=NavIn',
  ],
  more: [
    'onglets|data-view=more&data-pt=1&data-base=data',
    'onglets|data-view=more&data-pt=1',
  ],
  sos: [
    'onglets|data-view=sos&data-pt=1&data-base=SOS',
    'onglets|data-view=sos&data-pt=1',
  ],
};

const editedFaces = signal<Partial<Record<TopTabKey, TabFace>>>({});

/**
 * Key of a top tab in `ldb.uiEdits`.
 * @param tab - The tab.
 * @returns The key holding an edit, else the one a new edit gets.
 */
export function tabEditKey(tab: TopTabKey): string {
  const keys = TAB_KEYS[tab];
  const stored = keys.find((key) => state.data.uiEdits.value[key]);
  return stored ?? (keys[0] as string);
}

/**
 * Stored label edit of a top tab.
 * @param tab - The tab.
 * @returns The edit, if any.
 */
export function tabEdit(tab: TopTabKey): UiEdit | undefined {
  return state.data.uiEdits.value[tabEditKey(tab)];
}

/**
 * Whether the tab still shows what its edit was written on: legacy wrote the
 * edit into the tab once, and the next name or choice drawn replaced it.
 * @param tab - The tab.
 * @param face - What the tab shows now.
 * @returns `true` while the label and small text of the edit apply.
 */
export function faceIsEdited(tab: TopTabKey, face: TabFace): boolean {
  return editedFaces.value[tab] === face;
}

/**
 * Write the edits into the tabs after the boot, and again when they change
 * (ui-edit.js:75, `uiRefresh`).
 */
export function followTabEdits(): void {
  effect(() => {
    if (state.data.uiEdits.value) {
      editedFaces.value = {
        tracker: tabDisplays.tracker.peek().face,
        more: tabDisplays.more.peek().face,
        sos: tabDisplays.sos.peek().face,
      };
    }
  });
}
