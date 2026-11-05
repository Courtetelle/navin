import { produce } from 'immer';

import { uid } from '../../lib/format.ts';
import type { FieldData } from '../../model/field.ts';
import { state, toast } from '../../state/index.ts';
import {
  delPhoto,
  getPhoto,
  putPhoto,
  shrinkPhoto,
} from '../../storage/photos.ts';

import type { FaceFraming, MemberPhoto } from './avatar.ts';
import { faceAuto } from './avatar.ts';
import { photosOf } from './ficheRecord.ts';
import type { FicheRecord } from './useFicheRecord.ts';

/**
 * Choose photos and add them to the card; the first one gets the framing of
 * the face (lake.js:2265-2281).
 * @param record - The card.
 */
export function addFichePhotos(record: FicheRecord): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.addEventListener('change', () => {
    void storePhotos(record, [...(input.files ?? [])]);
  });
  input.click();
}

/**
 * Remove a photo from the card and from the phone (lake.js:2293).
 * @param record - The card.
 * @param id - Photo id.
 */
export function removeFichePhoto(record: FicheRecord, id: string): void {
  const next: FieldData = { ...record.latest() };
  const photos = photosOf(next).filter((photo) => photo.id !== id);
  if (photos.length > 0) next.photos = photos;
  else delete next.photos;
  const faceRemoved = (next.face as FaceFraming | undefined)?.id === id;
  if (faceRemoved) delete next.face;
  record.change(next);
  forgetOnCard(record.latestId(), faceRemoved, photos.length === 0);
  void delPhoto(id);
  record.persist();
  toast('Photo supprimée');
}

// Without a first name the card is not saved: what it lost stays in memory
// only, until the next save.
function forgetOnCard(
  memberId: string | null,
  face: boolean,
  photos: boolean,
): void {
  state.data.members.value = produce(state.data.members.value, (members) => {
    const card = members.find((member) => member.id === memberId);
    if (!card) return;
    if (face) delete card.face;
    if (photos) delete card.photos;
  });
}

async function storePhotos(
  record: FicheRecord,
  files: readonly File[],
): Promise<void> {
  const added: MemberPhoto[] = [];
  /* eslint-disable no-await-in-loop -- one photo at a time: each one is reduced in memory */
  for (const file of files) {
    try {
      const id = uid();
      await putPhoto(id, await shrinkPhoto(file));
      added.push({ id, t: new Date().toISOString() });
    } catch {
      toast('Photo impossible à enregistrer');
    }
  }
  /* eslint-enable no-await-in-loop */
  if (added.length === 0) return;
  const next: FieldData = {
    ...record.latest(),
    photos: [...photosOf(record.latest()), ...added],
  };
  const first = photosOf(next)[0];
  if (!next.face && first) {
    const url = await getPhoto(first.id);
    const framing = await faceAuto(typeof url === 'string' ? url : null);
    next.face = { id: first.id, ...framing };
  }
  record.change(next);
  record.persist();
  toast(
    added.length > 1
      ? `📷 ${added.length} photos ajoutées`
      : '📷 Photo ajoutée',
  );
}
