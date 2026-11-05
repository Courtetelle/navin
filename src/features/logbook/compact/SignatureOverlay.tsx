import type { PointerEvent } from 'react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '../../../components/shared/Button.tsx';
import { buzz } from '../../../lib/dom.ts';
import { useBodyClass } from '../../../shell/bodyClass.ts';
import { toast } from '../../../state/index.ts';

import type { SignatureStroke } from './signatureImage.ts';
import { drawStrokes, signatureImage } from './signatureImage.ts';

/** Props of {@link SignatureOverlay}. */
export interface SignatureOverlayProps {
  /** Title (the field label). */
  title: string;
  /** The overlay closes. */
  onClose: () => void;
  /** The signature was validated (PNG data URL). */
  onSave: (image: string) => void;
}

/**
 * Finger signature in full screen (legacy `openSignature`): the finger can leave
 * the screen between strokes, nothing is kept before « Valider », and strokes
 * are kept in relative coordinates to survive a rotation of the phone. Once a
 * stylus was seen, a finger laid next to it is ignored.
 * @param props - Title and callbacks.
 * @returns The overlay, in `<body>`.
 */
export function SignatureOverlay({
  title,
  onClose,
  onSave,
}: SignatureOverlayProps) {
  useBodyClass('no-scroll');
  const canvas = useRef<HTMLCanvasElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const strokes = useRef<SignatureStroke[]>([]);
  const current = useRef<SignatureStroke | null>(null);
  const penSeen = useRef(false);

  const fit = () => {
    const element = canvas.current;
    const box = area.current?.getBoundingClientRect();
    const context = element?.getContext('2d');
    if (!element || !box || !context) return;
    const ratio = globalThis.devicePixelRatio || 1;
    element.width = box.width * ratio;
    element.height = box.height * ratio;
    element.style.width = `${box.width}px`;
    element.style.height = `${box.height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawStrokes(context, box.width, box.height, 4, strokes.current);
  };
  useEffect(() => {
    fit();
    globalThis.addEventListener('resize', fit);
    return () => globalThis.removeEventListener('resize', fit);
  });

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return [
      (event.clientX - box.left) / box.width,
      (event.clientY - box.top) / box.height,
    ] as const;
  };
  const end = () => {
    current.current = null;
  };
  const undo = () => {
    strokes.current.pop();
    fit();
  };
  const clear = () => {
    strokes.current.length = 0;
    fit();
  };
  const validate = () => {
    if (strokes.current.length === 0) {
      toast('Signez sur l’écran avec le doigt');
      return;
    }
    const box = area.current?.getBoundingClientRect();
    if (!box) return;
    const image = signatureImage(strokes.current, box.width, box.height);
    onClose();
    onSave(image);
  };
  return createPortal(
    <div className="sig-overlay">
      <div className="sig-top">
        <b>{title}</b>
        <small>
          Signez n’importe où sur l’écran. Tournez le téléphone pour plus de
          place.
        </small>
      </div>
      <div className="sig-area" ref={area}>
        <canvas
          ref={canvas}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            if (event.pointerType === 'pen') penSeen.current = true;
            if (penSeen.current && event.pointerType === 'touch') {
              current.current = null;
              return;
            }
            current.current = [point(event)];
            strokes.current.push(current.current);
            fit();
          }}
          onPointerMove={(event) => {
            if (!current.current) return;
            event.preventDefault();
            current.current.push(point(event));
            fit();
          }}
          onPointerUp={end}
          onPointerCancel={end}
        />
        <div className="sig-line" />
      </div>
      <div className="sig-bar">
        <Button
          className="btn"
          data-a="back"
          onClick={() => {
            buzz();
            onClose();
          }}
        >
          ◀ Retour
        </Button>
        <Button
          className="btn"
          data-a="undo"
          onClick={() => {
            buzz();
            undo();
          }}
        >
          ↶ Trait
        </Button>
        <Button
          className="btn"
          data-a="clear"
          onClick={() => {
            buzz();
            clear();
          }}
        >
          Effacer
        </Button>
        <Button
          className="btn primary"
          data-a="ok"
          onClick={() => {
            buzz();
            validate();
          }}
        >
          ✔ Valider
        </Button>
      </div>
    </div>,
    document.body,
  );
}
