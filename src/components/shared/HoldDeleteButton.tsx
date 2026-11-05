import type { MouseEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import { buzz } from '../../lib/dom.ts';
import { toast } from '../../state/index.ts';

import type { ButtonProps } from './Button.tsx';
import { Button } from './Button.tsx';

/** Props of {@link HoldDeleteButton}. */
export interface HoldDeleteButtonProps extends Omit<ButtonProps, 'onClick'> {
  /** Runs 300 ms after a confirmed long press. */
  onDelete: () => void;
  /**
   * First line shown once armed.
   * @default '🗑 Appui long pour supprimer'
   */
  armedLabel?: ReactNode;
  /**
   * Runs on every tap, before the hold logic (legacy handlers often `buzz()` and
   * `stopPropagation()` first).
   * @default undefined
   */
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}

type Phase = 'idle' | 'asking' | 'done';

/**
 * Delete confirmed by a long press (legacy `holdDel`, app.js:567-582): the
 * first tap turns the button orange (`hold-ask`) with « appui long pour
 * confirmer · sinon rien dans 5 s »; a 650 ms press shows `✓ Supprimé`
 * (`lp-ok`) and deletes 300 ms later; 5 s without a press restores it.
 * @param props - Button props, the delete action and the armed label.
 * @returns The button.
 */
export function HoldDeleteButton({
  onDelete,
  armedLabel = '🗑 Appui long pour supprimer',
  onClick,
  className = 'btn',
  children,
  ...rest
}: HoldDeleteButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const press = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const action = useRef(onDelete);
  useEffect(() => {
    action.current = onDelete;
  });
  useEffect(() => {
    if (phase !== 'asking') return undefined;
    const timer = setTimeout(() => setPhase('idle'), 5000);
    return () => clearTimeout(timer);
  }, [phase]);
  useEffect(() => () => clearTimeout(press.current), []);

  const release = () => clearTimeout(press.current);
  const classes = [className];
  if (phase === 'asking') classes.push('hold-ask');
  if (phase === 'done') classes.push('lp-ok');
  let content: ReactNode = children;
  if (phase === 'asking') {
    content = (
      <>
        {armedLabel}
        <small>appui long pour confirmer · sinon rien dans 5 s</small>
      </>
    );
  } else if (phase === 'done') {
    content = '✓ Supprimé';
  }
  return (
    <Button
      {...rest}
      className={classes.join(' ')}
      onClick={(event) => {
        onClick?.(event);
        if (phase === 'done') return;
        if (phase === 'asking') {
          buzz();
          toast('Appui long pour confirmer la suppression');
          return;
        }
        setPhase('asking');
      }}
      onPointerDown={() => {
        if (phase !== 'asking') return;
        clearTimeout(press.current);
        press.current = setTimeout(() => {
          buzz();
          setPhase('done');
          setTimeout(() => action.current(), 300);
        }, 650);
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onContextMenu={(event) => {
        if (phase !== 'idle') event.preventDefault();
      }}
    >
      {content}
    </Button>
  );
}
