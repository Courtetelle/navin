import { useLayoutEffect } from 'react';

import { addNavigationListener, navigation } from '../../shell/router.ts';

/** Key (`view|h1 text`) of the screen shown, and of the one before each navigation. */
let currentKey = '';
const previousKeys = new Map<number, string>();

addNavigationListener((event) => {
  if (event.phase !== 'after') return;
  previousKeys.set(navigation.peek().id, currentKey);
  currentKey = `${event.to}|`;
  if (previousKeys.size > 50) {
    const [oldest] = previousKeys.keys();
    if (oldest !== undefined) previousKeys.delete(oldest);
  }
});

/**
 * Whether the leading `p.help` of the screen get the class `help-lead`
 * (legacy `introToast`, nav.js:110-138): only when the screen and its title
 * differ from the screen shown before.
 * @param view - Current view.
 * @param title - Text of the screen's `h1` (`''` without one).
 * @returns `true` on a fresh entry.
 */
export function useIntroLead(view: string, title: string): boolean {
  const key = `${view}|${title}`;
  const id = navigation.value.id;
  useLayoutEffect(() => {
    currentKey = key;
  }, [key]);
  return previousKeys.get(id) !== key;
}
