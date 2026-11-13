import { useSignals } from '@preact/signals-react/runtime';
import type { MouseEvent, ReactElement } from 'react';
import { createPortal } from 'react-dom';

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
  if (!kind) return null;
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
