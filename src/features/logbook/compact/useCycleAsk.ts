import { useEffect, useRef, useState } from 'react';

/** Phases of a protected choice. */
type CyclePhase = 'idle' | 'asking' | 'done';

/** What the long press action can do with the display. */
interface CycleDisplay {
  /** Back to the normal display. */
  restore: () => void;
  /** Keep the confirmation for `ms`, then restore. */
  confirm: (ms: number) => void;
}

/** Handlers and phase returned by {@link useCycleAsk}. */
interface CycleAsk extends CycleDisplay {
  phase: CyclePhase;
  /** Show the question for 4 s. */
  ask: () => void;
  /** The click that ends a long press must be ignored; reads and clears the mark. */
  takeLongPress: () => boolean;
  /** Spread on the button. */
  pressHandlers: {
    onPointerDown: () => void;
    onPointerUp: () => void;
    onPointerLeave: () => void;
    onPointerCancel: () => void;
  };
}

/**
 * Protected cycling choice: a first tap asks, a 650 ms press while asking runs
 * `onLongPress` (legacy `.cyc` and `.lab-cyc` handlers of `compactForm`).
 * @param onLongPress - Confirmed change.
 * @returns State and handlers.
 */
export function useCycleAsk(
  onLongPress: (display: CycleDisplay) => void,
): CycleAsk {
  const [phase, setPhase] = useState<CyclePhase>('idle');
  const press = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressed = useRef(false);
  const action = useRef(onLongPress);
  useEffect(() => {
    action.current = onLongPress;
  });
  useEffect(
    () => () => {
      clearTimeout(press.current);
      clearTimeout(timer.current);
    },
    [],
  );
  const release = () => clearTimeout(press.current);
  const restore = () => {
    clearTimeout(timer.current);
    setPhase('idle');
  };
  const confirm = (ms: number) => {
    clearTimeout(timer.current);
    setPhase('done');
    timer.current = setTimeout(() => setPhase('idle'), ms);
  };
  return {
    phase,
    ask: () => {
      clearTimeout(timer.current);
      setPhase('asking');
      timer.current = setTimeout(() => setPhase('idle'), 4000);
    },
    restore,
    confirm,
    takeLongPress: () => {
      const was = longPressed.current;
      longPressed.current = false;
      return was;
    },
    pressHandlers: {
      onPointerDown: () => {
        if (phase !== 'asking') return;
        clearTimeout(press.current);
        press.current = setTimeout(() => {
          longPressed.current = true;
          action.current({ restore, confirm });
        }, 650);
      },
      onPointerUp: release,
      onPointerLeave: release,
      onPointerCancel: release,
    },
  };
}
