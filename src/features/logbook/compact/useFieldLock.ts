import type { MouseEvent, PointerEvent, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

import { buzz, openLink } from '../../../lib/dom.ts';
import type { FieldDefinition } from '../../../model/field.ts';
import { toast } from '../../../state/index.ts';

/** State and handlers of a protected input. */
export interface FieldLock {
  readOnly: boolean;
  /** Classes of the input. */
  classes: string[];
  handlers: {
    onPointerDown: (event: PointerEvent) => void;
    onPointerUp: () => void;
    onPointerLeave: () => void;
    onPointerCancel: () => void;
    onClick: (event: MouseEvent<HTMLInputElement>) => void;
    onContextMenu: (event: MouseEvent) => void;
  };
  /** The input lost the focus. */
  onBlur: () => void;
}

/**
 * Protected input (critical navigation value, phone or mail): once filled it is
 * read-only. A tap explains (or calls / writes), a 650 ms press opens it until
 * the focus leaves.
 * @param field - Field (`lock` or `contact`).
 * @param text - Current text.
 * @param focused - The input has the focus.
 * @param input - The input.
 * @returns Lock state and handlers.
 */
export function useFieldLock(
  field: FieldDefinition,
  text: string,
  focused: boolean,
  input: RefObject<HTMLInputElement | null>,
): FieldLock {
  const protectedField = Boolean(field.lock || field.contact);
  const filled = protectedField && text.trim() !== '';
  const [closed, setClosed] = useState(filled);
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const press = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const justOpened = useRef(false);
  useEffect(() => {
    if (!asking) return undefined;
    const timer = setTimeout(() => setAsking(false), 2500);
    return () => clearTimeout(timer);
  }, [asking]);
  useEffect(() => () => clearTimeout(press.current), []);
  if (!focused && !open && closed !== filled) setClosed(filled);

  const release = () => clearTimeout(press.current);
  const label = field.label || 'Cette donnée';
  const locked = closed && !open;
  const classes: string[] = [];
  if (locked) classes.push(field.contact ? 'contact-on' : 'locked');
  if (locked && asking) classes.push('lock-ask');
  if (open) classes.push('unlocked');
  return {
    readOnly: locked,
    classes,
    onBlur: () => setOpen(false),
    handlers: {
      onPointerDown: () => {
        if (!locked) return;
        clearTimeout(press.current);
        press.current = setTimeout(() => {
          setOpen(true);
          setAsking(false);
          justOpened.current = true;
          buzz();
          toast(`${label} : modification autorisée · relâchez puis saisissez`);
        }, 650);
      },
      onPointerUp: release,
      onPointerLeave: release,
      onPointerCancel: release,
      onContextMenu: (event) => {
        if (protectedField) event.preventDefault();
      },
      onClick: (event) => {
        if (!protectedField) return;
        if (locked && field.contact) {
          event.preventDefault();
          input.current?.blur();
          buzz();
          const value = text.trim();
          const tel = field.contact === 'tel';
          toast(
            `${tel ? 'Appel' : 'Courriel'} : ${value} · appui long pour modifier`,
          );
          openLink(
            tel ? `tel:${value.replaceAll(/[^\d+]/g, '')}` : `mailto:${value}`,
          );
        } else if (locked) {
          event.preventDefault();
          input.current?.blur();
          buzz();
          setAsking(true);
          toast(
            `${label} : donnée de navigation protégée · appui long sur la case pour la modifier · sinon la valeur reste`,
          );
        } else if (justOpened.current) {
          justOpened.current = false;
          input.current?.focus();
        }
      },
    },
  };
}
