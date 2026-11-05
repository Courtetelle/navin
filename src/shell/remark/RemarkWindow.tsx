import type { PointerEvent, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { toast } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import { RemarkList } from './RemarkList.tsx';
import { remarks, snippet } from './remarkContext.ts';
import { sendRemark } from './remarkSend.ts';

interface RemarkWindowProps {
  /** Element aimed at by the pill. */
  target: Element | null;
  /** Anchor prepared when opening (preview comments). */
  anchor: Promise<unknown> | null;
  onClose: () => void;
}

/**
 * The remark window (`div.ck-ask.rem-modal`, nav.js:1404-1475): the element
 * aimed at, a text area, « 📨 Envoyer à Claude », the list of my remarks; it
 * moves by dragging its title (position kept in `ldb.remWinPos`).
 * @param props - Target, prepared anchor and close action.
 * @returns The window, in a portal on `<body>`.
 */
export function RemarkWindow({ target, anchor, onClose }: RemarkWindowProps) {
  const [offset, setOffset] = useState(initialOffset);
  const [moved, setMoved] = useState(() => offset.x !== 0 || offset.y !== 0);
  const [listing, setListing] = useState(false);
  const textArea = useRef<HTMLTextAreaElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => textArea.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);
  const grip = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      drag.current = {
        x: event.clientX - offset.x,
        y: event.clientY - offset.y,
      };
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Capture may be refused.
      }
      event.preventDefault();
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const start = drag.current;
      if (!start) return;
      const next = { x: event.clientX - start.x, y: event.clientY - start.y };
      setOffset(next);
      if (Math.abs(next.x) + Math.abs(next.y) > 8) setMoved(true);
    },
    onPointerUp: () => {
      if (drag.current) store.set('ldb.remWinPos', offset);
      drag.current = null;
    },
  };
  return createPortal(
    <div
      className={
        moved
          ? 'ck-ask rem-modal no-print rem-moved'
          : 'ck-ask rem-modal no-print'
      }
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="ck-ask-box"
        style={
          offset.x || offset.y
            ? { transform: `translate(${offset.x}px, ${offset.y}px)` }
            : undefined
        }
      >
        {listing ? (
          <RemarkList onClose={onClose} />
        ) : (
          <RemarkForm
            target={target}
            anchor={anchor}
            grip={grip}
            textArea={textArea}
            onList={() => setListing(true)}
            onClose={onClose}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

interface RemarkFormProps {
  target: Element | null;
  anchor: Promise<unknown> | null;
  grip: Record<string, (event: PointerEvent<HTMLElement>) => void>;
  textArea: RefObject<HTMLTextAreaElement | null>;
  onList: () => void;
  onClose: () => void;
}

function RemarkForm({
  target,
  anchor,
  grip,
  textArea,
  onList,
  onClose,
}: RemarkFormProps) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [posted, setPosted] = useState(false);
  const send = async () => {
    const text = (textArea.current?.value ?? '').trim();
    if (!text) {
      setMessage('Écrivez d’abord la remarque.');
      return;
    }
    setBusy(true);
    const outcome = await sendRemark(text, target, anchor);
    if (outcome.toast) {
      toast(outcome.message);
      onClose();
      return;
    }
    setMessage(outcome.message);
    if (outcome.sent) setPosted(true);
    else setBusy(false);
  };
  const where = target
    ? `« ${snippet(target) || target.tagName.toLowerCase()} »`
    : 'Page entière';
  return (
    <>
      <p className="rem-handle" {...grip}>
        💬 Remarque à cet endroit{' '}
        <span className="rem-grip" aria-hidden="true">
          ✥
        </span>
      </p>
      <p className="help rem-where">{where}</p>
      <textarea
        className="text"
        id="remTxt"
        rows={4}
        maxLength={3500}
        placeholder="Ce qui doit changer ou être amélioré ici… (micro du clavier pour dicter)"
        ref={textArea}
      />
      <div className="row">
        <button
          type="button"
          className="btn big ck-pub"
          data-rem="send"
          disabled={busy}
          onClick={() => void send()}
        >
          {posted ? (
            '✓ Posée'
          ) : (
            <>
              📨 Envoyer à Claude<small>avec la page et l’endroit visé</small>
            </>
          )}
        </button>
      </div>
      <div className="row c2">
        <button type="button" className="btn" data-rem="list" onClick={onList}>
          {`📋 Mes remarques (${remarks().length})`}
        </button>
        <button
          type="button"
          className="btn"
          data-rem="close"
          onClick={onClose}
        >
          Fermer
        </button>
      </div>
      <p className="help rem-msg" id="remMsg">
        {message}
      </p>
    </>
  );
}

function initialOffset(): { x: number; y: number } {
  const saved = store.get<{ x: number; y: number } | null>(
    'ldb.remWinPos',
    null,
  );
  if (!saved || (!saved.x && !saved.y)) return { x: 0, y: 0 };
  const halfWidth = globalThis.innerWidth / 2;
  const halfHeight = globalThis.innerHeight / 2;
  return {
    x: Math.max(-halfWidth, Math.min(halfWidth, saved.x)),
    y: Math.max(-halfHeight, Math.min(halfHeight, saved.y)),
  };
}
