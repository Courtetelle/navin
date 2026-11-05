import { capOver } from '../../lib/canvas.ts';

import { layOutBlock } from './cardsBlock.ts';
import type { CardsPen } from './cardsPen.ts';
import type { LoadedPhoto } from './cardsTypes.ts';

/**
 * Lay out the full-width pictures of the card.
 * @param pen - Pen.
 * @param photos - Pictures.
 * @param title - Title of the block.
 */
export function layOutPhotos(
  pen: CardsPen,
  photos: readonly LoadedPhoto[],
  title: string,
): void {
  if (photos.length === 0) return;
  const { drawing, innerWidth, style, theme } = pen;
  const { cardPadding, margin } = style;
  const frame = theme === 'carnet' ? 18 : 0;
  const placed = photos.map((photo) => {
    const { naturalHeight, naturalWidth } = photo.image;
    const height = Math.min(
      900,
      Math.round((naturalHeight * innerWidth) / naturalWidth),
    );
    const width = Math.round((naturalWidth * height) / naturalHeight);
    return { ...photo, width, height };
  });
  let bodyHeight = 10;
  for (const photo of placed) bodyHeight += photo.height + 2 * frame + 30;
  layOutBlock(pen, title, bodyHeight, (top) => {
    let y = top + 10;
    for (const photo of placed) {
      const x = margin + cardPadding + (innerWidth - photo.width) / 2;
      if (drawing) {
        if (theme === 'carnet') framedPhoto(pen, photo, x, y, frame);
        else clippedPhoto(pen, photo, x, y);
      }
      y += photo.height + 2 * frame + 30;
    }
  });
}

function framedPhoto(
  pen: CardsPen,
  photo: LoadedPhoto & { width: number; height: number },
  x: number,
  y: number,
  frame: number,
): void {
  const { context } = pen;
  const { image, width, height, caption } = photo;
  context.save();
  context.shadowColor = 'rgba(0,0,0,.18)';
  context.shadowBlur = 12;
  context.fillStyle = '#fff';
  context.fillRect(x - frame, y, width + 2 * frame, height + 2 * frame);
  context.restore();
  context.drawImage(image, x, y + frame, width, height);
  capOver(context, x, y + frame, width, height, caption, 30);
}

function clippedPhoto(
  pen: CardsPen,
  photo: LoadedPhoto & { width: number; height: number },
  x: number,
  y: number,
): void {
  const { context, theme } = pen;
  const { image, width, height, caption } = photo;
  context.save();
  pen.roundedRect(x, y, width, height, theme === 'cards' ? 18 : 0);
  context.clip();
  context.drawImage(image, x, y, width, height);
  capOver(context, x, y, width, height, caption, 30);
  context.restore();
}
