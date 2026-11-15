import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';
import type { KeyLinkId } from '../../state/index.ts';
import { KEY_LINKS, keyLink, state } from '../../state/index.ts';

import { qrPath } from './qrPath.ts';

/** Each code stays this long before the next one. */
const EACH_MS = 2500;

/**
 * « Partager toutes les clés »: the QR code of every key saved, one after
 * the other in a loop (one code per key stays easy to read); « 📥 Importer
 * toutes les clés » on the other device reads them all in one go.
 * @returns The button and, open, the codes.
 */
export function KeyQrAll() {
  useSignals();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const alert = state.preferences.settings.value.windAlert ?? {};
  const keys = (Object.keys(KEY_LINKS) as KeyLinkId[])
    .map((id) => ({ id, value: alert[KEY_LINKS[id].setting] }))
    .filter(
      (one): one is { id: KeyLinkId; value: string } =>
        typeof one.value === 'string' && one.value !== '',
    );
  const count = keys.length;
  useEffect(() => {
    if (!open || count < 2) return undefined;
    const timer = setInterval(() => {
      setIndex((before) => (before + 1) % count);
    }, EACH_MS);
    return () => {
      clearInterval(timer);
    };
  }, [open, count]);
  const shown = keys[index % Math.max(1, count)];
  const code = useMemo(() => {
    if (!open || !shown) return null;
    const { location } = globalThis;
    return qrPath(
      keyLink(shown.id, shown.value, `${location.origin}${location.pathname}`),
    );
  }, [open, shown]);
  if (count === 0) return null;
  return (
    <div className="key-qr key-qr-all">
      <Button
        type="button"
        className="btn key-qr-btn"
        aria-expanded={open}
        onClick={() => {
          buzz();
          setIndex(0);
          setOpen(!open);
        }}
      >
        {open
          ? '📤 Masquer les QR codes'
          : `📤 Partager toutes les clés et le relais (${count})`}
      </Button>
      {code && shown ? (
        <figure className="key-qr-code">
          <b>
            {(index % count) + 1}/{count} · {KEY_LINKS[shown.id].name}
          </b>
          <svg
            viewBox={`0 0 ${code.size} ${code.size}`}
            role="img"
            aria-label={`QR code de la clé ${KEY_LINKS[shown.id].name}`}
            shapeRendering="crispEdges"
          >
            <rect width={code.size} height={code.size} />
            <path d={code.d} />
          </svg>
          <figcaption>
            Sur l’autre appareil, dans NavIn : Réglages › Clés météo › 📥
            Importer toutes les clés et le relais, et viser l’écran : les codes
            passent l’un après l’autre, chaque clé s’enregistre. Aucun réseau
            n’est utilisé.
          </figcaption>
        </figure>
      ) : null}
    </div>
  );
}
