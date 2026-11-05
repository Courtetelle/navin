import { uid } from '../../lib/format.ts';
import type { ChecklistBase, ChecklistItem } from '../../model/types.ts';
import { curMode, state, toast, updateCkLib } from '../../state/index.ts';

import type { EditableItem } from './checklistEditing.ts';
import { baseItems, fromBaseItems, toBaseItems } from './checklistEditing.ts';
import { ownerBoatId } from './checklistOwner.ts';
import { ensureChecklistOwner, updateOwner } from './ownerUpdates.ts';

/**
 * Keep a list as a base: the base of the same name is replaced (legacy `#ckSaveBase`).
 * @param name - Name of the list.
 * @param categories - Categories of the list.
 * @param items - Items of the list.
 */
export function saveAsBase(
  name: string,
  categories: readonly string[],
  items: readonly ChecklistItem[],
): void {
  const existing = state.data.ckLib.value.find(
    (base) => base.name.toLowerCase() === name.toLowerCase(),
  );
  const record = {
    id: existing ? existing.id : uid(),
    name,
    cats: [...categories],
    items: toBaseItems(items),
    at: new Date().toISOString(),
  };
  updateCkLib((library) => {
    const base = library.find((item) => item.id === record.id);
    if (base) Object.assign(base, record);
    else library.push(record);
  });
  toast(
    existing ? `Base « ${name} » mise à jour` : `Base « ${name} » enregistrée`,
  );
}

/**
 * Add a base as a new list of the open outing (legacy `#beUse`).
 * @param base - Checklist base.
 * @returns The id of the list created.
 */
export function addBaseToOuting(base: ChecklistBase): string {
  ensureChecklistOwner();
  const id = uid();
  const items = fromBaseItems(baseItems(base));
  updateOwner(ownerBoatId(), curMode(), (owner) => {
    owner.ckLists ??= [];
    owner.ckLists.push({ id, name: base.name, cats: [...(base.cats ?? [])] });
    owner[`ckx_${id}`] = items;
  });
  toast(`Liste « ${base.name} » ajoutée`);
  return id;
}

/**
 * Add the point written in a field (legacy `#ckAdd`).
 * @param field - The field.
 * @param onUpdate - Changes the stored items and saves them.
 * @param onRedraw - Draws the screen again.
 */
export function addPoint(
  field: HTMLTextAreaElement | null,
  onUpdate: (recipe: (items: EditableItem[]) => void) => void,
  onRedraw: () => void,
): void {
  const label = (field?.value ?? '').trim();
  if (!label) {
    toast('Écrivez le point à ajouter');
    field?.focus();
    return;
  }
  onUpdate((stored) => {
    stored.push({ id: uid(), label });
  });
  toast('Point ajouté');
  onRedraw();
}
