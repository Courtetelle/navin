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

/** The two parts of a guide: the first time, then each time after. */
export type GuidePart = 'first' | 'again';

/**
 * The guides of each key, by default, in two parts: the first time (the
 * account, the subscription), then each time after (logged in, the path to
 * the key). The names of the menus of a site may change: the pencil
 * corrects them.
 */
export const KEY_GUIDES: Readonly<Record<string, Record<GuidePart, string>>> = {
  mf: {
    first: [
      '1. Ouvrir portail-api.meteofrance.fr, toucher l’icône de profil en haut à droite, puis « Créer un compte ».',
      '2. Remplir le formulaire (adresse mail, nom d’utilisateur, mot de passe) et valider.',
      '3. Ouvrir le mail de Météo-France et toucher le lien : le compte est « validé par e-mail ».',
      '4. Revenir sur le portail et se connecter (icône de profil en haut à droite).',
      '5. Dans le catalogue ou la barre de recherche, ouvrir « Données Publiques Observation » (pas la version « Paquet »).',
      '6. Toucher « Souscrire à l’API gratuitement ».',
      '7. Garder ici le nom d’utilisateur et le mot de passe (🔐 Compte Météo-France), puis suivre la 2ᵉ partie pour la clé.',
    ].join('\n'),
    again: [
      '1. Ouvrir portail-api.meteofrance.fr et se connecter (icône de profil en haut à droite).',
      '2. Menu du profil › « MES API ».',
      '3. Sur la ligne « Données Publiques Observation », toucher « Générer token ».',
      '4. Choisir « API Key » (pas « OAuth2 », qui ne dure qu’une heure).',
      '5. Durée de validité en secondes : écrire 0 (illimitée).',
      '6. Toucher « Générer token » et copier la clé tout de suite : le portail ne la remontre jamais.',
      '7. Dans NavIn › Paramétrages › Clés météo, la coller sous « Clé API Météo-France » et toucher Enregistrer : NavIn la vérifie.',
      '8. Clé perdue ou refusée : refaire les étapes 2 à 7 pour en générer une nouvelle.',
    ].join('\n'),
  },
  aemet: {
    first: [
      '1. AEMET n’a ni compte ni mot de passe : seule l’adresse mail compte, et la clé arrive par mail.',
      '2. Ouvrir opendata.aemet.es (« centrodedescargas »), cadre « Obtención de API Key » › « Solicitar ».',
      '3. Formulaire « Obtención API Key » : écrire l’adresse mail sans faute (« Email »), cocher la case de vérification (« Comprobación ») et toucher « Enviar ».',
      '4. 1ᵉʳ mail (de opendata_apikey@aemet.es) : toucher son lien dans les 5 jours pour confirmer.',
      '5. 2ᵉ mail, de la même adresse : il contient la clé, une longue suite de caractères. Garder ce mail.',
      '6. Copier la clé en entier (le premier et le dernier caractère sont souvent oubliés), puis suivre la 2ᵉ partie.',
    ].join('\n'),
    again: [
      '1. Pas de connexion : la clé est dans le 2ᵉ mail d’AEMET (de opendata_apikey@aemet.es) ; le chercher dans la messagerie.',
      '2. La copier en entier, du premier au dernier caractère.',
      '3. Dans NavIn › Paramétrages › Clés météo, la coller sous « Clé API AEMET » et toucher Enregistrer : NavIn l’essaie.',
      '4. La clé n’expire jamais. Mail perdu ou clé refusée : en redemander une avec la 1ʳᵉ partie, la même adresse mail convient.',
      '5. Pas de mail après quelques minutes : l’adresse était sans doute mal écrite, refaire la demande.',
    ].join('\n'),
  },
  metoffice: {
    first: [
      '1. Ouvrir datahub.metoffice.gov.uk et toucher « Login / Register ».',
      '2. Suivre les étapes à l’écran : écrire l’adresse mail, « Send verification code », recopier le code reçu par mail, puis choisir un mot de passe.',
      '3. Une fois connecté : menu du profil (icône en haut à droite) › « My subscriptions » › « Subscribe ».',
      '4. Choisir le produit « Land Observations » et l’offre gratuite (« Free », jusqu’à 360 appels par jour), puis « Subscribe ».',
      '5. La clé (« API key ») s’affiche juste après : la copier tout de suite, elle n’est montrée qu’une fois. La coller dans NavIn (2ᵉ partie, étape 6).',
      '6. Garder ici l’adresse mail et le mot de passe (🔐 Compte Met Office).',
    ].join('\n'),
    again: [
      '1. Ouvrir datahub.metoffice.gov.uk, « Login / Register », et se connecter.',
      '2. Mot de passe oublié : « Forgotten password », adresse mail, « Send verification code », code reçu, « Continue », puis le nouveau mot de passe deux fois.',
      '3. Menu du profil › « My subscriptions » › abonnement « Land Observations » › « Manage ».',
      '4. « API details / refresh credentials » : l’ancienne clé ne peut pas être remontrée.',
      '5. Pour une nouvelle clé : « Reset Credentials » puis « Confirm », et copier la clé affichée (l’ancienne cesse de marcher).',
      '6. Dans NavIn › Paramétrages › Clés météo, la coller sous « Clé API Met Office » et toucher Enregistrer : NavIn l’essaie.',
    ].join('\n'),
  },
  frost: {
    first: [
      '1. Frost (MET Norway) n’a ni compte ni mot de passe : seule l’adresse mail compte.',
      '2. Ouvrir frost.met.no › « Create a user » (page « requestCredentials »).',
      '3. Écrire l’adresse mail, accepter les conditions (licence CC BY 4.0) et valider.',
      '4. Le « client ID » s’affiche aussitôt et arrive aussi par mail (de frost@met.no) : une suite de lettres et de chiffres avec des tirets. Le « client secret » n’est pas utile.',
      '5. Copier le client ID en entier, puis suivre la 2ᵉ partie.',
      '6. Le relais doit être à jour : « 📋 Copier le code du relais », puis sur Cloudflare « Modifier le code », tout remplacer et « Déployer ».',
    ].join('\n'),
    again: [
      '1. Pas de connexion : le client ID est dans le mail de frost@met.no ; le chercher dans la messagerie.',
      '2. Le copier en entier.',
      '3. Dans NavIn › Paramétrages › Clés météo, le coller sous « Identifiant Frost (Norvège) » et toucher Enregistrer : NavIn l’essaie.',
      '4. Mail perdu ou identifiant refusé : en redemander un avec la 1ʳᵉ partie, la même adresse convient.',
    ].join('\n'),
  },
  relay: {
    first: [
      '1. Ouvrir dash.cloudflare.com et « Sign up » : adresse mail et mot de passe (offre gratuite « Free »), puis confirmer le mail reçu.',
      '2. Dans le menu de gauche : « Workers & Pages » (ou « Compute (Workers) ») › « Create » › « Create Worker ».',
      '3. Le nommer « navin-relay » et toucher « Deploy ».',
      '4. Dans NavIn, sous le relais : « 📋 Copier le code du relais ».',
      '5. Sur Cloudflare : « Modifier le code » (« Edit code »), tout effacer, coller le code (appui long › Coller), puis « Déployer ».',
      '6. Copier l’adresse du Worker (https://navin-relay.<compte>.workers.dev), la coller dans NavIn sous « Relais des METAR et bouées » et toucher Enregistrer : NavIn l’essaie.',
      '7. Garder ici l’adresse mail et le mot de passe (🔐 Compte Cloudflare).',
      '8. Enregistrement (le relais garde 24 h des stations, NavIn fermé, pour tous les appareils) : menu de gauche « Stockage et bases de données » (« Storage & Databases ») › « KV » › « Créer » ; le nommer « navin-past ».',
      '9. « Workers et Pages » › ouvrir « navin-relay » › onglet « Liaisons » (« Bindings ») › « Ajouter une liaison » › « Espace de noms KV » : nom de la variable NAVIN (en majuscules), espace de noms « navin-past » › « Ajouter » (ou « Déployer »).',
      '10. Même Worker › onglet « Paramètres » › « Déclencheurs » (« Trigger Events ») › « Ajouter » › « Déclencheurs Cron » : toutes les 10 minutes (ou l’expression */10 * * * *) › « Ajouter ».',
      '11. Dans NavIn, toucher Enregistrer sous le relais : l’essai dit « Enregistrement actif ».',
      '12. Météo-France enregistré NavIn fermé (facultatif) : même Worker › « Paramètres » › « Variables et secrets » (« Variables and Secrets ») › « Ajouter » › type « Secret », nom MF_KEY (en majuscules), valeur : la clé Météo-France copiée depuis le portail de Météo-France › « Déployer ». Pour l’Espagne, de même AEMET_KEY avec la clé AEMET. La clé reste chez Cloudflare comme secret : le relais ne la renvoie jamais.',
      '13. Recopier le code (étapes 4 et 5), puis toucher Enregistrer sous le relais : l’essai dit « Le relais lit lui-même : Météo-France ».',
    ].join('\n'),
    again: [
      '1. Ouvrir dash.cloudflare.com et « Log in » avec l’adresse mail et le mot de passe.',
      '2. « Workers & Pages » › ouvrir « navin-relay ».',
      '3. L’adresse est affichée sous « Domains & Routes » (ou en haut, « Visit ») : https://navin-relay.<compte>.workers.dev.',
      '4. La copier, la coller dans NavIn sous « Relais des METAR et bouées » et toucher Enregistrer.',
      '5. Relais refusé après une mise à jour de NavIn : « Modifier le code », recoller « 📋 Copier le code du relais », puis « Déployer ».',
      '6. L’offre gratuite permet 100 000 requêtes par jour, très au-delà de NavIn.',
    ].join('\n'),
  },
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
 * A part of the guide to a key: the skipper's own text, else the one of
 * NavIn.
 * @param id - The site.
 * @param part - The first time, or each time after.
 * @returns The steps, one per line.
 */
export function keyGuide(id: string, part: GuidePart): string {
  return guides()[`${id}.${part}`] ?? KEY_GUIDES[id]?.[part] ?? '';
}

/**
 * Keep a part of the guide to a key as the skipper wrote it; an empty text
 * gives back the one of NavIn.
 * @param id - The site.
 * @param part - The first time, or each time after.
 * @param text - The steps.
 */
export function saveGuide(id: string, part: GuidePart, text: string): void {
  const name = `${id}.${part}`;
  const clean = text.trim();
  const others = Object.entries(guides()).filter(([kept]) => kept !== name);
  if (clean && clean !== KEY_GUIDES[id]?.[part]) others.push([name, clean]);
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
