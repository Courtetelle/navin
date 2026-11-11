import { fmtShortDate, pad } from '../../lib/format.ts';

import type {
  CardsDocument,
  ListKind,
  PublishItem,
  PublishSection,
} from './types.ts';

/** Subtitle of each list: what one element is. */
const KIND_SUBTITLES: Readonly<Record<ListKind, string>> = {
  people: 'Fiche coéquipier·ère',
  crews: 'Équipage',
  boats: 'Fiche bateau',
  traces: 'Traces',
  marks: 'Marques',
  ckbases: 'Check-lists',
  soslogs: 'Logs SOS',
};

/**
 * Remove the element name from a section title when it is alone: the header
 * already shows it.
 * @param title - Section title.
 * @param name - Element name.
 * @returns The title without the name.
 */
export function stripName(title: string, name: string): string {
  return title.replace(`${name} · `, '').replace(name, '');
}

/**
 * Structure shared by the image and the PDF: title, subtitle, and sections
 * that do not repeat the name of a single element.
 * @param list - Elements.
 * @param listTitle - Title of the list.
 * @param kind - List kind.
 * @returns The document, without layout and pictures.
 */
export function documentOf(
  list: readonly PublishItem[],
  listTitle: string,
  kind: ListKind,
): CardsDocument & { title: string; kicker: string; sub: string } {
  const one = list.length === 1;
  const subtitle = KIND_SUBTITLES[kind];
  const sections: PublishSection[] = [];
  for (const item of list) {
    for (const section of item.sections) {
      sections.push({
        ...section,
        title: one ? stripName(section.title, item.name) : section.title,
      });
    }
  }
  return {
    title: one ? (list[0] as PublishItem).name : listTitle,
    kicker: subtitle,
    sub: `${one ? subtitle : `${list.length} éléments`} · ${fmtShortDate(new Date())}`,
    sections,
  };
}

/**
 * Split a list into several images: a too tall image does not open well on a
 * phone. A page holds about 60 lines; an element is never split.
 * @param list - Elements.
 * @returns The pages.
 */
export function imagePages(list: readonly PublishItem[]): PublishItem[][] {
  const pages: PublishItem[][] = [];
  let current: PublishItem[] = [];
  let lines = 0;
  for (const item of list) {
    const itemLines = linesOf(item);
    if (current.length > 0 && lines + itemLines > 60) {
      pages.push(current);
      current = [];
      lines = 0;
    }
    current.push(item);
    lines += itemLines;
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

/**
 * File-name form of a title: no accents, lower case, dashes.
 * @param text - Title.
 * @returns The slug.
 */
export function slug(text: string): string {
  return text
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .replaceAll(/[^a-z0-9]+/gi, '-')
    .replaceAll(/^-|-$/g, '')
    .toLowerCase();
}

/**
 * Today as `YYYYMMDD`, for file names.
 * @returns The stamp.
 */
export function dateStamp(): string {
  const today = new Date();
  return `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;
}

/**
 * Blank sheet of a list: the labels of the first element with empty values, to
 * fill in by hand.
 * @param kind - List kind.
 * @param listTitle - Title of the list.
 * @param first - First element of the list, if any.
 * @returns The element to print.
 */
export function blankSheet(
  kind: ListKind,
  listTitle: string,
  first: PublishItem | undefined,
): PublishItem {
  const sections: PublishSection[] = first
    ? first.sections.map((section, index) => ({
        sk: section.sk,
        title: index
          ? section.title
          : stripName(section.title, first.name) || section.title,
        rows: section.rows.map(([label]) => [label, ' ']),
      }))
    : [
        {
          title: listTitle,
          rows: [
            ['Nom', ' '],
            ['Date', ' '],
            ['Remarques', ' '],
          ],
        },
      ];
  return {
    id: 'blank',
    name:
      kind === 'boats' ? 'Fiche bateau à remplir' : 'Fiche équipage à remplir',
    sections,
    photos: [],
  };
}

function linesOf(item: PublishItem): number {
  let lines = 0;
  for (const section of item.sections) {
    lines += 2;
    for (const [, value] of section.rows) {
      lines += 1 + (value.match(/\n/g) ?? []).length;
    }
  }
  return lines;
}
