import { upperKeepBrands } from '../../lib/brand.ts';

import type { CardsPen } from './cardsPen.ts';
import { CARD_WIDTH, SERIF, font } from './cardsStyle.ts';

/** Texts of the card header. */
interface HeaderTexts {
  /** Main title. */
  title: string;
  /** Line under the title. */
  sub: string;
  /** Small line above the title (`mini`). */
  kicker: string;
}

/**
 * Lay out the header of the current layout; `pen.y` ends under it.
 * @param pen - Pen.
 * @param texts - Title, sub-title and kicker.
 */
export function layOutHeader(pen: CardsPen, texts: HeaderTexts): void {
  if (pen.theme === 'cards') cardsHeader(pen, texts);
  else if (pen.theme === 'carnet') carnetHeader(pen, texts);
  else miniHeader(pen, texts);
}

function cardsHeader(pen: CardsPen, { title, sub }: HeaderTexts): void {
  const { avatar, avatarHeight, context, drawing, style } = pen;
  const { margin } = style;
  const titleFont = font(50, 800);
  const lines = pen.wrap(
    title,
    titleFont,
    CARD_WIDTH - 2 * margin - 20 - pen.avatarSpace(),
  );
  const height = Math.max(
    64 + lines.length * 61 + (sub ? 46 : 0) + 40,
    avatar ? avatarHeight + 70 : 0,
  );
  if (drawing) {
    const gradient = context.createLinearGradient(0, 0, CARD_WIDTH, height);
    gradient.addColorStop(0, '#0b2e5f');
    gradient.addColorStop(1, '#1c4f9c');
    context.fillStyle = gradient;
    context.fillRect(0, 0, CARD_WIDTH, height);
    context.fillStyle = '#ffd400';
    context.fillRect(0, height, CARD_WIDTH, 8);
    context.font = font(24, 800);
    context.fillStyle = 'rgba(255,255,255,.7)';
    context.fillText('⛵ NavIn', margin, 52);
  }
  let y = 66;
  y += pen.text(lines, {
    font: titleFont,
    x: margin,
    y,
    color: '#fff',
    size: 50,
    lineHeight: 1.22,
  });
  if (sub) {
    pen.text([sub], {
      font: font(28, 500),
      x: margin,
      y: y + 8,
      color: 'rgba(255,255,255,.8)',
      size: 28,
    });
  }
  pen.drawAvatar(
    CARD_WIDTH - margin - avatarHeight,
    (height - avatarHeight) / 2,
    '#ffd400',
  );
  pen.y = height + 42;
}

function carnetHeader(pen: CardsPen, { title, sub }: HeaderTexts): void {
  const { avatar, avatarHeight, context, drawing, style } = pen;
  const { margin } = style;
  if (drawing) {
    context.save();
    context.globalAlpha = 0.07;
    context.font = font(560, 400);
    context.fillText('🧭', CARD_WIDTH - 520, 860);
    context.restore();
  }
  const titleFont = font(58, 700, SERIF);
  const width = CARD_WIDTH - 2 * margin - pen.avatarSpace();
  let y = 64;
  y += pen.text(pen.wrap(title, titleFont, width), {
    font: titleFont,
    x: margin,
    y,
    color: '#1b2a4a',
    size: 58,
    lineHeight: 1.2,
  });
  if (sub) {
    y +=
      pen.text([sub], {
        font: `italic 30px ${SERIF}`,
        x: margin + 20,
        y: y + 10,
        color: '#6b5a3a',
        size: 30,
      }) + 10;
  }
  if (avatar) {
    pen.drawAvatar(CARD_WIDTH - margin - avatarHeight, 40, '#1b2a4a');
    y = Math.max(y, 40 + avatarHeight - 20);
  }
  y += 26;
  if (drawing) {
    const left = margin - 16;
    const ruleWidth = CARD_WIDTH - 2 * margin + 32;
    context.fillStyle = '#1b2a4a';
    context.fillRect(left, y, ruleWidth, 3);
    context.fillRect(left, y + 8, ruleWidth, 3);
  }
  pen.y = y + 30;
}

function miniHeader(pen: CardsPen, { title, sub, kicker }: HeaderTexts): void {
  const { avatar, avatarHeight, context, drawing, style } = pen;
  const { margin } = style;
  let y = 70;
  if (drawing) {
    context.font = font(22, 700);
    context.fillStyle = '#1c6ef2';
    pen.spaced(upperKeepBrands(`NavIn · ${kicker}`), margin, y + 22, 4);
  }
  y += 40;
  const titleFont = font(84, 800);
  const width = CARD_WIDTH - 2 * margin - pen.avatarSpace();
  y += pen.text(pen.wrap(title, titleFont, width), {
    font: titleFont,
    x: margin,
    y,
    color: '#111',
    size: 84,
    lineHeight: 1.1,
  });
  if (sub) {
    y +=
      pen.text([sub], {
        font: font(28, 400),
        x: margin,
        y: y + 4,
        color: '#888',
        size: 28,
      }) + 6;
  }
  if (avatar) {
    pen.drawAvatar(CARD_WIDTH - margin - avatarHeight, 50, '#1c6ef2');
    y = Math.max(y, 50 + avatarHeight + 10);
  }
  pen.y = y + 24;
}
