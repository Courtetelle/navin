import { fmtTime2, uid } from '../../lib/format.ts';
import type { Entry } from '../../model/types.ts';
import { go } from '../../shell/router.ts';
import {
  addEntry,
  setDraft,
  state,
  toast,
  updateCruise,
  updateDraft,
} from '../../state/index.ts';

/**
 * Set or clear a value of the hourly form (legacy `setVal`).
 * @param key - Field key.
 * @param value - New value; empty values are removed.
 */
export function setEntryValue(key: string, value: unknown): void {
  updateDraft((draft) => {
    const empty =
      value == null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);
    if (empty) Reflect.deleteProperty(draft.v, key);
    else draft.v[key] = value;
  });
}

/**
 * Turn the draft into an entry and go on (legacy `saveDraftAsEntry`): the next
 * form after a new entry, the journal after an edit.
 */
export function saveDraftAsEntry(): void {
  const draft = state.data.draft.value;
  if (!draft) return;
  const old = draft.id
    ? state.data.cruise.value?.entries.find((item) => item.id === draft.id)
    : null;
  const entry: Entry = {
    id: draft.id || uid(),
    t: draft.t,
    v: structuredClone(draft.v),
  };
  if (old?.auto) entry.auto = true;
  if (!addEntry(entry)) return;
  const wasEdit = Boolean(draft.id);
  setDraft(null);
  toast(
    wasEdit
      ? '✔ Entrée modifiée'
      : `✔ Entrée de ${fmtTime2(new Date(entry.t))} enregistrée`,
  );
  go(wasEdit ? 'log' : 'new');
}

/**
 * Edit an entry in the hourly form (journal « Modifier »).
 * @param entry - Entry.
 */
export function editEntry(entry: Entry): void {
  setDraft({
    id: entry.id,
    t: entry.t,
    v: structuredClone(entry.v),
    tManual: true,
  });
  go('new');
}

/**
 * Delete an entry; its id is remembered for the synchronisation (journal « Supprimer »).
 * @param id - Entry id.
 */
export function deleteEntry(id: string): void {
  updateCruise((cruise) => {
    cruise.entries = cruise.entries.filter((entry) => entry.id !== id);
    cruise.deleted = [...((cruise.deleted ?? []) as string[]), id];
  });
  toast('Entrée supprimée');
}
