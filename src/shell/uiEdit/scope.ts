import { createContext } from 'react';

import type { UiEditScope } from './uiEditKey.ts';

/** Where the buttons below sit: `view` inside the page, `haut` elsewhere. */
export const UiEditScopeContext = createContext<UiEditScope>('haut');
