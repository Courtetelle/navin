import { updateSettings } from './preferences.ts';
import { toast } from './toast.ts';

/**
 * The API keys that can go from one device to another, by a QR code only:
 * the code holds a link to NavIn with the key after the `#` (never sent to
 * the server), read by the camera of the other device.
 */
export const KEY_LINKS = {
  mf: { setting: 'mfKey', name: 'Météo-France' },
  aemet: { setting: 'aemetKey', name: 'AEMET' },
  metoffice: { setting: 'metOfficeKey', name: 'Met Office' },
  frost: { setting: 'frostKey', name: 'MET Norway (Frost)' },
  relay: { setting: 'relayUrl', name: 'Relais des METAR' },
} as const;

/** A key that can go in a QR code. */
export type KeyLinkId = keyof typeof KEY_LINKS;

/** The part of the address that holds a key. */
const MARK = '#cle=';

/**
 * The link a QR code holds for a key.
 * @param id - Which key.
 * @param key - The key.
 * @param page - Address of NavIn, without its `#`.
 * @returns The link.
 */
export function keyLink(id: KeyLinkId, key: string, page: string): string {
  return `${page}${MARK}${id}.${encodeURIComponent(key)}`;
}

/**
 * The key a link brings, when it holds one.
 * @param hash - The `#…` of the address.
 * @returns Which key and the key, or null.
 */
export function readKeyLink(
  hash: string,
): { id: KeyLinkId; key: string } | null {
  if (!hash.startsWith(MARK)) return null;
  const body = hash.slice(MARK.length);
  const dot = body.indexOf('.');
  const id = body.slice(0, dot);
  if (dot < 1 || !Object.hasOwn(KEY_LINKS, id)) return null;
  let key = '';
  try {
    key = decodeURIComponent(body.slice(dot + 1)).trim();
  } catch {
    return null;
  }
  return key ? { id: id as KeyLinkId, key } : null;
}

/**
 * Save the key a link brings (the text of its QR code).
 * @param text - The link.
 * @returns The name of the network of the key saved, or null.
 */
export function saveKeyLink(text: string): string | null {
  let hash = '';
  try {
    hash = new URL(text).hash;
  } catch {
    return null;
  }
  const found = readKeyLink(hash);
  if (!found) return null;
  const { setting, name } = KEY_LINKS[found.id];
  updateSettings((settings) => {
    settings.windAlert = { ...settings.windAlert, [setting]: found.key };
  });
  return name;
}

/**
 * NavIn opened by the camera on the QR code of a key: the key is saved in
 * the settings, said in a bubble, and taken out of the address at once. In
 * Safari of an iPhone, NavIn of the home screen keeps its own settings: the
 * bubble says to read the code from NavIn itself.
 * @returns Whether a key came: the tip of the start then gives way to its bubble.
 */
export function applyKeyLink(): boolean {
  const { location, history, navigator } = globalThis;
  if (!location?.hash || !readKeyLink(location.hash)) return false;
  const name = saveKeyLink(location.href);
  history.replaceState(null, '', location.pathname + location.search);
  const safari = (navigator as { standalone?: boolean }).standalone === false;
  toast(
    safari
      ? `Clé ${name} reçue dans Safari. Pour NavIn de l’écran d’accueil : y ouvrir Paramétrages › Clés météos et compte relais › 📥 Importer les clés et relais disponibles`
      : `Clé ${name} reçue par QR code et enregistrée`,
  );
  return true;
}
