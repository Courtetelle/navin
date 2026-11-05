/**
 * Hash of the password that protects the SOS logs against a deletion by
 * mistake (legacy `sosHash`): SHA-256 of `navin-sos:<password>`, or a simple
 * hash where Web Crypto is missing (plain HTTP).
 * @param password - Password.
 * @returns The hexadecimal hash.
 */
export async function sosHash(password: string): Promise<string> {
  const text = `navin-sos:${password}`;
  try {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(text),
    );
    const bytes = new DataView(digest);
    let hex = '';
    for (let index = 0; index < bytes.byteLength; index++) {
      hex += bytes.getUint8(index).toString(16).padStart(2, '0');
    }
    return hex;
  } catch {
    return fallbackHash(text);
  }
}

/**
 * The hash used where Web Crypto is missing.
 * @param text - Salted password.
 * @returns `d` and the hexadecimal hash.
 */
export function fallbackHash(text: string): string {
  let hash = 5381;
  for (const character of text) {
    hash = ((hash * 33) ^ (character.codePointAt(0) as number)) >>> 0;
  }
  return `d${hash.toString(16)}`;
}
