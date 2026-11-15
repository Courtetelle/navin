import { encode } from 'uqr';

/** Light modules around the code, as the scanners want them. */
const QUIET = 4;

/**
 * The drawing of a QR code: one path of its dark modules.
 * @param text - What the code holds.
 * @returns The side in modules (quiet zone included) and the path.
 */
export function qrPath(text: string): { size: number; d: string } {
  const { data, size } = encode(text, { ecc: 'L', border: QUIET });
  let d = '';
  for (const [y, row] of data.entries()) {
    for (const [x, dark] of row.entries()) {
      if (dark) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { size, d };
}
