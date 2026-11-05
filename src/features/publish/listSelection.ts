import type { ListChoice, PublishItem, PublishSection } from './types.ts';

/**
 * Keys of the sections the user can switch off, in order of appearance.
 * @param items - List items.
 * @returns The distinct section keys.
 */
export function sectionKeys(items: readonly PublishItem[]): string[] {
  const keys = new Set<string>();
  for (const item of items) {
    for (const section of item.sections) {
      if (section.sk) keys.add(section.sk);
    }
  }
  return [...keys];
}

/**
 * Labels of the lines of a section, over all items.
 * @param items - List items.
 * @param key - Section key.
 * @returns The distinct labels, in order of appearance.
 */
export function sectionRowLabels(
  items: readonly PublishItem[],
  key: string,
): string[] {
  const labels = new Set<string>();
  for (const item of items) {
    for (const section of item.sections) {
      if (section.sk !== key) continue;
      for (const [label] of section.rows) labels.add(label);
    }
  }
  return [...labels];
}

/**
 * The elements to publish: what is still checked, with the switched off
 * sections, rows, photos and thumbnails removed.
 * @param items - All list items.
 * @param choice - What is switched off.
 * @returns The elements left, none of them empty.
 */
export function chosenItems(
  items: readonly PublishItem[],
  choice: ListChoice,
): PublishItem[] {
  const chosen: PublishItem[] = [];
  for (const item of items) {
    if (choice.off.includes(item.id)) continue;
    const sections = keptSections(item, choice);
    const noPhotos = choice.offSec.includes('§photos');
    const photos = noPhotos
      ? []
      : (item.photos ?? []).filter((photo) => !choice.offPh.includes(photo.id));
    if (sections.length === 0 && photos.length === 0) continue;
    chosen.push({
      ...item,
      sections,
      photos,
      face: choice.offSec.includes('§face') ? null : item.face,
    });
  }
  return chosen;
}

function keptSections(
  item: PublishItem,
  { offSec, offRow }: ListChoice,
): PublishSection[] {
  const kept: PublishSection[] = [];
  for (const section of item.sections) {
    const { sk } = section;
    if (!sk) {
      if (section.rows.length > 0) kept.push(section);
      continue;
    }
    if (offSec.includes(sk)) continue;
    const rows = section.rows.filter(
      ([label]) => !offRow.includes(`${sk}|${label}`),
    );
    if (rows.length > 0) kept.push({ ...section, rows });
  }
  const [first] = kept;
  const original = item.sections[0];
  if (first && first !== original && original?.title !== original?.sk) {
    kept[0] = { ...first, title: `${item.name} · ${first.sk}` };
  }
  return kept;
}
