import { uid } from '../../lib/format.ts';
import { patchVoyage, state, toast } from '../../state/index.ts';
import { delPhoto, putPhoto, shrinkPhoto } from '../../storage/photos.ts';

/** The photos a cruise holds besides its documents. */
export type VoyagePhotoKey = 'photo' | 'crewPhoto';

async function store(id: string, key: VoyagePhotoKey, file: File) {
  try {
    const photo = uid();
    await putPhoto(photo, await shrinkPhoto(file));
    const voyage = state.data.voyageStore
      .peek()
      .list.find((item) => item.id === id);
    const previous = voyage?.[key];
    if (previous) void delPhoto(previous);
    patchVoyage(id, (draft) => {
      draft[key] = photo;
    });
    toast(
      key === 'photo'
        ? '📷 Médaillon de la croisière ajouté'
        : '📷 Photo de groupe ajoutée · écrivez la légende',
    );
  } catch {
    toast('Photo impossible à enregistrer');
  }
}

/**
 * Choose a photo of the cruise: photo library, file or camera.
 * @param id - Cruise id.
 * @param key - The medallion or the crew group photo.
 */
export function pickVoyagePhoto(id: string, key: VoyagePhotoKey): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) void store(id, key, file);
  });
  input.click();
}

/**
 * Remove a photo of the cruise (and the caption of the group photo).
 * @param id - Cruise id.
 * @param key - The medallion or the crew group photo.
 */
export function removeVoyagePhoto(id: string, key: VoyagePhotoKey): void {
  const voyage = state.data.voyageStore
    .peek()
    .list.find((item) => item.id === id);
  const photo = voyage?.[key];
  if (!photo) return;
  void delPhoto(photo);
  patchVoyage(id, (draft) => {
    if (key === 'photo') {
      delete draft.photo;
    } else {
      delete draft.crewPhoto;
      delete draft.crewPhotoCap;
    }
  });
  toast('Photo retirée');
}
