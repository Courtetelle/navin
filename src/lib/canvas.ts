import { textOf } from './format.ts';

/**
 * Write a caption inside the bottom of a picture, in a colour contrasting
 * with it: black on a white veil over a light picture, white on a black veil
 * otherwise (legacy `capOver`). At most three lines.
 * @param context - Canvas 2D context.
 * @param x - Left of the picture.
 * @param y - Top of the picture.
 * @param width - Width of the picture.
 * @param height - Height of the picture.
 * @param text - Caption.
 * @param fontSize - Font size in px (default width / 26, at least 12).
 */
export function capOver(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  text: unknown,
  fontSize?: number,
): void {
  const caption = textOf(text).trim();
  if (!caption || width < 40 || height < 40) return;
  const size = Math.max(12, Math.round(fontSize || width / 26));
  const lightness = bottomLightness(context, x, y, width, height);
  const light = lightness > 0.58;
  const padding = Math.round(size * 0.55);
  context.save();
  context.font = `700 ${size}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  const maxWidth = width - 2 * padding;
  const lines: string[] = [];
  let line = '';
  for (const word of caption.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  if (lines.length > 3) {
    lines.length = 3;
    lines[2] = (lines[2] as string).replace(/.{0,2}$/, '…');
  }
  const boxHeight = lines.length * size * 1.25 + 2 * padding;
  context.fillStyle = light ? 'rgba(255,255,255,.62)' : 'rgba(0,0,0,.5)';
  context.fillRect(x, y + height - boxHeight, width, boxHeight);
  context.fillStyle = light ? '#0b1220' : '#ffffff';
  context.textAlign = 'center';
  context.textBaseline = 'top';
  for (const [position, value] of lines.entries()) {
    context.fillText(
      value,
      x + width / 2,
      y + height - boxHeight + padding + position * size * 1.25,
      maxWidth,
    );
  }
  context.restore();
}

function bottomLightness(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  try {
    const stripe = Math.max(4, Math.round(height * 0.22));
    const pixels = context.getImageData(
      Math.round(x),
      Math.round(y + height - stripe),
      Math.max(1, Math.round(width)),
      stripe,
    ).data;
    let sum = 0;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 16) {
      sum +=
        0.2126 * (pixels[index] as number) +
        0.7152 * (pixels[index + 1] as number) +
        0.0722 * (pixels[index + 2] as number);
      count++;
    }
    return count ? sum / count / 255 : 0.3;
  } catch {
    // Protected (cross-origin) picture: white text.
    return 0.3;
  }
}
