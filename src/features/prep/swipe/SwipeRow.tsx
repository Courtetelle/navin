import { useSignals } from '@preact/signals-react/runtime';
import type { MouseEvent, PointerEvent, ReactNode } from 'react';
import { useEffect, useId, useLayoutEffect, useRef } from 'react';

import { Button } from '../../../components/shared/Button.tsx';
import { HoldDeleteButton } from '../../../components/shared/HoldDeleteButton.tsx';
import { buzz } from '../../../lib/dom.ts';
import { toast } from '../../../state/index.ts';

import { consumeSwipedClick, startSwipe } from './swipeGesture.ts';
import { closeSwipeRow, openRowToken, openSwipeRow } from './swipeState.ts';

/** Handlers to spread on the element that slides. */
export interface SwipeHandlers {
  /** Starts following the finger. */
  onPointerDownCapture: (event: PointerEvent<HTMLElement>) => void;
  /** Swallows the click that ends a swipe. */
  onClickCapture: (event: MouseEvent<HTMLElement>) => void;
}

/** Props of {@link SwipeRow}. */
export interface SwipeRowProps {
  /** Id of the item; without one, a swipe does nothing. */
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
  /** Renders the row; spread the handlers on the element that slides. */
  children: (swipe: SwipeHandlers) => ReactNode;
}

/**
 * Delete by swipe, with a confirmation every time (prep.js:1195-1269): sliding
 * the row to the left opens « 🗑 Supprimer … ? » right after it; a long press
 * on that button deletes, « Annuler » or 5 s without a touch closes it.
 *
 * ```tsx
 * <SwipeRow id={meta.id} name={title} onDelete={removeCruise}>
 *   {(swipe) => <article className="entry" data-id={meta.id} {...swipe}>…</article>}
 * </SwipeRow>
 * ```
 *
 * For a boat, spread the handlers on the `summary`: the confirmation still
 * comes after the whole `details`.
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
  const onSwiped = () => {
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
  return (
    <>
      {children({
        onPointerDownCapture: (event) => {
          startSwipe(event.currentTarget, event, onSwiped);
        },
        onClickCapture: (event) => {
          if (!consumeSwipedClick()) return;
          event.stopPropagation();
          event.preventDefault();
        },
      })}
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
