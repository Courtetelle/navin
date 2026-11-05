import type { MouseEvent, ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';

/** Props of {@link PubModal}. */
export interface PubModalProps {
  /**
   * Line under the head (`p.help.lx-modal-sub`); none when empty.
   * @default ''
   */
  sub?: string;
  /**
   * First line of the window.
   * @default '📤 Publier'
   */
  head?: string;
  /**
   * Keep the `pub-box` class on the box (the face framing window drops it).
   * @default true
   */
  pubBox?: boolean;
  /** The user touched outside the box or « Fermer ». */
  onClose: () => void;
  /** Content between the head and « Fermer ». */
  children: ReactNode;
}

/**
 * Small « Publier » window for what is sent outside the data lists (crew list
 * of the outing, boat dossier, face framing). Every button inside buzzes.
 * @param props - Texts, close action and content.
 * @returns The overlay, in a portal on `<body>`.
 */
export function PubModal({
  sub = '',
  head = '📤 Publier',
  pubBox = true,
  onClose,
  children,
}: PubModalProps): ReactElement {
  const onOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    } else if ((event.target as Element).closest('button')) {
      buzz();
    }
  };
  return createPortal(
    <div className="ck-ask lx-modal" onClick={onOverlayClick}>
      <div className={pubBox ? 'ck-ask-box pub-box' : 'ck-ask-box'}>
        <p>{head}</p>
        {sub ? <p className="help lx-modal-sub">{sub}</p> : null}
        {children}
        <div className="row">
          <Button
            type="button"
            className="btn"
            data-pmclose="1"
            onClick={onClose}
          >
            Fermer
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
