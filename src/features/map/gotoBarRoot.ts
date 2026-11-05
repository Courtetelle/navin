import { effect } from '@preact/signals-react';
import { createElement } from 'react';

import { setBodyClass } from '../../shell/bodyClass.ts';

import { GotoBar } from './GotoBar.tsx';
import type { BodyRoot } from './bodyRoot.ts';
import { mountInBody } from './bodyRoot.ts';
import { gotoBar } from './goto.ts';

/**
 * Keep `#gotoBar` under `<body>` while a Go to is active (legacy `gotoUpdate`).
 * @returns Stops following the state.
 */
export function followGotoBar(): () => void {
  let root: BodyRoot | null = null;
  return effect(() => {
    const active = gotoBar.value !== null;
    setBodyClass('has-goto', active);
    if (active && !root) {
      const element = document.createElement('div');
      element.id = 'gotoBar';
      root = mountInBody(element, createElement(GotoBar));
    } else if (!active && root) {
      root.remove();
      root = null;
    }
  });
}
