import { uid } from '../../lib/format.ts';
import { state, toast, updateCrewSets } from '../../state/index.ts';
import { delPhoto, putPhoto, shrinkPhoto } from '../../storage/photos.ts';

import { crewSetById } from './crewsEdit.ts';
import { showCrews, showCrewsEdit } from './screen.ts';

/** Choose the group photo; a composition must exist first (legacy `pickCrewPhoto`). */
export function pickCrewPhoto(): void {
  const id = state.view.crewsEdit.value?.id ?? null;
  if (!crewSetById(id)) {
    toast('Choisissez d’abord les coéquipiers·ères de cet équipage');
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) void storeCrewPhoto(id, file);
  });
  input.click();
}

/** Remove the group photo and its caption. */
export function removeCrewPhoto(): void {
  const id = state.view.crewsEdit.value?.id ?? null;
  const photo = crewSetById(id)?.photo as string | undefined;
  if (!photo) return;
  void delPhoto(photo);
  updateCrewSets((sets) => {
    const set = sets.find((item) => item.id === id);
    if (!set) return;
    delete set.photo;
    delete set.photoCap;
  });
  toast('Photo retirée');
  showCrewsEdit();
}

/** Delete the composition being edited. */
export function removeEditedCrewSet(): void {
  const id = state.view.crewsEdit.value?.id ?? null;
  updateCrewSets((sets) => {
    const index = sets.findIndex((set) => set.id === id);
    if (index !== -1) sets.splice(index, 1);
  });
  toast('Équipage supprimé');
  state.view.crewsEdit.value = null;
  showCrews();
}

async function storeCrewPhoto(setId: string | null, file: File): Promise<void> {
  try {
    const id = uid();
    await putPhoto(id, await shrinkPhoto(file));
    const previous = crewSetById(setId)?.photo as string | undefined;
    if (previous) void delPhoto(previous);
    updateCrewSets((sets) => {
      const set = sets.find((item) => item.id === setId);
      if (set) set.photo = id;
    });
    toast('📷 Photo de groupe ajoutée · écrivez la légende');
    showCrewsEdit();
    setTimeout(() => {
      const caption = document.querySelector<HTMLInputElement>('#ceCap');
      caption?.scrollIntoView({ block: 'center' });
      caption?.focus();
    }, 150);
  } catch {
    toast('Photo impossible à enregistrer');
  }
}
