import { toast } from '../../state/index.ts';

import { ListPrintDocument } from './ListPrintDocument.tsx';
import { itemAvatar, photoUrls } from './imageList.ts';
import { dateStamp, documentOf, slug } from './listDocument.ts';
import { LIST_TITLES } from './listKinds.ts';
import { listTheme } from './listPublishState.ts';
import { printInHolder } from './printHolder.tsx';
import type { ListKind, PublishItem } from './types.ts';

/**
 * Print a list as an A4 document (« Enregistrer en PDF » on a phone).
 * @param kind - List kind.
 * @param list - Elements to print.
 */
export async function printList(
  kind: ListKind,
  list: readonly PublishItem[],
): Promise<void> {
  const title = LIST_TITLES[kind];
  const urls = await photoUrls(list);
  const avatars = new Map<string, string>();
  /* eslint-disable no-await-in-loop -- thumbnails are decoded one at a time to limit the memory used on phones */
  for (const item of list) {
    if (!item.face) continue;
    const avatar = await itemAvatar(item);
    if (avatar) avatars.set(item.id, avatar);
  }
  /* eslint-enable no-await-in-loop */
  printInHolder({
    className: `print-only book lx-print lx-th-${listTheme(kind)}`,
    content: (
      <ListPrintDocument
        sheet={documentOf(list, title, kind)}
        list={list}
        urls={urls}
        avatars={avatars}
      />
    ),
    title: `NavIn-${slug(title)}-${dateStamp()}`,
    delay: 400,
    removeStale: true,
  });
  toast('Impression : choisir « Enregistrer en PDF » ou partager');
}
