import { createElement } from 'react';

import { buzz } from '../../lib/dom.ts';
import { setBodyClass } from '../../shell/bodyClass.ts';
import { state, toast } from '../../state/index.ts';

import { NavPopBox } from './NavPopBox.tsx';
import type { BodyRoot } from './bodyRoot.ts';
import { mountInBody } from './bodyRoot.ts';

let popup: BodyRoot | null = null;

/** Close the « Naviguer » window (legacy `closeNavPop`). */
export function closeNavPop(): void {
  popup?.remove();
  popup = null;
  setBodyClass('pop-open', false);
}

/** Open the « Naviguer » window: what a navigation needs, without leaving the map (legacy `openNavPop`). */
export function openNavPop(): void {
  closeNavPop();
  if (!state.data.cruise.value) {
    toast('Démarrez d’abord une navigation');
    return;
  }
  const element = document.createElement('div');
  element.id = 'navPop';
  element.className = 'nav-pop';
  element.addEventListener('click', (event) => {
    if (event.target !== element) return;
    buzz();
    closeNavPop();
  });
  popup = mountInBody(element, createElement(NavPopBox));
  setBodyClass('pop-open', true);
}
