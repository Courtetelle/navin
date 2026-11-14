import { useSignals } from '@preact/signals-react/runtime';
import type { MouseEvent, ReactElement } from 'react';
import { createPortal } from 'react-dom';

import { buzz } from '../../lib/dom.ts';
import { useRails } from '../../lib/useWide.ts';

import { ListPublishBox } from './ListPublishBox.tsx';
import { LIST_TITLES } from './listKinds.ts';
import { closeListPublish, openKind } from './publishWindowState.ts';

/**
 * The Partager window of the open list, in a portal on `<body>`.
 * @returns The overlay, or null when no window is open.
 */
export function PublishHost(): ReactElement | null {
  useSignals();
  const kind = openKind.value;
  const rails = useRails();
  if (!kind) return null;
  if (rails) {
    // The screens with the buttons around the map: a page as the lists, its
    // fixed title line (◀ back to the list), scrolling between the buttons.
    return createPortal(
      <div className="lx-page" data-lx-page={kind}>
        <div className="lx-page-head">
          <button
            type="button"
            className="btn lx-page-back"
            aria-label="Retour à la liste"
            onClick={() => {
              buzz();
              closeListPublish();
            }}
          />
          <h1>{`📤 ${LIST_TITLES[kind]}`}</h1>
        </div>
        <div className="lx-page-body pub-box">
          <ListPublishBox kind={kind} />
        </div>
      </div>,
      document.body,
    );
  }
  return createPortal(
    <div className="ck-ask lx-modal" onClick={closeOnOverlay}>
      <div className="ck-ask-box pub-box">
        <p>📤 Partager</p>
        <p className="help lx-modal-sub">{LIST_TITLES[kind]}</p>
        <ListPublishBox kind={kind} />
      </div>
    </div>,
    document.body,
  );
}

function closeOnOverlay(event: MouseEvent<HTMLDivElement>): void {
  if (event.target === event.currentTarget) closeListPublish();
}
