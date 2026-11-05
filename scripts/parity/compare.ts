import { createTwoFilesPatch } from 'diff';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

/**
 * Line diff of two canonical DOM texts.
 * @param legacy - Canonical DOM of the legacy app.
 * @param react - Canonical DOM of the React app.
 * @returns The unified patch and the number of changed lines.
 */
export function diffDom(
  legacy: string,
  react: string,
): { patch: string; changedLines: number } {
  if (legacy === react) return { patch: '', changedLines: 0 };
  const patch = createTwoFilesPatch('legacy', 'react', legacy, react, '', '', {
    context: 3,
  });
  let changedLines = 0;
  for (const line of patch.split('\n')) {
    if (
      (line.startsWith('+') || line.startsWith('-')) &&
      !line.startsWith('+++') &&
      !line.startsWith('---')
    ) {
      changedLines++;
    }
  }
  return { patch, changedLines };
}

/**
 * Pixel comparison of two screenshots of possibly different heights.
 * @param legacy - PNG of the legacy app.
 * @param react - PNG of the React app.
 * @returns The ratio of differing pixels and a PNG highlighting them.
 */
export function diffPixels(
  legacy: Buffer,
  react: Buffer,
): { ratio: number; image: Buffer } {
  const first = PNG.sync.read(legacy);
  const second = PNG.sync.read(react);
  const width = Math.max(first.width, second.width);
  const height = Math.max(first.height, second.height);
  const padded = [first, second].map((image) => {
    const canvas = new PNG({ width, height });
    canvas.data.fill(255);
    PNG.bitblt(image, canvas, 0, 0, image.width, image.height, 0, 0);
    return canvas;
  });
  const output = new PNG({ width, height });
  const [paddedLegacy, paddedReact] = padded as [PNG, PNG];
  const different = pixelmatch(
    paddedLegacy.data,
    paddedReact.data,
    output.data,
    width,
    height,
    { threshold: 0.1 },
  );
  return { ratio: different / (width * height), image: PNG.sync.write(output) };
}
