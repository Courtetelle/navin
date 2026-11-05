import type { RefObject } from 'react';
import { useEffect } from 'react';

/**
 * Height of a text area adjusted to its text, or to its placeholder while empty
 * (legacy `fitGrow`).
 * @param area - The text area.
 */
export function fitTextarea(area: HTMLTextAreaElement): void {
  if (!area.scrollHeight) return;
  const text = area.value;
  if (!text && area.placeholder) area.value = area.placeholder;
  area.style.height = 'auto';
  area.style.height = `${area.scrollHeight}px`;
  area.value = text;
}

// A cell hidden by its propulsion rule keeps the height it will need once shown.
function fitOnceDrawn(area: HTMLTextAreaElement): void {
  const hidden: HTMLElement[] = [];
  let parent = area.parentElement?.closest<HTMLElement>('[hidden]');
  while (parent) {
    hidden.push(parent);
    parent.hidden = false;
    parent = parent.parentElement?.closest<HTMLElement>('[hidden]');
  }
  fitTextarea(area);
  for (const element of hidden) element.hidden = true;
}

/**
 * Keep a text area fitted: when shown, and each time a section opens.
 * @param reference - The text area.
 */
export function useFitTextarea(
  reference: RefObject<HTMLTextAreaElement | null>,
): void {
  useEffect(() => {
    const area = reference.current;
    if (!area) return undefined;
    const fit = () => fitTextarea(area);
    const frame = requestAnimationFrame(() => fitOnceDrawn(area));
    document.addEventListener('toggle', fit, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('toggle', fit, true);
    };
  }, [reference]);
}
