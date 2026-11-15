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
 * NavIn opened by the camera on the QR code of a key: the key is saved in
 * the settings, said in a bubble, and taken out of the address at once.
 * @returns Whether a key came: the tip of the start then gives way to its bubble.
 */
export function applyKeyLink(): boolean {
  const { location, history } = globalThis;
  if (!location?.hash) return false;
  const found = readKeyLink(location.hash);
  if (!found) return false;
  history.replaceState(null, '', location.pathname + location.search);
  const { setting, name } = KEY_LINKS[found.id];
  updateSettings((settings) => {
    settings.windAlert = { ...settings.windAlert, [setting]: found.key };
  });
  toast(`Clé ${name} reçue par QR code et enregistrée`);
  return true;
}
