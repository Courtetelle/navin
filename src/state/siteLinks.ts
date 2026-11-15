import { store } from '../storage/store.ts';

/** A link to a site as the skipper changed it. */
export interface SiteLinkEdit {
  label: string;
  url: string;
}

const KEY = 'ldb.siteLinks';

/**
 * The links to sites changed with their pencil, by id. They go in the full
 * backup.
 * @returns The changes.
 */
export function siteLinkEdits(): Record<string, SiteLinkEdit> {
  return store.get<Record<string, SiteLinkEdit>>(KEY, {});
}

/**
 * A link as shown: the skipper's change, else NavIn's.
 * @param id - The link.
 * @param label - Its text by default.
 * @param url - Its address by default.
 * @returns The text and the address.
 */
export function siteLink(id: string, label: string, url: string): SiteLinkEdit {
  const edit = siteLinkEdits()[id];
  return {
    label: edit?.label?.trim() || label,
    url: edit?.url?.trim() || url,
  };
}

/**
 * Keep a link as the skipper wrote it; both emptied, NavIn's comes back.
 * @param id - The link.
 * @param edit - The text and the address.
 */
export function saveSiteLink(id: string, edit: SiteLinkEdit): void {
  const others = Object.entries(siteLinkEdits()).filter(([key]) => key !== id);
  if (edit.label.trim() || edit.url.trim()) {
    others.push([id, { label: edit.label.trim(), url: edit.url.trim() }]);
  }
  store.set(KEY, Object.fromEntries(others));
}

/**
 * A backup brings changed links: those this device has not changed are
 * taken.
 * @param received - The `siteLinks` of the backup.
 */
export function mergeSiteLinks(received: unknown): void {
  if (!received || typeof received !== 'object') return;
  const kept = siteLinkEdits();
  for (const [id, edit] of Object.entries(
    received as Record<string, unknown>,
  )) {
    const link = edit as Partial<SiteLinkEdit> | null;
    if (kept[id] || typeof link?.url !== 'string') continue;
    kept[id] = { label: link.label ?? '', url: link.url };
  }
  store.set(KEY, kept);
}
