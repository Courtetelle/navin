import { useTr } from '../../i18n/useTr.ts';

/** Translates a text node of the box. */
export type BoxTr = (text: string, options?: { help?: boolean }) => string;

function keepText(text: string): string {
  return text;
}

/**
 * Translation of the « En navigation » box: legacy translated `#view` only, so
 * the same box stays in French in the map's window.
 * @param inPopup - The box is outside `#view`.
 * @returns The translation function.
 */
export function useBoxTr(inPopup: boolean): BoxTr {
  const tr = useTr();
  return inPopup ? keepText : tr;
}
