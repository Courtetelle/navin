import { rollText } from './roll.ts';
import { uiEditMode } from './uiEditState.ts';

const ROLLING = '.ue-roll, .ue-roll-auto';

/**
 * Rolling texts scroll at every touch, the button action still runs
 * (ui-edit.js:128-131).
 * @returns Removes the listeners.
 */
export function installRollListeners(): () => void {
  document.addEventListener('pointerdown', rollFromEvent, {
    passive: true,
    capture: true,
  });
  document.addEventListener('pointerover', rollFromEvent, { passive: true });
  document.addEventListener('touchmove', rollUnderFinger, { passive: true });
  return removeRollListeners;
}

function removeRollListeners(): void {
  document.removeEventListener('pointerdown', rollFromEvent, { capture: true });
  document.removeEventListener('pointerover', rollFromEvent);
  document.removeEventListener('touchmove', rollUnderFinger);
}

function rollFromEvent(event: Event): void {
  if (!(event.target instanceof Element)) return;
  rollText(event.target.closest(ROLLING), uiEditMode.peek());
}

function rollUnderFinger(event: TouchEvent): void {
  const touch = event.touches[0];
  if (!touch) return;
  const element = document.elementFromPoint(touch.clientX, touch.clientY);
  rollText(element?.closest(ROLLING) ?? null, uiEditMode.peek());
}
