/** A picture ready to be drawn. */
export interface LoadedPhoto {
  /** The decoded picture (anything with natural dimensions). */
  image: HTMLImageElement;
  /** Its caption. */
  caption: string | undefined;
}

/** A line of a card with its decoded pictures. */
export interface LoadedRow {
  /** Label. */
  label: string;
  /** Value. */
  value: string;
  /** Pictures drawn under the line. */
  photos: readonly LoadedPhoto[];
}

/** A section with its decoded pictures. */
export interface LoadedSection {
  /** Section title. */
  title: string;
  /** Its lines. */
  rows: readonly LoadedRow[];
}

/** Thumbnail next to the title. */
export interface CardsAvatar {
  /** The decoded picture. */
  image: HTMLImageElement;
  /** Rectangle (boat) rather than a disc (face). */
  rectangle: boolean;
}

/** Options of {@link CardsPen.text}. */
export interface TextOptions {
  /** Font. */
  font: string;
  /** Left (or centre) of the text. */
  x: number;
  /** Top of the text. */
  y: number;
  /** Colour. */
  color: string;
  /** Font size in px. */
  size: number;
  /**
   * Line height, as a multiple of the size.
   * @default 1.28
   */
  lineHeight?: number;
  /**
   * Horizontal alignment.
   * @default 'left'
   */
  align?: CanvasTextAlign;
}
