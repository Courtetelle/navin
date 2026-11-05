import { state, toast, updateMembers } from '../../state/index.ts';
import { delPhoto } from '../../storage/photos.ts';

import type { MemberPhoto } from './avatar.ts';
import { leaveFiche } from './screen.ts';

/**
 * Delete a card and its photos, then leave it (lake.js:2302).
 * @param id - Member id.
 */
export function deleteFiche(id: string | null): void {
  const card = state.data.members.peek().find((member) => member.id === id);
  for (const photo of (card?.photos ?? []) as MemberPhoto[]) {
    void delPhoto(photo.id);
  }
  updateMembers((members) => {
    const index = members.findIndex((member) => member.id === id);
    if (index !== -1) members.splice(index, 1);
  });
  toast('Fiche supprimée');
  leaveFiche();
}
