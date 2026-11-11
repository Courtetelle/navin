import { textOf } from '../../lib/format.ts';
import { PROCHES, normMemberPhones } from '../../lib/phone.ts';
import type { FieldData } from '../../model/field.ts';
import type { Member } from '../../model/types.ts';

import type { FaceFraming, MemberPhoto } from './avatar.ts';

const OTHER_RELATIVES = PROCHES.slice(1);

/**
 * Photos of a card being edited.
 * @param data - Values of the card.
 * @returns The photos.
 */
export function photosOf(data: FieldData): readonly MemberPhoto[] {
  return (data.photos ?? []) as readonly MemberPhoto[];
}

/**
 * The card saved from the values of the form (legacy `persist`, lake.js:2204):
 * only the filled fields, the photos and the framing of a photo still there.
 * @param id - Member id.
 * @param names - First and last name.
 * @param names.prenom - First name.
 * @param names.nom - Last name.
 * @param data - Values of the form.
 * @param keys - Fields of a card.
 * @returns The card, its phones in international format.
 */
export function cardFromForm(
  id: string,
  { prenom, nom }: { prenom: string; nom: string },
  data: FieldData,
  keys: readonly string[],
): Member {
  const card: Member = { id, prenom, nom };
  for (const key of keys) if (data[key]) card[key] = data[key];
  const photos = photosOf(data);
  if (photos.length > 0) card.photos = data.photos;
  const face = data.face as FaceFraming | undefined;
  if (face && photos.some((photo) => photo.id === face.id)) card.face = face;
  return normMemberPhones(card);
}

/**
 * How many relatives the form shows at first: the last filled one, at least one.
 * @param data - Values of the form.
 * @returns The count.
 */
export function shownRelatives(data: FieldData): number {
  let shown = 1;
  for (const [index, [name, phone]] of PROCHES.entries()) {
    if (name && phone && (data[name] || data[phone])) {
      shown = Math.max(shown, index + 1);
    }
  }
  return shown;
}

/** Result of {@link packRelatives}. */
interface PackedRelatives {
  /** Values, the second and third relatives packed upwards. */
  data: FieldData;
  /** Relatives to show. */
  shown: number;
  /** The second and third relatives changed. */
  changed: boolean;
}

/**
 * A second or third relative that was emptied disappears and the next one moves
 * up (lake.js:2224-2232).
 * @param data - Values of the form.
 * @returns The new values and the number of relatives to show.
 */
export function packRelatives(data: FieldData): PackedRelatives {
  const lines = relativeLines(data);
  const kept = lines.filter(([name, phone]) => name || phone);
  const next = { ...data };
  for (const [index, keys] of OTHER_RELATIVES.entries()) {
    const line = kept[index] ?? ['', ''];
    for (const [position, key] of keys.entries()) {
      const value = line[position];
      if (value) next[key] = value;
      else Reflect.deleteProperty(next, key);
    }
  }
  return {
    data: next,
    shown: 1 + kept.length,
    changed: JSON.stringify(relativeLines(next)) !== JSON.stringify(lines),
  };
}

function relativeLines(data: FieldData): Array<[string, string]> {
  const lines: Array<[string, string]> = [];
  for (const [name = '', phone = ''] of OTHER_RELATIVES) {
    lines.push([textOf(data[name]).trim(), textOf(data[phone]).trim()]);
  }
  return lines;
}
