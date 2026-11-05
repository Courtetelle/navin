import type { PointerEvent, RefObject } from 'react';
import { useRef, useState } from 'react';

import { store } from '../../storage/store.ts';
import {
  hideToast,
  restartToastTimer,
  stopToastTimer,
  toastDisplay,
} from '../toastControl.ts';

/** Offset of the bubble from its place (`ldb.toastPos`). */
export interface ToastPosition {
  x: number;
  y: number;
}

interface DragStart {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  moved: boolean;
}

/**
 * Drag the bubble with the finger; a tap closes it, a double tap (< 350 ms)
 * puts it back in place; the offset is kept for the next bubbles (nav.js:1154-1174).
 * @param reference - The bubble element.
 * @returns Position, dragging flag and pointer handlers.
 */
export function useToastDrag(reference: RefObject<HTMLDivElement | null>) {
  const [position, setPosition] = useState<ToastPosition>(
    () =>
      store.get<ToastPosition | null>('ldb.toastPos', null) ?? { x: 0, y: 0 },
  );
  const [dragging, setDragging] = useState(false);
  const start = useRef<DragStart | null>(null);
  const lastTap = useRef(0);
  const current = useRef(position);

  const place = (next: ToastPosition) => {
    current.current = next;
    setPosition(next);
  };

  const end = () => {
    const drag = start.current;
    if (!drag) return;
    start.current = null;
    setDragging(false);
    if (!drag.moved) {
      const now = Date.now();
      if (now - lastTap.current < 350) place({ x: 0, y: 0 });
      else hideToast();
      lastTap.current = now;
    }
    store.set('ldb.toastPos', current.current);
    stopToastTimer();
    if (toastDisplay.value.shown) {
      restartToastTimer(toastDisplay.value.duration || 3000);
    }
  };

  return {
    position,
    dragging,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (!toastDisplay.value.shown) return;
        start.current = {
          x: event.clientX,
          y: event.clientY,
          baseX: current.current.x,
          baseY: current.current.y,
          moved: false,
        };
        stopToastTimer();
        setDragging(true);
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Capture may be refused (pointer already released).
        }
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        const drag = start.current;
        const element = reference.current;
        if (!drag || !element) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        const next = { x: drag.baseX + dx, y: drag.baseY + dy };
        // Box once moved to `next`: the current box shifted by the offset change.
        const shown = element.getBoundingClientRect();
        const shiftX = next.x - current.current.x;
        const shiftY = next.y - current.current.y;
        const box = {
          top: shown.top + shiftY,
          bottom: shown.bottom + shiftY,
          left: shown.left + shiftX,
          right: shown.right + shiftX,
        };
        const { innerHeight, innerWidth } = globalThis;
        if (box.top < 0) next.y -= box.top;
        if (box.bottom > innerHeight) next.y -= box.bottom - innerHeight;
        if (box.left < 0) next.x -= box.left;
        if (box.right > innerWidth) next.x -= box.right - innerWidth;
        place(next);
      },
      onPointerUp: end,
      onPointerCancel: end,
    },
  };
}
