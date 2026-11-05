import { dayKey, uid } from '../../lib/format.ts';
import type { Cruise, PhotoReference } from '../../model/types.ts';
import {
  addEntry,
  saveCruise,
  state,
  toast,
  updateCruise,
} from '../../state/index.ts';
import { delPhoto, putPhoto, shrinkPhoto } from '../../storage/photos.ts';

import { lakeFix } from './lakeFix.ts';

/** A photo reference of `cruise.photos` as written by {@link takePhoto}. */
export interface CruisePhoto extends PhotoReference {
  /** ISO time. */
  t: string;
  /** Day key. */
  day: string;
  /** Moment: `dep`, `nav`, `quit` or a checklist. */
  ctx: string;
  /**
   * Checklist item the photo belongs to.
   * @default undefined
   */
  item?: string;
}

/**
 * Photos of a moment and a day (legacy `photosFor`).
 * @param context - Moment, or null for all.
 * @param key - Day key, or null / undefined for all days.
 * @param cruise - Cruise (the open one by default).
 * @returns The photos.
 */
export function photosFor(
  context?: string | null,
  key?: string | null,
  cruise: Cruise | null = state.data.cruise.value,
): CruisePhoto[] {
  const photos = (cruise?.photos ?? []) as CruisePhoto[];
  return photos.filter(
    (photo) =>
      (!context || photo.ctx === context) && (!key || photo.day === key),
  );
}

/**
 * Open the camera or the photo library, then store the photos, reduced, in the
 * phone. Photos taken under way also get a journal entry (legacy `takePhoto`).
 * @param context - Moment: `dep`, `nav`, `quit` or a checklist.
 * @param done - Runs after the photos are stored.
 * @param item - Checklist item the photos belong to.
 */
export function takePhoto(
  context: string,
  done?: () => void,
  item?: string,
): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.addEventListener('change', () => {
    void storePhotos([...(input.files ?? [])], context, item, done);
  });
  input.click();
}

/**
 * Remove a photo from the cruise and from the phone (legacy `removePhoto`).
 * @param id - Photo id.
 */
export function removePhoto(id: string): void {
  updateCruise((cruise) => {
    cruise.photos = (cruise.photos ?? []).filter((photo) => photo.id !== id);
  });
  void delPhoto(id);
}

async function storePhotos(
  files: File[],
  context: string,
  item: string | undefined,
  done: (() => void) | undefined,
): Promise<void> {
  if (files.length === 0) return;
  const day = dayKey(new Date());
  const ids: string[] = [];
  /* eslint-disable no-await-in-loop -- one photo at a time: each is decoded in a full-size canvas */
  for (const file of files) {
    try {
      const id = uid();
      await putPhoto(id, await shrinkPhoto(file));
      const photo: CruisePhoto = {
        id,
        t: new Date().toISOString(),
        day,
        ctx: context,
        ...(item ? { item } : {}),
      };
      updateCruise(
        (cruise) => {
          cruise.photos ??= [];
          cruise.photos.push(photo);
        },
        { save: false },
      );
      ids.push(id);
    } catch {
      toast('Photo impossible à enregistrer');
    }
  }
  /* eslint-enable no-await-in-loop */
  if (ids.length === 0) return;
  saveCruise();
  if (context === 'nav') {
    lakeFix((position) => {
      addEntry({
        id: uid(),
        t: new Date().toISOString(),
        v: {
          evt: ['Photo'],
          photos: ids,
          ...(position ? { pos: position } : {}),
        },
      });
    });
  }
  toast(
    ids.length > 1 ? `📷 ${ids.length} photos ajoutées` : '📷 Photo ajoutée',
  );
  done?.();
}
