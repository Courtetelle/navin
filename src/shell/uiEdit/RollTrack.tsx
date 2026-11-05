import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { rollText } from './roll.ts';
import { uiEditMode } from './uiEditState.ts';

/**
 * The scrolling ribbon of a « déroulant » button (`span.ue-track`): it rolls
 * once 400 ms after it appears (ui-edit.js:61, 64-70).
 * @param props - Button content.
 * @returns The track.
 */
export function RollTrack({ children }: { children: ReactNode }) {
  const reference = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        rollText(reference.current?.parentElement ?? null, uiEditMode.peek()),
      400,
    );
    return () => clearTimeout(timer);
  }, []);
  return (
    <span className="ue-track" ref={reference}>
      {children}
    </span>
  );
}
