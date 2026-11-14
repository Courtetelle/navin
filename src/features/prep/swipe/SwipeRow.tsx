import { useSignals } from '@preact/signals-react/runtime';
import type { PointerEvent, ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '../../../components/shared/Button.tsx';
import { ShareButton } from '../../../components/shared/ShareButton.tsx';
import type { ShareFormat } from '../../../components/shared/shareFormat.ts';
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
  /**
   * 👁 Visualiser: show the item (a mark on the map…). Without it, the same as
   * a touch on the band; `null` when there is nothing to show (no button).
   * @default undefined
   */
  onView?: (() => void) | null;
  /**
   * 📤 Partager, in the format chosen; without it, no share button.
   * @default undefined
   */
  onShare?: (format: ShareFormat) => void;
  /** The row. */
  children: ReactNode;
}

/** Swiped this far to the left, in pixels, the band opens its menu. */
const SWIPE_ASK_PX = 70;
const SWIPE_MAX_PX = 110;
/** A finger moved this far has chosen a direction. */
const SWIPE_START_PX = 10;

/**
 * A band of data: swiped to the left, it opens its menu right under it,
 * 👁 Visualiser, 📤 Partager (💬 image or 🖨 PDF) and 🗑 Effacer, which deletes
 * on a long press only. The menu closes after 8 s or at a touch elsewhere.
 * @param props - Item, its actions and the band.
 * @returns The band and its menu.
 */
export function SwipeRow({
  id,
  name,
  onDelete,
  block,
  silent = false,
  onView,
  onShare,
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
  const openMenu = () => {
    if (!id) return;
    buzz();
    openSwipeRow(token);
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
    if (!cancelled && start.x - event.clientX >= SWIPE_ASK_PX) openMenu();
  };
  return (
    <>
      <div
        className="swipe-row"
        data-sw-id={id || undefined}
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
        <SwipeMenu
          name={name}
          onView={
            onView === null
              ? undefined
              : () => {
                  closeSwipeRow();
                  if (onView) {
                    onView();
                    return;
                  }
                  slide.current
                    ?.querySelector<HTMLElement>('button, summary, a[href]')
                    ?.click();
                }
          }
          onShare={
            onShare
              ? (format) => {
                  closeSwipeRow();
                  onShare(format);
                }
              : undefined
          }
          onDelete={() => {
            const blocked = block?.(id);
            if (blocked) {
              toast(blocked);
              return;
            }
            closeSwipeRow();
            if (onDelete(id) !== false && !silent) toast('Supprimé');
          }}
        />
      ) : null}
    </>
  );
}

interface SwipeMenuProps {
  name: string;
  onView: (() => void) | undefined;
  onShare: ((format: ShareFormat) => void) | undefined;
  onDelete: () => void;
}

/** A trash pressed this long deletes. */
const HOLD_MS = 650;

function SwipeMenu({ name, onView, onShare, onDelete }: SwipeMenuProps) {
  const box = useRef<HTMLDivElement>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [done, setDone] = useState(false);
  // A touch anywhere else closes the menu.
  useEffect(() => {
    const away = (event: Event) => {
      if (!box.current?.contains(event.target as Node)) closeSwipeRow();
    };
    document.addEventListener('pointerdown', away, true);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      clearTimeout(hold.current);
    };
  }, []);
  const release = () => clearTimeout(hold.current);
  return (
    <div
      ref={box}
      className="sw-confirm sw-menu"
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      {onView ? (
        <Button
          type="button"
          noUiEdit
          className="btn sw-view"
          data-swview="1"
          aria-label={`Visualiser « ${name.slice(0, 60)} »`}
          onClick={(event) => {
            event.preventDefault();
            buzz();
            onView();
          }}
        >
          👁<small>Visualiser</small>
        </Button>
      ) : null}
      {onShare ? (
        <ShareButton small className="sw-share" onShare={onShare} />
      ) : null}
      <Button
        type="button"
        noUiEdit
        className={done ? 'btn danger sw-del lp-ok' : 'btn danger sw-del'}
        data-swdel="1"
        aria-label={`Effacer « ${name.slice(0, 60)} » : appui long`}
        onClick={(event) => {
          event.preventDefault();
          if (!done) toast('Appui long sur 🗑 pour effacer');
        }}
        onPointerDown={() => {
          clearTimeout(hold.current);
          hold.current = setTimeout(() => {
            buzz();
            setDone(true);
            setTimeout(onDelete, 300);
          }, HOLD_MS);
        }}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onContextMenu={(event) => event.preventDefault()}
      >
        {done ? '✓' : '🗑'}
        <small>{done ? 'Effacé' : 'appui long'}</small>
      </Button>
    </div>
  );
}
