import type { PointerEvent, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '../../components/shared/Button.tsx';
import { toast } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import { RemarkList } from './RemarkList.tsx';
import {
  commentsApi,
  pendingRemarks,
  remarks,
  targetName,
} from './remarkContext.ts';
import { copyPendingRemarks, keepRemark, sendRemark } from './remarkSend.ts';

interface RemarkWindowProps {
  /** Element aimed at by the pill. */
  target: Element | null;
  /** Anchor prepared when opening (preview comments). */
  anchor: Promise<unknown> | null;
  onClose: () => void;
}

/** A click on the backdrop this soon after opening is the opening tap. */
const OPENING_CLICK_MS = 500;

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
  const [openedAt] = useState(() => performance.now());
  return createPortal(
    <div
      className={
        moved
          ? 'ck-ask rem-modal no-print rem-moved'
          : 'ck-ask rem-modal no-print'
      }
      onClick={(event) => {
        // The click a finger makes as it lifts from the 💬 pill comes after
        // the window opened: it must not close it at once.
        if (event.timeStamp - openedAt < OPENING_CLICK_MS) return;
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
  const typed = () => (textArea.current?.value ?? '').trim();
  const keep = () => {
    const text = typed();
    if (!text) {
      setMessage('Écrivez d’abord la remarque.');
      return;
    }
    keepRemark(text, target);
    toast('Remarque gardée');
    onClose();
  };
  const copy = async () => {
    const text = typed();
    if (!text && pendingRemarks(remarks()).length === 0) {
      setMessage('Écrivez d’abord la remarque.');
      return;
    }
    if (text) keepRemark(text, target);
    try {
      const count = await copyPendingRemarks();
      toast(
        count === 1
          ? 'Remarque copiée : collez-la dans la conversation'
          : `${count} remarques copiées : collez-les dans la conversation`,
      );
    } catch {
      toast('Copie impossible ici : remarque gardée dans « Mes remarques »');
    }
    onClose();
  };
  const send = async () => {
    const text = (textArea.current?.value ?? '').trim();
    if (!text) {
      setMessage('Écrivez d’abord la remarque.');
      return;
    }
    setBusy(true);
    try {
      const outcome = await sendRemark(text, target, anchor);
      if (outcome.toast) {
        toast(outcome.message);
        onClose();
        return;
      }
      setMessage(outcome.message);
      if (outcome.sent) setPosted(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <p className="rem-handle" {...grip}>
        💬 Remarque à cet endroit{' '}
        <span className="rem-grip" aria-hidden="true">
          ✥
        </span>
      </p>
      <p className="help rem-where">{targetLabel(target)}</p>
      <textarea
        className="text"
        id="remTxt"
        rows={4}
        maxLength={3500}
        placeholder="Ce qui doit changer ou être amélioré ici… (micro du clavier pour dicter)"
        ref={textArea}
      />
      {commentsApi() ? (
        <div className="row">
          <Button
            type="button"
            className="btn big ck-pub"
            data-rem="send"
            disabled={busy || posted}
            onClick={() => void send()}
          >
            {posted ? (
              '✓ Posée'
            ) : (
              <>
                📨 Envoyer à Claude<small>avec la page et l’endroit visé</small>
              </>
            )}
          </Button>
        </div>
      ) : (
        <>
          <div className="row">
            <Button
              type="button"
              className="btn"
              data-rem="keep"
              onClick={keep}
            >
              💾 Garder pour plus tard
            </Button>
          </div>
          <div className="row">
            <Button
              type="button"
              className="btn big ck-pub"
              data-rem="copy"
              onClick={() => void copy()}
            >
              📋 Copier pour Claude
              <small>toutes les remarques en attente</small>
            </Button>
          </div>
        </>
      )}
      <div className="row c2">
        <Button type="button" className="btn" data-rem="list" onClick={onList}>
          {`📋 Mes remarques (${remarks().length})`}
        </Button>
        <Button
          type="button"
          className="btn"
          data-rem="close"
          onClick={onClose}
        >
          Fermer
        </Button>
      </div>
      <p className="help rem-msg" id="remMsg">
        {message}
      </p>
    </>
  );
}

/**
 * Name of the element aimed at, for the window.
 * @param target - Element aimed at, or null for the whole page.
 * @returns The text to show.
 */
function targetLabel(target: Element | null): string {
  if (!target) return 'Page entière';
  return `« ${targetName(target) || target.tagName.toLowerCase()} »`;
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
