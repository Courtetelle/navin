import { claudeDownloads, deliver, state, toast } from '../../state/index.ts';
import { getPhoto } from '../../storage/photos.ts';

import { cardsPng } from './cardsPng.ts';
import { boatThumb, memberAvatar } from './crossDomain.ts';
import { dateStamp, documentOf, imagePages, slug } from './listDocument.ts';
import { LIST_TITLES } from './listKinds.ts';
import { listTheme } from './listPublishState.ts';
import type {
  CardsDocument,
  CardsPhoto,
  ListKind,
  PublishItem,
} from './types.ts';

/* eslint-disable no-await-in-loop -- photos and images are made one at a time to limit the memory used on phones */

/**
 * Data URLs of the photos of a list; unreadable photos are left out.
 * @param list - Elements.
 * @returns Data URL by photo id.
 */
export async function photoUrls(
  list: readonly PublishItem[],
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  for (const item of list) {
    for (const photo of item.photos ?? []) {
      const url = await getPhoto(photo.id).catch(() => null);
      if (typeof url === 'string' && url) urls.set(photo.id, url);
    }
  }
  return urls;
}

/**
 * Thumbnail of an element: round face (crew member) or boat rectangle.
 * @param item - Element.
 * @returns Its data URL, or null.
 */
export async function itemAvatar(item: PublishItem): Promise<string | null> {
  const { face, faceRect } = item;
  if (!face) return null;
  if (faceRect) {
    const boat = state.data.boats.value.find((entry) => entry.id === face);
    return boat ? boatThumb(boat) : null;
  }
  const member = state.data.members.value.find((entry) => entry.id === face);
  return member
    ? memberAvatar(member as unknown as Parameters<typeof memberAvatar>[0])
    : null;
}

/**
 * Send a list as PNG images, several when it is long.
 * @param kind - List kind.
 * @param list - Elements to send.
 */
export async function imageList(
  kind: ListKind,
  list: readonly PublishItem[],
): Promise<void> {
  const pages = imagePages(list);
  toast('Préparation de l’image…');
  try {
    const files: File[] = [];
    for (const [index, page] of pages.entries()) {
      const sheet = await pageDocument(kind, list, page, {
        index,
        count: pages.length,
      });
      const blob = await cardsPng(sheet);
      const suffix = pages.length > 1 ? `-${index + 1}` : '';
      const name = `navin-${slug(LIST_TITLES[kind])}-${dateStamp()}${suffix}.png`;
      files.push(new File([blob], name, { type: 'image/png' }));
    }
    await sendFiles(files, LIST_TITLES[kind]);
  } catch {
    toast('Image impossible : faites une capture d’écran');
  }
}

async function pageDocument(
  kind: ListKind,
  list: readonly PublishItem[],
  page: readonly PublishItem[],
  { index, count }: { index: number; count: number },
): Promise<CardsDocument> {
  const sheet = documentOf(page, LIST_TITLES[kind], kind);
  const title =
    count > 1 ? `${sheet.title} (${index + 1}/${count})` : sheet.title;
  const photos = index === count - 1 ? await listPhotos(list) : [];
  const [only] = page;
  const single = page.length === 1 && only?.face ? only : null;
  return {
    ...sheet,
    title,
    photos,
    ...(single
      ? {
          avatar: await itemAvatar(single),
          avatarRect: Boolean(single.faceRect),
        }
      : {}),
    theme: listTheme(kind),
  };
}

async function listPhotos(list: readonly PublishItem[]): Promise<CardsPhoto[]> {
  const urls = await photoUrls(list);
  const photos: CardsPhoto[] = [];
  for (const item of list) {
    for (const photo of item.photos ?? []) {
      const url = urls.get(photo.id);
      if (!url) continue;
      const prefix = list.length > 1 ? `${item.name} · ` : '';
      photos.push({ url, cap: prefix + photo.cap });
    }
  }
  return photos;
}

/**
 * Hand several pictures over at once (one share sheet when the device can).
 * @param files - The pictures.
 * @param title - Title of the share.
 */
export async function sendFiles(files: File[], title: string): Promise<void> {
  const downloads = await claudeDownloads();
  if (!downloads && files.length > 1 && navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, title });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') throw error;
    }
    return;
  }
  for (const file of files) await deliver(file, file.name, 'image/png');
}
