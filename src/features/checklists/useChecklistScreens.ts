import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import type { ModeKey } from '../../model/modes.ts';

/** The list editor (legacy `renderChecklistEdit`). */
export interface EditScreenState {
  kind: 'edit';
  /** Boat asked for, `null` for the owner of the open cruise. */
  boatId: string | null;
  list: string;
  mode: ModeKey;
}

/** A sub-screen of `checklist` or `ckbases`, drawn in place in legacy. */
export type ChecklistScreenState =
  | { kind: 'home' }
  | EditScreenState
  | { kind: 'new'; boatId: string | null; mode: ModeKey }
  | { kind: 'pick'; edit: EditScreenState }
  | { kind: 'base'; id: string };

/** What {@link useChecklistScreens} returns. */
interface ChecklistScreens {
  screen: ChecklistScreenState;
  /** Key of the screen: it changes at every {@link ChecklistScreens.show}. */
  revision: number;
  /** Draw a screen from scratch, like the legacy `innerHTML` renders. */
  show: (screen: ChecklistScreenState) => void;
}

/**
 * Sub-screen shown by a page. Every `show` remounts it (use `revision` as its
 * `key`): the fields restart from the data, a screen shows what it read when
 * drawn, and the scroll position stays.
 * @param initial - First screen.
 * @returns The screen, its key and the function drawing another one.
 */
export function useChecklistScreens(
  initial: () => ChecklistScreenState,
): ChecklistScreens {
  const [current, setCurrent] = useState(() => ({
    screen: initial(),
    revision: 0,
  }));
  const keptScroll = useRef<number | null>(null);
  const show = useCallback((screen: ChecklistScreenState) => {
    keptScroll.current = globalThis.scrollY;
    setCurrent((previous) => ({ screen, revision: previous.revision + 1 }));
  }, []);
  // React replaces the nodes one by one, and a layout forced in between clamps
  // the scroll position to the shortened page.
  useLayoutEffect(() => {
    if (keptScroll.current === null) return;
    globalThis.scrollTo(0, keptScroll.current);
    keptScroll.current = null;
  }, [current.revision]);
  return { ...current, show };
}
