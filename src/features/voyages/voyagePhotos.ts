import { uid } from '../../lib/format.ts';
import { patchVoyage, state, toast } from '../../state/index.ts';
import { delPhoto, putPhoto, shrinkPhoto } from '../../storage/photos.ts';

async function store(id: string, file: File) {
  try {
    const photo = uid();
    await putPhoto(photo, await shrinkPhoto(file));
    const previous = state.data.voyageStore
      .peek()
      .list.find((item) => item.id === id)?.photo;
    if (previous) void delPhoto(previous);
    patchVoyage(id, (draft) => {
      draft.photo = photo;
    });
    toast('📷 Médaillon de la croisière ajouté');
  } catch {
    toast('Photo impossible à enregistrer');
  }
}

/**
 * Choose the medallion of a cruise: photo library, file or camera.
 * @param id - Cruise id.
 */
export function pickVoyagePhoto(id: string): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) void store(id, file);
  });
  input.click();
}

/**
 * Remove the medallion of a cruise.
 * @param id - Cruise id.
 */
export function removeVoyagePhoto(id: string): void {
  const photo = state.data.voyageStore
    .peek()
    .list.find((item) => item.id === id)?.photo;
  if (!photo) return;
  void delPhoto(photo);
  patchVoyage(id, (draft) => {
    delete draft.photo;
  });
  toast('Photo retirée');
}
