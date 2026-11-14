import { store } from '../../storage/store.ts';

/** The account of the site of a key: where it is made, and how to log in. */
export interface SiteAccount {
  url: string;
  user: string;
  password: string;
}

/**
 * Kept on this device only, never in a backup, a sync or a share: the
 * accounts of the sites the keys come from.
 */
const ACCOUNTS_KEY = 'ldb.keyAccounts';

/**
 * The account kept for a site.
 * @param id - The site (`mf`, `aemet`, `metoffice`…).
 * @param url - Its address, when nothing is kept yet.
 * @returns The account.
 */
export function siteAccount(id: string, url: string): SiteAccount {
  const kept = store.get<Record<string, SiteAccount>>(ACCOUNTS_KEY, {})[id];
  return { url, user: '', password: '', ...kept };
}

/**
 * Keep the account of a site, on this device only.
 * @param id - The site.
 * @param account - Its account.
 */
export function saveAccount(id: string, account: SiteAccount): void {
  store.set(ACCOUNTS_KEY, {
    ...store.get<Record<string, SiteAccount>>(ACCOUNTS_KEY, {}),
    [id]: account,
  });
}
