import { useEffect, useRef, useState } from 'react';

import { store } from '../../storage/store.ts';

import { RemarkWindow } from './RemarkWindow.tsx';
import { commentsApi, requestComments, targetUnder } from './remarkContext.ts';

interface PillPosition {
  x?: number;
  y?: number;
}

interface Opened {
  target: Element | null;
  anchor: Promise<unknown> | null;
}

/**
 * The 💬 remark pill on every page (nav.js:1350-1476): dragged with the
 * finger onto the place to improve (the element under it is outlined,
 * `rem-target`), a tap opens the remark window. Position kept in `ldb.remPill`.
 * @returns The pill and its window.
 */
export function RemarkPill() {
  const [position, setPosition] = useState<PillPosition>(
    () => store.get<PillPosition>('ldb.remPill', {}) ?? {},
  );
  const [size, setSize] = useState(viewportSize);
  const [dragging, setDragging] = useState(false);
  const [opened, setOpened] = useState<Opened | null>(null);
  const reference = useRef<HTMLButtonElement>(null);
  const drag = useRef<{
    dx: number;
    dy: number;
    x0: number;
    y0: number;
    moved: boolean;
  } | null>(null);
  useEffect(() => {
    requestComments();
    const onResize = () => setSize(viewportSize());
    globalThis.addEventListener('resize', onResize);
    return () => globalThis.removeEventListener('resize', onResize);
  }, []);
  const left = Math.max(
    4,
    Math.min(size.width - 52, position.x ?? size.width - 60),
  );
  const top = Math.max(
    4,
    Math.min(size.height - 56, position.y ?? size.height - 140),
  );
  const open = () => {
    const pill = reference.current;
    const target = pill ? targetUnder(pill) : null;
    highlight(target);
    let anchor: Promise<unknown> | null = null;
    try {
      const comments = commentsApi();
      if (comments && target) {
        anchor = comments.anchorFor(target).catch(() => null);
      }
    } catch {
      anchor = null;
    }
    setOpened({ target, anchor });
  };
  return (
    <>
      <button
        type="button"
        id="remPill"
        className={
          dragging ? 'no-print no-navact rem-drag' : 'no-print no-navact'
        }
        aria-label="Faire une remarque à cet endroit"
        ref={reference}
        style={{ left: `${left}px`, top: `${top}px` }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Capture may be refused.
          }
          const box = event.currentTarget.getBoundingClientRect();
          drag.current = {
            dx: event.clientX - box.left,
            dy: event.clientY - box.top,
            x0: event.clientX,
            y0: event.clientY,
            moved: false,
          };
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start) return;
          if (
            Math.hypot(event.clientX - start.x0, event.clientY - start.y0) > 6
          ) {
            start.moved = true;
          }
          if (!start.moved) return;
          setPosition({
            x: event.clientX - start.dx,
            y: event.clientY - start.dy,
          });
          setDragging(true);
          if (reference.current) highlight(targetUnder(reference.current));
        }}
        onPointerUp={(event) => {
          const start = drag.current;
          if (!start) return;
          drag.current = null;
          setDragging(false);
          highlight(null);
          if (start.moved) {
            store.set('ldb.remPill', {
              x: event.clientX - start.dx,
              y: event.clientY - start.dy,
            });
            return;
          }
          event.stopPropagation();
          open();
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
          highlight(null);
        }}
        onClickCapture={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        💬
      </button>
      {opened ? (
        <RemarkWindow
          target={opened.target}
          anchor={opened.anchor}
          onClose={() => {
            setOpened(null);
            highlight(null);
          }}
        />
      ) : null}
    </>
  );
}

let highlighted: Element | null = null;

/**
 * Outline the element aimed at. It belongs to another component, so the
 * transient class is set directly and always removed afterwards.
 * @param element - Element to outline, or null.
 */
function highlight(element: Element | null): void {
  if (highlighted === element) return;
  highlighted?.classList.remove('rem-target');
  highlighted = element;
  element?.classList.add('rem-target');
}

function viewportSize(): { width: number; height: number } {
  return { width: globalThis.innerWidth, height: globalThis.innerHeight };
}
