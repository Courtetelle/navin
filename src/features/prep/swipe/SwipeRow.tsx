import { useSignals } from '@preact/signals-react/runtime';
import type { ReactNode } from 'react';
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
  /** Renders the row; spread the handlers on the element that slides. */
  children: ReactNode;
}

/**
 * A row with its 🗑 button, with a confirmation every time: the button opens
 * « 🗑 Supprimer … ? » right after the row; a long press on it deletes,
 * « Annuler » or 5 s without a touch closes it.
 * @param props - Item, deletion and row.
 * @returns The row, its button and its confirmation.
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
  return (
    <>
      {children}
      {id ? (
        <button
          type="button"
          className="row-delete"
          aria-label={`Supprimer ${name}`}
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            askDeletion();
          }}
        >
          🗑
        </button>
      ) : null}
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
