import type { MouseEvent, PointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

/** Long press handling of the nav bar ✖ in PréP. */
interface ExitHold {
  /** The button is being held (class `holding`). */
  holding: boolean;
  /** Pointer handlers to spread on the button. */
  handlers: {
    onPointerDown: (event: PointerEvent) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onPointerLeave: () => void;
    onContextMenu: (event: MouseEvent) => void;
  };
  /**
   * Swallow the click that ends a fired long press.
   * @returns `true` when the click must be ignored.
   */
  consumeClick: (event: MouseEvent) => boolean;
}

/**
 * In PréP (has-steps mode), holding ✖ for 700 ms resets the path; a short tap
 * still exits (nav.js:1323-1336).
 * @param enabled - The bar shows the PréP steps.
 * @param onReset - Reset action.
 * @returns State and handlers for the exit button.
 */
export function useExitHold(enabled: boolean, onReset: () => void): ExitHold {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fired = useRef(false);
  const reset = useRef(onReset);
  useEffect(() => {
    reset.current = onReset;
  });
  useEffect(() => () => clearTimeout(timer.current), []);
  const stop = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    setHolding(false);
  };
  return {
    holding,
    handlers: {
      onPointerDown: () => {
        if (!enabled) return;
        fired.current = false;
        setHolding(true);
        timer.current = setTimeout(() => {
          timer.current = undefined;
          fired.current = true;
          setHolding(false);
          reset.current();
        }, 700);
      },
      onPointerUp: stop,
      onPointerCancel: stop,
      onPointerLeave: stop,
      onContextMenu: (event) => event.preventDefault(),
    },
    consumeClick: (event) => {
      if (!fired.current) return false;
      event.stopPropagation();
      event.preventDefault();
      fired.current = false;
      return true;
    },
  };
}
