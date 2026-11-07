import { useSignals } from '@preact/signals-react/runtime';
import type { PointerEvent, ReactNode } from 'react';
import { useEffect, useId, useLayoutEffect, useRef } from 'react';

import { Button } from '../../../components/shared/Button.tsx';
import { HoldDeleteButton } from '../../../components/shared/HoldDeleteButton.tsx';
import { buzz } from '../../../lib/dom.ts';
import { toast } from '../../../state/index.ts';

import { closeSwipeRow, openRowToken, openSwipeRow } from './swipeState.ts';

/** Props of {@link SwipeRow}. */
export interface SwipeRowProps {
  /** Id of the item; without one, the row cannot be deleted. */
  id: string | null | undefined;
  /** Name shown in the confirmation button (cut to 60 characters). */
  name: string;
  /**
   * Delete the item; returning `false` keeps it, without the « Supprimé » bubble.
   * The list refreshes from the state (legacy `k.after`).
   */
  onDelete: (id: string) => boolean | void;
  /**
   * Why the item cannot be deleted: a non-empty text is shown instead of the confirmation.
   * @default undefined
   */
  block?: (id: string) => string;
  /**
   * The deletion announces itself: no « Supprimé » bubble (traces).
   * @default false
   */
  silent?: boolean;
  /** The row. */
  children: ReactNode;
}

/** Swiped this far to the left, in pixels, the row asks for its deletion. */
const SWIPE_ASK_PX = 70;
const SWIPE_MAX_PX = 110;
/** A finger moved this far has chosen a direction. */
const SWIPE_START_PX = 10;

/**
 * A row deleted by swiping it to the left, with a confirmation every time: the
 * swipe opens « 🗑 Supprimer … ? » right after the row; a long press on it
 * deletes, « Annuler » or 5 s without a touch closes it.
 * @param props - Item, deletion and row.
 * @returns The row and its confirmation.
 */
export function SwipeRow({
  id,
  name,
  onDelete,
  block,
  silent = false,
  children,
}: SwipeRowProps) {
  useSignals();
  const token = useId();
  useEffect(
    () => () => {
      if (openRowToken.peek() === token) closeSwipeRow();
    },
    [token],
  );
  const askDeletion = () => {
    if (!id) return;
    const blocked = block?.(id);
    if (blocked) {
      buzz();
      toast(blocked);
      return;
    }
    buzz();
    openSwipeRow(token);
    toast('Appui long sur « Supprimer » pour confirmer · sinon rien dans 5 s');
  };
  const slide = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; moving: boolean } | null>(
    null,
  );
  const swallowClick = useRef(false);
  const place = (shift: number, moving: boolean) => {
    const element = slide.current;
    if (!element) return;
    element.style.transform = shift ? `translateX(${shift}px)` : '';
    element.parentElement?.classList.toggle('swiping', moving);
  };
  const finish = (event: PointerEvent, cancelled: boolean) => {
    const start = gesture.current;
    gesture.current = null;
    place(0, false);
    if (!start?.moving) return;
    swallowClick.current = true;
    setTimeout(() => {
      swallowClick.current = false;
    }, 300);
    if (!cancelled && start.x - event.clientX >= SWIPE_ASK_PX) askDeletion();
  };
  return (
    <>
      <div
        className="swipe-row"
        onPointerDown={(event) => {
          const inField = (event.target as Element).closest(
            'input, textarea, select',
          );
          gesture.current =
            id && !inField
              ? { x: event.clientX, y: event.clientY, moving: false }
              : null;
        }}
        onPointerMove={(event) => {
          const start = gesture.current;
          if (!start) return;
          const left = start.x - event.clientX;
          const down = Math.abs(event.clientY - start.y);
          if (!start.moving) {
            if (down > SWIPE_START_PX && down > left) {
              gesture.current = null;
            } else if (left > SWIPE_START_PX) {
              start.moving = true;
              // The finger or the mouse may leave the row before it lifts.
              event.currentTarget.setPointerCapture(event.pointerId);
            }
            return;
          }
          place(-Math.min(SWIPE_MAX_PX, Math.max(0, left)), true);
        }}
        onPointerUp={(event) => finish(event, false)}
        onPointerCancel={(event) => finish(event, true)}
        onClickCapture={(event) => {
          if (!swallowClick.current) return;
          swallowClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <div ref={slide} className="swipe-slide">
          {children}
        </div>
      </div>
      {id && openRowToken.value === token ? (
        <SwipeConfirm
          name={name}
          onConfirm={() => {
            closeSwipeRow();
            if (onDelete(id) !== false && !silent) toast('Supprimé');
          }}
        />
      ) : null}
    </>
  );
}

interface SwipeConfirmProps {
  name: string;
  onConfirm: () => void;
}

function SwipeConfirm({ name, onConfirm }: SwipeConfirmProps) {
  const button = useRef<HTMLButtonElement>(null);
  // The row opens with its button already waiting for the long press.
  useLayoutEffect(() => {
    button.current?.click();
  }, []);
  return (
    <div className="sw-confirm">
      <HoldDeleteButton
        ref={button}
        className="btn danger"
        data-swok="1"
        armedLabel={`🗑 Supprimer « ${name.slice(0, 60)} » ?`}
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
        }}
        onDelete={onConfirm}
      />
      <Button
        className="btn"
        data-swno="1"
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          buzz();
          closeSwipeRow();
        }}
      >
        Annuler
      </Button>
    </div>
  );
}
