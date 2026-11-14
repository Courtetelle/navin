import { claudeDownloads, deliver, state, toast } from '../../state/index.ts';
import { getPhoto } from '../../storage/photos.ts';

import { cardsPng } from './cardsPng.ts';
import { boatThumb, memberAvatar } from './crossDomain.ts';
import { dateStamp, documentOf, imagePages, slug } from './listDocument.ts';
import { LIST_TITLES } from './listKinds.ts';
import { listTheme } from './listPublishState.ts';
import { PLAN_PREFIX, planOf } from './planPhoto.ts';
import type {
  CardsDocument,
  CardsPhoto,
  CardsSection,
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
      // The plan of a mark is drawn, not kept with the photos.
      const url = photo.id.startsWith(PLAN_PREFIX)
        ? await planOf(photo.id).catch(() => null)
        : await getPhoto(photo.id).catch(() => null);
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
      const name = `NavIn-${slug(LIST_TITLES[kind])}-${dateStamp()}${suffix}.png`;
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
  const sheet = await withGroupPlans(
    documentOf(page, LIST_TITLES[kind], kind),
    page,
  );
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

/**
 * The plan of a group of marks right under the last mark of its group.
 * @param sheet - The document of the page.
 * @param page - Its elements.
 * @returns The document with its plans.
 */
async function withGroupPlans<T extends CardsDocument>(
  sheet: T,
  page: readonly PublishItem[],
): Promise<T> {
  if (!page.some((item) => (item.photos ?? []).some(isGroupPlan))) {
    return sheet;
  }
  const urls = await photoUrls(page);
  const sections: CardsSection[] = [];
  let at = 0;
  for (const item of page) {
    const count = item.sections.length;
    sections.push(...(sheet.sections ?? []).slice(at, at + count));
    at += count;
    for (const photo of (item.photos ?? []).filter(isGroupPlan)) {
      const url = urls.get(photo.id);
      if (url) {
        sections.push({
          title: 'Situation',
          rows: [['', '', [{ url, cap: photo.cap }]]],
        });
      }
    }
  }
  return { ...sheet, sections };
}

function isGroupPlan(photo: { id: string }): boolean {
  return photo.id.startsWith(`${PLAN_PREFIX}marks:`);
}

async function listPhotos(list: readonly PublishItem[]): Promise<CardsPhoto[]> {
  const urls = await photoUrls(list);
  const photos: CardsPhoto[] = [];
  for (const item of list) {
    for (const photo of item.photos ?? []) {
      const url = urls.get(photo.id);
      // The plans of the groups stand under their marks.
      if (!url || isGroupPlan(photo)) continue;
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
