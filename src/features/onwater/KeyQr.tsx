import { useMemo, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import type { KeyLinkId } from '../../state/index.ts';
import { keyLink } from '../../state/index.ts';

import { qrPath } from './qrPath.ts';

/**
 * « Partager la clé »: the key as a QR code, the only way a key leaves the
 * device. The camera of the other device opens NavIn there and the key is
 * saved; no network is used.
 * @param props - Which key and the key saved.
 * @param props.id - Which key.
 * @param props.value - The key saved, empty without one.
 * @returns The button and, open, the code.
 */
export function KeyQr({ id, value }: { id: KeyLinkId; value: string }) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const code = useMemo(() => {
    if (!open || !value) return null;
    const { location } = globalThis;
    return qrPath(keyLink(id, value, `${location.origin}${location.pathname}`));
  }, [open, id, value]);
  if (!value) return null;
  return (
    <div className="key-qr">
      <Button
        className="btn key-qr-btn"
        type="button"
        aria-expanded={open}
        onClick={() => {
          buzz();
          setOpen(!open);
        }}
      >
        {tr(
          open
            ? '📤 Masquer le QR code'
            : id === 'relay'
              ? '📤 Partager l’adresse du relais'
              : '📤 Partager la clé',
        )}
      </Button>
      {code ? (
        <figure className="key-qr-code">
          <svg
            viewBox={`0 0 ${code.size} ${code.size}`}
            role="img"
            aria-label={tr('QR code de la clé')}
            shapeRendering="crispEdges"
          >
            <rect width={code.size} height={code.size} />
            <path d={code.d} />
          </svg>
          <figcaption>
            {tr(
              'Sur l’autre appareil, dans NavIn : Paramétrages › Clés météo › 📥 Importer les clés et relais disponibles, et viser ce code : la clé s’enregistre. Aucun réseau n’est utilisé.',
            )}
          </figcaption>
        </figure>
      ) : null}
    </div>
  );
}
