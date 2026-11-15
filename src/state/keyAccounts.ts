import { store } from '../storage/store.ts';

/** The account of the site of a key: where it is made, and how to log in. */
export interface SiteAccount {
  url: string;
  user: string;
  password: string;
}

/**
 * The accounts of the sites the keys come from. They go in the full backup
 * (the skipper asked for it, to carry them to another device), never in a
 * share.
 */
const ACCOUNTS_KEY = 'ldb.keyAccounts';
/** The step-by-step guides to the keys, as the skipper changed them. */
const GUIDES_KEY = 'ldb.keyGuides';

/**
 * The guides of each key, by default: where to go on its site, step by step.
 * The names of the menus of a site may change: the pencil corrects them.
 */
export const KEY_GUIDES: Readonly<Record<string, string>> = {
  mf: [
    '1. Ouvrir portail-api.meteofrance.fr et se connecter (sinon « Créer un compte », puis confirmer le mail reçu).',
    '2. Menu « APIs » : chercher « Données Publiques Observation » (DPObs) et « Souscrire » (gratuit).',
    '3. Menu « Mes API » : ouvrir « Données Publiques Observation ».',
    '4. « Générer token » : choisir « API Key » et la durée la plus longue, puis « Générer ».',
    '5. Copier la clé affichée, revenir dans NavIn › Réglages › Clés météo, la coller sous « Clé API Météo-France » et toucher Enregistrer.',
  ].join('\n'),
  aemet: [
    '1. Ouvrir opendata.aemet.es, puis « Obtención de API Key » (« Solicitar »).',
    '2. Écrire son adresse mail, cocher la case et « Enviar ».',
    '3. Ouvrir le mail d’AEMET et toucher le lien de confirmation.',
    '4. Un second mail arrive avec la clé, une longue suite de caractères.',
    '5. La copier, revenir dans NavIn › Réglages › Clés météo, la coller sous « Clé API AEMET » et toucher Enregistrer.',
  ].join('\n'),
  metoffice: [
    '1. Ouvrir datahub.metoffice.gov.uk, « Register » : créer un compte et confirmer le mail reçu.',
    '2. Dans le catalogue, ouvrir « Land Observations » et choisir l’offre gratuite (« Free », 360 appels par jour), puis « Subscribe ».',
    '3. Menu « My account » › « Subscriptions » : ouvrir l’abonnement Land Observations.',
    '4. Copier la clé (« API key ») affichée.',
    '5. Revenir dans NavIn › Réglages › Clés météo, la coller sous « Clé API Met Office » et toucher Enregistrer.',
  ].join('\n'),
};

function accounts(): Record<string, SiteAccount> {
  return store.get<Record<string, SiteAccount>>(ACCOUNTS_KEY, {});
}

function guides(): Record<string, string> {
  return store.get<Record<string, string>>(GUIDES_KEY, {});
}

/**
 * The account kept for a site.
 * @param id - The site (`mf`, `aemet`, `metoffice`…).
 * @param url - Its address, when nothing is kept yet.
 * @returns The account.
 */
export function siteAccount(id: string, url: string): SiteAccount {
  return { url, user: '', password: '', ...accounts()[id] };
}

/**
 * Keep the account of a site.
 * @param id - The site.
 * @param account - Its account.
 */
export function saveAccount(id: string, account: SiteAccount): void {
  store.set(ACCOUNTS_KEY, { ...accounts(), [id]: account });
}

/**
 * The guide to a key: the skipper's own text, else the one of NavIn.
 * @param id - The site.
 * @returns The steps, one per line.
 */
export function keyGuide(id: string): string {
  return guides()[id] ?? KEY_GUIDES[id] ?? '';
}

/**
 * Keep the guide to a key as the skipper wrote it; an empty text gives back
 * the one of NavIn.
 * @param id - The site.
 * @param text - The steps.
 */
export function saveGuide(id: string, text: string): void {
  const clean = text.trim();
  const others = Object.entries(guides()).filter(([site]) => site !== id);
  if (clean && clean !== KEY_GUIDES[id]) others.push([id, clean]);
  store.set(GUIDES_KEY, Object.fromEntries(others));
}

/** The accounts and the guides, as the full backup carries them. */
export interface KeyBook {
  accounts?: Record<string, SiteAccount>;
  guides?: Record<string, string>;
}

/**
 * What the full backup carries of the keys' sites: only what is kept.
 * @returns The accounts and the guides, or null when there is none.
 */
export function keyBook(): KeyBook | null {
  const book: KeyBook = {};
  const kept = accounts();
  if (Object.keys(kept).length > 0) book.accounts = kept;
  const written = guides();
  if (Object.keys(written).length > 0) book.guides = written;
  return book.accounts || book.guides ? book : null;
}

function isText(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * A backup brings accounts and guides: each field this device has empty is
 * filled, nothing written here is replaced.
 * @param received - The `keyBook` of the backup.
 */
export function mergeKeyBook(received: unknown): void {
  if (!received || typeof received !== 'object') return;
  const book = received as KeyBook;
  if (book.accounts && typeof book.accounts === 'object') {
    const kept = accounts();
    for (const [id, account] of Object.entries(book.accounts)) {
      if (!account || typeof account !== 'object') continue;
      const here = kept[id];
      kept[id] = {
        url: here?.url || (isText(account.url) ? account.url : ''),
        user: here?.user || (isText(account.user) ? account.user : ''),
        password:
          here?.password || (isText(account.password) ? account.password : ''),
      };
    }
    store.set(ACCOUNTS_KEY, kept);
  }
  if (book.guides && typeof book.guides === 'object') {
    const written = guides();
    for (const [id, text] of Object.entries(book.guides)) {
      if (isText(text) && text && !written[id]) written[id] = text;
    }
    store.set(GUIDES_KEY, written);
  }
}
