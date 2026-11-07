import type { RefObject } from 'react';
import { useEffect } from 'react';

import { runMarquee } from './useMarquee.ts';

const FIELDS = '.cf input, .cf textarea';
const START_DELAY_MS = 700;

/**
 * On a read-only sheet, a text longer than its field scrolls once when the sheet
 * shows and again when its field is touched: fields there take no touch themselves.
 * @param reading - The sheet is read-only.
 * @param box - What holds the fields.
 */
export function useReadingMarquee(
  reading: boolean,
  box: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const root = box.current;
    if (!reading || !root) return undefined;
    const runAll = () => {
      for (const field of root.querySelectorAll<HTMLInputElement>(FIELDS)) {
        if (field.offsetParent) runMarquee(field);
      }
    };
    const onClick = (event: MouseEvent) => {
      const cell = (event.target as Element).closest('.cf');
      const field = cell?.querySelector<HTMLInputElement>('input, textarea');
      if (field) runMarquee(field);
    };
    const timer = setTimeout(runAll, START_DELAY_MS);
    const onToggle = () => setTimeout(runAll, 50);
    root.addEventListener('click', onClick);
    root.addEventListener('toggle', onToggle, true);
    return () => {
      clearTimeout(timer);
      root.removeEventListener('click', onClick);
      root.removeEventListener('toggle', onToggle, true);
    };
  }, [reading, box]);
}
