import { signal } from '@preact/signals-react';

import { store } from '../storage/store.ts';

import { SITES, siteDef } from './siteCatalog.ts';

/** A link to a site as the skipper changed it. */
export interface SiteLinkEdit {
  label: string;
  url: string;
  /** Taken away: its button no longer shows. */
  hidden?: boolean;
}

/** Bumped at each change, so the buttons and the list redraw. */
export const siteLinksVersion = signal(0);

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
    ...(edit?.hidden ? { hidden: true } : {}),
  };
}

/**
 * A site of the list as shown, with the skipper's changes.
 * @param id - Its key.
 * @returns Text, address and whether it was taken away; null if unknown.
 */
export function siteShown(id: string): SiteLinkEdit | null {
  const site = siteDef(id);
  return site ? siteLink(id, site.label, site.url) : null;
}

/**
 * All the sites of NavIn as shown, in their order.
 * @returns Each site with its text and address.
 */
export function sitesShown(): Array<
  SiteLinkEdit & { id: string; where: string }
> {
  return SITES.map((site) => ({
    id: site.id,
    where: site.where,
    ...siteLink(site.id, site.label, site.url),
  }));
}

/**
 * Take a site away: its button no longer shows (« Rétablir » brings it back).
 * @param id - Its key.
 */
export function hideSiteLink(id: string): void {
  const kept = siteLinkEdits();
  store.set(KEY, {
    ...kept,
    [id]: { ...(kept[id] ?? { label: '', url: '' }), hidden: true },
  });
  siteLinksVersion.value++;
}

/** Bring back every site taken away, with its changes. */
export function restoreSiteLinks(): void {
  const kept = siteLinkEdits();
  for (const [id, edit] of Object.entries(kept)) {
    const { hidden: _hidden, ...rest } = edit;
    if (rest.label || rest.url) kept[id] = rest;
    else Reflect.deleteProperty(kept, id);
  }
  store.set(KEY, kept);
  siteLinksVersion.value++;
}

/**
 * Keep a link as the skipper wrote it; both emptied, NavIn's comes back.
 * @param id - The link.
 * @param edit - The text and the address.
 */
export function saveSiteLink(id: string, edit: SiteLinkEdit): void {
  const others = Object.entries(siteLinkEdits()).filter(([key]) => key !== id);
  if (edit.label.trim() || edit.url.trim() || edit.hidden) {
    others.push([
      id,
      {
        label: edit.label.trim(),
        url: edit.url.trim(),
        ...(edit.hidden ? { hidden: true } : {}),
      },
    ]);
  }
  store.set(KEY, Object.fromEntries(others));
  siteLinksVersion.value++;
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
    kept[id] = {
      label: link.label ?? '',
      url: link.url,
      ...(link.hidden ? { hidden: true } : {}),
    };
  }
  store.set(KEY, kept);
}
