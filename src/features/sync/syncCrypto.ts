/**
 * The encryption of the synchronisation: AES-256-GCM with the cryptography
 * of the browser. The key is drawn on the first device and goes to the
 * others only by QR code; the relay keeps what it cannot read.
 */

const { subtle } = globalThis.crypto;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** First characters of a text sealed by this version. */
const SEALED = 'v1.';
/** Bytes of the random start of each sealed text (the GCM nonce). */
const IV_BYTES = 12;

/**
 * A new key: 32 random bytes, written in base64url (43 characters).
 * @returns The key.
 */
export function newSyncKey(): string {
  return toBase64(globalThis.crypto.getRandomValues(new Uint8Array(32)), true);
}

/**
 * The key is one of NavIn: 32 bytes in base64url.
 * @param key - A text.
 * @returns Whether it is.
 */
export function isSyncKey(key: unknown): key is string {
  return typeof key === 'string' && /^[\w-]{43}$/u.test(key);
}

/**
 * The key as the browser uses it.
 * @param key - The key.
 * @returns The key for AES-GCM.
 */
export async function aesKey(key: string): Promise<CryptoKey> {
  return subtle.importKey('raw', fromBase64(key), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * A name made from the key, that says nothing of it: the space of the
 * relay (64 hex), or a photo (40 hex).
 * @param key - The key.
 * @param what - What is named.
 * @param length - Hex characters kept.
 * @returns The name.
 */
export async function hashName(
  key: string,
  what: string,
  length = 64,
): Promise<string> {
  const digest = await subtle.digest(
    'SHA-256',
    encoder.encode(`navin-sync:${what}:${key}`),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length);
}

/**
 * Compress, then encrypt a text.
 * @param key - The AES key.
 * @param text - The text.
 * @returns `v1.` and the nonce and the cipher in base64.
 */
export async function seal(key: CryptoKey, text: string): Promise<string> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const packed = await squeeze(encoder.encode(text), 'gzip');
  const cipher = new Uint8Array(
    await subtle.encrypt({ name: 'AES-GCM', iv }, key, packed),
  );
  const whole = new Uint8Array(IV_BYTES + cipher.length);
  whole.set(iv);
  whole.set(cipher, IV_BYTES);
  return SEALED + toBase64(whole);
}

/**
 * Decrypt, then decompress a sealed text.
 * @param key - The AES key.
 * @param sealed - What {@link seal} gave.
 * @returns The text.
 * @throws When the key is not the one, or the text was changed on the way.
 */
export async function unseal(key: CryptoKey, sealed: string): Promise<string> {
  if (!sealed.startsWith(SEALED)) throw new Error('not sealed by NavIn');
  const whole = fromBase64(sealed.slice(SEALED.length));
  const packed = await subtle.decrypt(
    { name: 'AES-GCM', iv: whole.slice(0, IV_BYTES) },
    key,
    whole.slice(IV_BYTES),
  );
  return decoder.decode(await squeeze(new Uint8Array(packed), 'gunzip'));
}

async function squeeze(
  bytes: Uint8Array,
  way: 'gzip' | 'gunzip',
): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(
      way === 'gzip'
        ? new CompressionStream('gzip')
        : new DecompressionStream('gzip'),
    );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Bytes turned into text a piece at a time (a big photo stays in memory once). */
const CHUNK = 0x80_00;

function toBase64(bytes: Uint8Array, url = false): string {
  let binary = '';
  for (let at = 0; at < bytes.length; at += CHUNK) {
    binary += String.fromCodePoint(...bytes.subarray(at, at + CHUNK));
  }
  const text = btoa(binary);
  return url
    ? text.replaceAll('+', '-').replaceAll('/', '_').replace(/[=]+$/u, '')
    : text;
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const plain = text.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(plain + '='.repeat((4 - (plain.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let at = 0; at < binary.length; at++) {
    bytes[at] = binary.codePointAt(at) ?? 0;
  }
  return bytes;
}
