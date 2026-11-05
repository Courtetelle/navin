import type { LxTheme } from './types.ts';

/** Width of every image card, in pixels. */
export const CARD_WIDTH = 1080;

/** Sans-serif stack of the cards. */
export const SANS =
  '-apple-system, "SF Pro Text", "Segoe UI", Roboto, Arial, sans-serif';
/** Serif stack of the cards. */
export const SERIF = 'Georgia, "Times New Roman", serif';
const MONO = '"Courier New", Courier, monospace';

/**
 * Canvas font string.
 * @param size - Size in px.
 * @param weight - Font weight.
 * @param family - Font stack.
 * @returns The `font` value.
 */
export function font(size: number, weight: number, family = SANS): string {
  return `${weight} ${size}px ${family}`;
}

/** Colours, fonts and metrics of one layout. */
export interface CardsStyle {
  /** Page background. */
  background: string;
  /** Page margin. */
  margin: number;
  /** Padding inside a card. */
  cardPadding: number;
  /** Width of the label column. */
  labelWidth: number;
  /** Font of the labels. */
  labelFont: string;
  /** Colour of the labels. */
  labelColor: string;
  /** Labels are written in upper case. */
  labelUpper: boolean;
  /** Font of the values. */
  valueFont: string;
  /** Colour of the values. */
  valueColor: string;
  /** Colour of the separators. */
  separator: string;
  /** Font of the section titles. */
  sectionFont: string;
  /** Colour of the section titles. */
  sectionColor: string;
}

/** The style of each layout. */
export const CARDS_STYLES: Readonly<Record<LxTheme, CardsStyle>> = {
  cards: {
    background: '#eef2f8',
    margin: 40,
    cardPadding: 36,
    labelWidth: 340,
    labelFont: font(21, 700),
    labelColor: '#6b7790',
    labelUpper: true,
    valueFont: font(32, 700),
    valueColor: '#0b1220',
    separator: '#e8edf5',
    sectionFont: font(26, 800),
    sectionColor: '#0b2e5f',
  },
  carnet: {
    background: '#f6efdc',
    margin: 56,
    cardPadding: 0,
    labelWidth: 330,
    labelFont: font(25, 400, MONO),
    labelColor: '#6b5a3a',
    labelUpper: false,
    valueFont: font(32, 700, SERIF),
    valueColor: '#1b2a4a',
    separator: '#b9a77f',
    sectionFont: font(28, 800, MONO),
    sectionColor: '#a3262a',
  },
  mini: {
    background: '#ffffff',
    margin: 64,
    cardPadding: 0,
    labelWidth: 0,
    labelFont: font(19, 600),
    labelColor: '#999',
    labelUpper: true,
    valueFont: font(31, 700),
    valueColor: '#111',
    separator: '#eeeeee',
    sectionFont: font(23, 800),
    sectionColor: '#1c6ef2',
  },
};
