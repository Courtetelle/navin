import { upperKeepBrands } from '../../lib/brand.ts';

import type { CardsPen } from './cardsPen.ts';
import { CARD_WIDTH } from './cardsStyle.ts';

/**
 * Lay out a titled block of the current layout: card, stamped title or plain
 * title. `pen.y` ends under it.
 * @param pen - Pen.
 * @param title - Title, none when empty.
 * @param bodyHeight - Height of the content.
 * @param drawBody - Lays out the content from the given top.
 */
export function layOutBlock(
  pen: CardsPen,
  title: string,
  bodyHeight: number,
  drawBody: (top: number) => void,
): void {
  if (pen.theme === 'cards') cardBlock(pen, title, bodyHeight, drawBody);
  else if (pen.theme === 'carnet') stampBlock(pen, title, bodyHeight, drawBody);
  else plainBlock(pen, title, bodyHeight, drawBody);
}

function cardBlock(
  pen: CardsPen,
  title: string,
  bodyHeight: number,
  drawBody: (top: number) => void,
): void {
  const { context, drawing, style, y } = pen;
  const { margin, cardPadding, sectionFont, sectionColor } = style;
  const titleLines = title
    ? pen.wrap(upperKeepBrands(title), sectionFont, pen.innerWidth)
    : [];
  const titleHeight = titleLines.length > 0 ? titleLines.length * 34 + 18 : 0;
  const height = cardPadding + titleHeight + bodyHeight + cardPadding - 8;
  if (drawing) {
    const width = CARD_WIDTH - 2 * margin;
    context.save();
    context.shadowColor = 'rgba(11,18,32,.10)';
    context.shadowBlur = 18;
    context.shadowOffsetY = 4;
    pen.roundedRect(margin, y, width, height, 28);
    context.fillStyle = '#fff';
    context.fill();
    context.restore();
    pen.roundedRect(margin, y, width, height, 28);
    context.strokeStyle = '#dfe5ef';
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = '#5b8def';
    pen.roundedRect(margin + cardPadding, y + 12, 56, 7, 4);
    context.fill();
    context.font = sectionFont;
    context.fillStyle = sectionColor;
    for (const [index, line] of titleLines.entries()) {
      const baseline = y + cardPadding + 26 + index * 34;
      pen.spaced(line, margin + cardPadding, baseline, 1.5);
    }
  }
  drawBody(y + cardPadding + titleHeight);
  pen.y = y + height + 26;
}

function stampBlock(
  pen: CardsPen,
  title: string,
  bodyHeight: number,
  drawBody: (top: number) => void,
): void {
  const { context, drawing, style } = pen;
  const { margin, sectionFont, sectionColor } = style;
  let y = pen.y + 30;
  if (title) {
    context.font = sectionFont;
    const upper = upperKeepBrands(title);
    let width = 0;
    for (const letter of upper) width += context.measureText(letter).width + 3;
    width += 36;
    if (drawing) {
      context.save();
      context.translate(margin + width / 2, y + 28);
      context.rotate(-0.035);
      context.strokeStyle = sectionColor;
      context.lineWidth = 4;
      context.strokeRect(-width / 2, -28, width, 56);
      context.fillStyle = sectionColor;
      context.font = sectionFont;
      pen.spaced(upper, -width / 2 + 18, 10, 3);
      context.restore();
    }
    y += 76;
  }
  drawBody(y);
  pen.y = y + bodyHeight;
}

function plainBlock(
  pen: CardsPen,
  title: string,
  bodyHeight: number,
  drawBody: (top: number) => void,
): void {
  const { context, drawing, style } = pen;
  const { margin, sectionColor, sectionFont } = style;
  let y = pen.y + 30;
  if (title) {
    if (drawing) {
      context.font = sectionFont;
      context.fillStyle = sectionColor;
      pen.spaced(upperKeepBrands(title), margin, y + 23, 3);
    }
    y += 40;
  }
  drawBody(y);
  pen.y = y + bodyHeight;
}
