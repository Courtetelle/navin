import type { Signal } from '@preact/signals-react';
import { useSignal } from '@preact/signals-react';
import { useSignals } from '@preact/signals-react/runtime';
import type { ReactNode, RefObject } from 'react';
import { useLayoutEffect } from 'react';

import { rollText } from '../../shell/uiEdit/roll.ts';
import { uiEditMode } from '../../shell/uiEdit/uiEditState.ts';

/** What an element cut by the stylesheet renders. */
export interface AutoRoll {
  /** Class to add once the text overflowed (`ue-roll-auto`), kept afterwards. */
  className: string;
  /** Content, inside a `span.ue-track` while it overflows. */
  content: ReactNode;
}

/**
 * A text the stylesheet cuts with an ellipsis (`#navtop .btn`, `#prepLine
 * .pl-it`): when it overflows it goes into a ribbon that rolls once 400 ms
 * later, then at every touch (legacy `uiAutoRollAll`, ui-edit.js:82-112).
 * @param reference - The element holding the text.
 * @param text - Its text (a change measures again).
 * @param content - What the element shows.
 * @param measuredText - Text that decides the overflow, when it is not the one
 * shown: legacy measured the French label, then translated it in place.
 * @param widthKey - Changes when the room given to the element changes: the
 * text is measured again.
 * @returns Class and content to render.
 */
export function useAutoRoll(
  reference: RefObject<HTMLElement | null>,
  text: string,
  content: ReactNode,
  measuredText: string = text,
  widthKey: unknown = null,
): AutoRoll {
  useSignals();
  const overflowing = useSignal(false);
  const rolled = useSignal(false);
  useLayoutEffect(() => {
    const element = reference.current;
    if (!element) return undefined;
    const over = text.trim() !== '' && overflows(element, text, measuredText);
    write(overflowing, over);
    if (!over) return undefined;
    write(rolled, true);
    const timer = setTimeout(() => rollText(element, uiEditMode.peek()), 400);
    return () => clearTimeout(timer);
  }, [reference, text, measuredText, widthKey, overflowing, rolled]);
  return {
    className: rolled.value ? 'ue-roll-auto' : '',
    content: overflowing.value ? (
      <span className="ue-track">{content}</span>
    ) : (
      content
    ),
  };
}

function overflows(
  element: HTMLElement,
  text: string,
  measuredText: string,
): boolean {
  if (measuredText === text) return isOverflowing(element);
  // In place and restored at once: nothing is painted in between, and a copy
  // next to the element would change the width the row gives it.
  const nodes = [...element.childNodes];
  element.replaceChildren(measuredText);
  const over = isOverflowing(element);
  element.replaceChildren(...nodes);
  return over;
}

function isOverflowing(element: HTMLElement): boolean {
  return element.scrollWidth > element.clientWidth + 1;
}

function write(target: Signal<boolean>, value: boolean): void {
  target.value = value;
}
