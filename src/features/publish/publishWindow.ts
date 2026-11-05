import { createElement } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';

import { PublishHost } from './PublishHost.tsx';
import { keepOnly } from './listChoiceActions.ts';
import { listItems } from './listKinds.ts';
import { prepareList } from './listPublishState.ts';
import { openKind } from './publishWindowState.ts';
import type { ListKind } from './types.ts';

let host: Root | null = null;

/**
 * Open the « 📤 Publier » window of a data list. No component is needed on the
 * page: the window is a portal on `<body>`.
 * @param kind - List kind.
 * @param only - Id of the only element to keep checked (Publier from a sheet).
 */
export function openListPublish(kind: ListKind, only?: string): void {
  if (only) {
    const ids = listItems(kind).map((item) => item.id);
    if (ids.includes(only)) {
      keepOnly(
        kind,
        ids.filter((id) => id !== only),
      );
    }
  }
  prepareList(kind);
  // Its own root, detached from the page tree: the window stays open and keeps
  // its state whatever happens to the screen below it.
  host ??= createRoot(document.createElement('div'));
  host.render(createElement(PublishHost));
  openKind.value = kind;
}
