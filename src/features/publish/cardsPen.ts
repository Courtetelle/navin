import type { CardsStyle } from './cardsStyle.ts';
import { CARDS_STYLES, CARD_WIDTH } from './cardsStyle.ts';
import type { CardsAvatar, LoadedPhoto, TextOptions } from './cardsTypes.ts';
import type { LxTheme } from './types.ts';

/** Display size of a picture under a line. */
interface RowPhotoSize {
  image: HTMLImageElement;
  width: number;
  height: number;
}

/**
 * Canvas helpers shared by the card layouts. A pen runs the same layout twice:
 * first without drawing to measure the height, then for real (`drawing`).
 */
export class CardsPen {
  /** Canvas context. */
  public readonly context: CanvasRenderingContext2D;
  /** Layout. */
  public readonly theme: LxTheme;
  /** Style of the layout. */
  public readonly style: CardsStyle;
  /** Width available inside a card. */
  public readonly innerWidth: number;
  /** Thumbnail next to the title. */
  public readonly avatar: CardsAvatar | null;
  /** Width of the thumbnail box. */
  public readonly avatarWidth: number;
  /** Height of the thumbnail box. */
  public readonly avatarHeight: number;
  /** Drawing, rather than measuring. */
  public drawing = false;
  /** Current vertical position. */
  public y = 0;

  /**
   * @param context - Canvas context.
   * @param theme - Layout.
   * @param avatar - Thumbnail next to the title.
   */
  public constructor(
    context: CanvasRenderingContext2D,
    theme: LxTheme,
    avatar: CardsAvatar | null,
  ) {
    this.context = context;
    this.theme = theme;
    this.style = CARDS_STYLES[theme];
    this.innerWidth =
      CARD_WIDTH - 2 * this.style.margin - 2 * this.style.cardPadding;
    this.avatar = avatar;
    this.avatarHeight = avatar?.rectangle ? 160 : 180;
    this.avatarWidth = avatar?.rectangle ? 240 : this.avatarHeight;
  }

  /**
   * Room the thumbnail takes from the title.
   * @returns Thumbnail width and its gap, or 0 without a thumbnail.
   */
  public avatarSpace(): number {
    return this.avatar ? this.avatarWidth + 30 : 0;
  }

  /**
   * Split a text into lines fitting a width (`\n` breaks a line).
   * @param value - Text.
   * @param lineFont - Font it will be written with.
   * @param maxWidth - Width available.
   * @returns The lines.
   */
  public wrap(value: unknown, lineFont: string, maxWidth: number): string[] {
    const { context } = this;
    context.font = lineFont;
    const lines: string[] = [];
    for (const paragraph of String(value).split('\n')) {
      let line = '';
      for (const word of paragraph.split(' ')) {
        const candidate = line ? `${line} ${word}` : word;
        if (context.measureText(candidate).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  /**
   * Write lines.
   * @param lines - Lines of text.
   * @param options - Font, position, colour and metrics.
   * @returns Height of the block.
   */
  public text(lines: readonly string[], options: TextOptions): number {
    const { font, x, y, color, size, lineHeight = 1.28, align } = options;
    if (this.drawing) {
      const { context } = this;
      context.font = font;
      context.fillStyle = color;
      context.textAlign = align ?? 'left';
      for (const [index, line] of lines.entries()) {
        context.fillText(line, x, y + size + index * size * lineHeight);
      }
      context.textAlign = 'left';
    }
    return lines.length * size * lineHeight;
  }

  /**
   * Write a text letter by letter with extra spacing, in the current font.
   * @param value - Text.
   * @param left - Left of the text.
   * @param y - Baseline.
   * @param gap - Extra space after each letter.
   */
  public spaced(value: string, left: number, y: number, gap: number): void {
    const { context } = this;
    let x = left;
    for (const letter of value) {
      context.fillText(letter, x, y);
      x += context.measureText(letter).width + gap;
    }
  }

  /**
   * Trace a rounded rectangle as the current path.
   * @param x - Left.
   * @param y - Top.
   * @param width - Width.
   * @param height - Height.
   * @param radius - Corner radius.
   */
  public roundedRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void {
    const { context } = this;
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + width, y, x + width, y + height, radius);
    context.arcTo(x + width, y + height, x, y + height, radius);
    context.arcTo(x, y + height, x, y, radius);
    context.arcTo(x, y, x + width, y, radius);
    context.closePath();
  }

  /**
   * Draw the thumbnail with its ring.
   * @param right - Left of the square box; a rectangle grows to the left of it.
   * @param y - Top.
   * @param ring - Ring colour.
   */
  public drawAvatar(right: number, y: number, ring: string): void {
    const { avatar, avatarHeight, avatarWidth, context, drawing } = this;
    if (!avatar || !drawing) return;
    const x = right - (avatarWidth - avatarHeight);
    context.save();
    this.traceAvatar(x, y);
    if (!avatar.rectangle) context.closePath();
    context.clip();
    context.drawImage(avatar.image, x, y, avatarWidth, avatarHeight);
    context.restore();
    this.traceAvatar(x, y);
    context.lineWidth = 6;
    context.strokeStyle = ring;
    context.stroke();
  }

  /**
   * Height of the pictures under a line.
   * @param photos - Pictures.
   * @param width - Width available.
   * @returns The height, 0 without pictures.
   */
  public rowPhotosHeight(
    photos: readonly LoadedPhoto[],
    width: number,
  ): number {
    let height = photos.length > 0 ? 6 : 0;
    for (const size of rowPhotoSizes(photos, width)) height += size.height + 14;
    return height;
  }

  /**
   * Draw the pictures under a line.
   * @param photos - Pictures.
   * @param x - Left.
   * @param top - Top.
   * @param width - Width available.
   */
  public drawRowPhotos(
    photos: readonly LoadedPhoto[],
    x: number,
    top: number,
    width: number,
  ): void {
    const { context, drawing, theme } = this;
    let y = top + 6;
    for (const size of rowPhotoSizes(photos, width)) {
      if (drawing) {
        context.save();
        const radius = theme === 'mini' ? 0 : 14;
        this.roundedRect(x, y, size.width, size.height, radius);
        context.clip();
        context.drawImage(size.image, x, y, size.width, size.height);
        context.restore();
      }
      y += size.height + 14;
    }
  }

  private traceAvatar(x: number, y: number): void {
    const { avatar, context, avatarWidth, avatarHeight } = this;
    if (avatar?.rectangle) {
      this.roundedRect(x, y, avatarWidth, avatarHeight, 16);
    } else {
      const radius = avatarHeight / 2;
      context.beginPath();
      context.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
    }
  }
}

function rowPhotoSizes(
  photos: readonly LoadedPhoto[],
  maxWidth: number,
): RowPhotoSize[] {
  const sizes: RowPhotoSize[] = [];
  for (const { image } of photos) {
    let width = Math.min(maxWidth, image.naturalWidth * 4);
    let height = Math.round((image.naturalHeight * width) / image.naturalWidth);
    if (height > 620) {
      height = 620;
      width = Math.round((image.naturalWidth * height) / image.naturalHeight);
    }
    sizes.push({ image, width, height });
  }
  return sizes;
}
