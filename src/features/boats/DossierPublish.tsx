import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import type { Boat } from '../../model/types.ts';
import { PubModal } from '../publish/index.ts';

import { printBoatDossier, shareBoatDossier } from './dossierOutput.tsx';

/** Props of {@link DossierPublish}. */
interface DossierPublishProps {
  /** Boat. */
  boat: Boat;
  /** Closes the window. */
  onClose: () => void;
}

/**
 * The « Publier » window of a boat sheet: image or PDF.
 * @param props - Boat and way out.
 * @returns The window.
 */
export function DossierPublish({ boat, onClose }: DossierPublishProps) {
  const [sharing, setSharing] = useState(false);
  return (
    <PubModal sub={boat.info.boat || 'Bateau'} onClose={onClose}>
      <div className="row c2">
        <Button
          type="button"
          className="btn big"
          data-dp="img"
          disabled={sharing}
          onClick={() => {
            setSharing(true);
            void shareBoatDossier(boat).finally(() => setSharing(false));
          }}
        >
          📸 Image<small>écran, WhatsApp…</small>
        </Button>
        <Button
          type="button"
          className="btn big"
          data-dp="pdf"
          onClick={() => {
            onClose();
            void printBoatDossier(boat);
          }}
        >
          🖨 PDF<small>A4, avec les documents</small>
        </Button>
      </div>
    </PubModal>
  );
}
