import { createPortal } from 'react-dom';

import { Button } from '../../components/shared/Button.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { buzz } from '../../lib/dom.ts';
import { UiEditScopeContext } from '../../shell/uiEdit/scope.ts';
import { toast } from '../../state/index.ts';

/** Props of {@link PhotoAsk}. */
export interface PhotoAskProps {
  /** Number of photos of the item. */
  count: number;
  /** Deletes the photos of the item. */
  onDelete: () => void;
  /** Closes the window. */
  onClose: () => void;
}

/**
 * Question shown when a green item with photos goes back to white (legacy
 * `askPhoto`, appended to `document.body`).
 * @param props - Photos and callbacks.
 * @returns The portal.
 */
export function PhotoAsk({ count, onDelete, onClose }: PhotoAskProps) {
  const several = count > 1;
  return createPortal(
    <UiEditScopeContext value="haut">
      <div
        className="ck-ask"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className="ck-ask-box">
          <p>
            {`Ce point a ${several ? `${count} photos` : 'une photo'}. ${several ? 'Les supprimer' : 'La supprimer'} ?`}
          </p>
          <HoldDeleteButton
            className="btn big danger"
            data-ckdel="1"
            onDelete={() => {
              onDelete();
              onClose();
              toast(several ? 'Photos supprimées' : 'Photo supprimée');
            }}
          >
            {`🗑 Supprimer ${several ? 'les photos' : 'la photo'}`}
          </HoldDeleteButton>
          <Button
            className="btn big"
            data-ckkeep="1"
            onClick={() => {
              buzz();
              toast('Photo gardée');
              onClose();
            }}
          >
            {`Garder ${several ? 'les photos' : 'la photo'}`}
          </Button>
        </div>
      </div>
    </UiEditScopeContext>,
    document.body,
  );
}
