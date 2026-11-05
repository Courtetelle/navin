import {
  checklistOwner,
  ckCats,
  ckDefs,
  ckName,
  ckProp,
  ownerBoatId,
  ownerItems,
} from '../../features/checklists/checklistOwner.ts';
import {
  checkDone,
  checkItems,
  checkLeft,
  ckLabelVal,
  ckOpen,
  ckVal,
  obsOwner,
} from '../../features/checklists/checklistProgress.ts';
import { checklistUi } from '../../features/checklists/checklistUi.ts';
import type { CruisePhoto } from '../../features/checklists/neighbours.ts';
import { photosFor } from '../../features/checklists/neighbours.ts';
import { dayKey, textOf } from '../../lib/format.ts';
import type { ChecklistSlot, ModeKey } from '../../model/modes.ts';
import { isCkBuiltin } from '../../model/modes.ts';
import type { ChecklistItem, Day } from '../../model/types.ts';
import { constatKey } from '../../model/views.ts';
import { curMode, getDay, isLake, state } from '../../state/index.ts';

/** State of an item: white, orange (`red` in the CSS) or green. */
export type ItemState = '' | 'red' | 'done';

/** One line of the list, as read when the screen is drawn. */
export interface ChecklistRow {
  item: ChecklistItem;
  state: ItemState;
  /** Text of the item, with its value once it is orange or green. */
  label: string;
  /** Value of the item. */
  value: string;
  /** Photos of the item. */
  photos: CruisePhoto[];
  /** The photos of a green item are shown. */
  showPhotos: boolean;
}

/** A tab of the list screen. */
export interface ChecklistTab {
  id: string;
  name: string;
  /** Sub-label: `vide`, `n restants` or `✔ fait`. */
  status: string;
}

/** Everything the list screen shows, read once when it is drawn. */
export interface ChecklistModel {
  /** Check-in step of the PréP flow: no filters, tabs nor management buttons. */
  inPrep: boolean;
  /** Id of the owning boat, `null` when the cruise owns the lists. */
  ownerId: string | null;
  /** Name of the owning boat. */
  boatName: string;
  mode: ModeKey;
  list: string;
  listName: string;
  /** Owner property of the list. */
  property: string;
  /** One of the two built-in lists. */
  builtin: boolean;
  items: readonly ChecklistItem[];
  rows: ChecklistRow[];
  doneCount: number;
  /** Items not done. */
  leftCount: number;
  /** An item is orange or green: the list can restart. */
  canReset: boolean;
  /** Category filter. */
  category: string;
  /** Categories used by the lists of the owner. */
  categories: string[];
  /** Categories of the list shown. */
  listCategories: readonly string[];
  tabs: ChecklistTab[];
  quitName: string;
  lake: boolean;
  /** In-place edit mode. */
  editing: boolean;
  today: Day;
  observation: string;
  observationPhotos: CruisePhoto[];
  observationsOpen: boolean;
}

/**
 * Read what the list screen shows (first half of legacy `VIEWS.checklist`).
 * @returns The model of the current list.
 */
export function checklistModel(): ChecklistModel {
  const list = checklistUi.list.value ?? 'dep';
  const mode = curMode();
  const owner = checklistOwner();
  const property = ckProp(list);
  const items = ownerItems(owner, property);
  const done = checkDone();
  const open = ckOpen();
  const key = dayKey(new Date());
  const listPhotos = photosFor(list);
  const rows: ChecklistRow[] = items.map((item) =>
    toRow(item, done, open, listPhotos),
  );
  const doneCount = rows.filter((row) => row.state === 'done').length;
  const category = textOf(state.preferences.settings.value.ckCat);
  const definitions = ckDefs();
  const ownerId = ownerBoatId();
  const holder = (obsOwner() ?? {}) as Record<string, unknown>;
  return {
    inPrep: state.data.prep.value?.step === 4,
    ownerId,
    boatName: ownerId ? (owner?.info.boat ?? '') : '',
    mode,
    list,
    listName: ckName(list),
    property,
    builtin: isCkBuiltin(list),
    items,
    rows,
    doneCount,
    leftCount: items.length - doneCount,
    canReset: doneCount > 0 || open.size > 0,
    category,
    categories: usedCategories(definitions),
    listCategories: ckCats(list),
    tabs: visibleTabs(definitions, category, list),
    quitName: ckName('quit'),
    lake: isLake(),
    editing: checklistUi.editing.value,
    today: getDay(key),
    observation: (holder[constatKey(list)] as string | undefined) ?? '',
    observationPhotos: photosFor(list, mode === 'lacj' ? key : null).filter(
      (photo) => !photo.item,
    ),
    observationsOpen: checklistUi.observationsOpen.value,
  };
}

function toRow(
  item: ChecklistItem,
  done: ReadonlySet<string>,
  open: ReadonlySet<string>,
  listPhotos: readonly CruisePhoto[],
): ChecklistRow {
  let itemState: ItemState = '';
  if (done.has(item.id)) itemState = 'done';
  else if (open.has(item.id)) itemState = 'red';
  return {
    item,
    state: itemState,
    label: itemState ? ckLabelVal(item) : item.label,
    value: ckVal(item),
    photos: listPhotos.filter((photo) => photo.item === item.id),
    showPhotos: checklistUi.shownPhotos.value.has(item.id),
  };
}

function usedCategories(definitions: readonly ChecklistSlot[]): string[] {
  const used: string[] = [];
  for (const [id] of definitions) used.push(...ckCats(id));
  return [...new Set(used)];
}

function visibleTabs(
  definitions: readonly ChecklistSlot[],
  category: string,
  current: string,
): ChecklistTab[] {
  const tabs: ChecklistTab[] = [];
  for (const [id, , name] of definitions) {
    if (category && !ckCats(id).includes(category) && id !== current) continue;
    tabs.push({ id, name, status: tabStatus(id) });
  }
  return tabs;
}

function tabStatus(list: string): string {
  const total = checkItems(list).length;
  if (!total) return 'vide';
  const left = checkLeft(list).length;
  if (!left) return '✔ fait';
  return `${left} restant${left > 1 ? 's' : ''}`;
}
