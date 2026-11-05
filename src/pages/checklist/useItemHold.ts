import { useEffect, useRef, useState } from 'react';

import { buzz } from '../../lib/dom.ts';

const HOLD_MS = 600;
const CLICK_AFTER_HOLD_MS = 350;

/** A press ended a long press and its release is still awaited. */
let holdFired = false;
/** When the last long press was released: its click is ignored. */
let heldAt = 0;

/** What {@link useItemHold} returns. */
export interface ItemHold {
  /** Key of the item being pressed. */
  holdingId: string | null;
  /** To call on the `pointerdown` of an item. */
  start: (id: string, action: () => void) => void;
}

/**
 * The click that follows a long press must not count as a short tap.
 * @returns `true` right after the release of a long press.
 */
export function isHoldClick(): boolean {
  return Date.now() - heldAt < CLICK_AFTER_HOLD_MS;
}

/**
 * Long press of 600 ms on a checklist item. The release is listened to on
 * `#view`, as a finger may leave the item without cancelling the press.
 * @returns The item pressed and the function starting a press.
 */
export function useItemHold(): ItemHold {
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const view = document.querySelector('#view');
    const release = () => {
      if (holdFired) {
        holdFired = false;
        heldAt = Date.now();
      }
      clearTimeout(timer.current);
      setHoldingId(null);
    };
    const events = ['pointerup', 'pointercancel', 'pointerleave'];
    for (const name of events) view?.addEventListener(name, release);
    return () => {
      for (const name of events) view?.removeEventListener(name, release);
      clearTimeout(timer.current);
    };
  }, []);
  return {
    holdingId,
    start: (id, action) => {
      setHoldingId(id);
      timer.current = setTimeout(() => {
        setHoldingId(null);
        buzz();
        holdFired = true;
        action();
      }, HOLD_MS);
    },
  };
}
