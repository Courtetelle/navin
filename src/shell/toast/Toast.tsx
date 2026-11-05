import { useSignals } from '@preact/signals-react/runtime';
import { useLayoutEffect, useRef } from 'react';

import { language, translatable } from '../../i18n/langState.ts';
import { translateMessage } from '../../i18n/translate.ts';
import { state } from '../../state/index.ts';
import {
  setToastTop,
  showToastText,
  toastDisplay,
  toastDuration,
  toastLines,
} from '../toastControl.ts';

import { lastTouch } from './toastTouch.ts';
import { useToastDrag } from './useToastDrag.ts';

/**
 * The bubble (`#toast`): one idea per line, shown for a reading time, moved
 * under the top bar when it would cover the button just touched, dragged with
 * the finger (position kept), closed by a tap; a double tap puts it back
 * (app.js:529-557, nav.js:20-24 and 1153-1174).
 * @returns The bubble element.
 */
export function Toast() {
  useSignals();
  const request = state.view.toast.value;
  const display = toastDisplay.value;
  const reference = useRef<HTMLDivElement>(null);
  const drag = useToastDrag(reference);
  const shownId = useRef(0);

  useLayoutEffect(() => {
    if (!request || request.id === shownId.current) return;
    shownId.current = request.id;
    const message = translatable.peek()
      ? translateMessage(request.message, language.peek())
      : request.message;
    showToastText(toastLines(message), toastDuration(message), false);
  }, [request]);

  useLayoutEffect(() => {
    const element = reference.current;
    if (!element || !display.shown || display.top) return;
    if (coversLastTouch(element)) setToastTop(true);
  }, [display]);

  const classes = ['toast'];
  if (display.shown) classes.push('show');
  if (display.top) classes.push('toast-top');
  if (drag.dragging) classes.push('dragging');
  return (
    <div
      id="toast"
      className={classes.join(' ')}
      role="status"
      aria-live="polite"
      ref={reference}
      style={{ translate: `${drag.position.x}px ${drag.position.y}px` }}
      {...drag.handlers}
    >
      {display.text}
    </div>
  );
}

function coversLastTouch(element: HTMLElement): boolean {
  const touch = lastTouch();
  if (!touch || Date.now() - touch.at > 8000) return false;
  const box = element.getBoundingClientRect();
  const target =
    touch.element?.isConnected === true
      ? touch.element.getBoundingClientRect()
      : { top: touch.y - 30, bottom: touch.y + 30 };
  return target.bottom > box.top - 12 && target.top < box.bottom + 12;
}
