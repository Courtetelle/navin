import { signal } from '@preact/signals-react';
import { useSignals } from '@preact/signals-react/runtime';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';

import type { NavTarget } from './navBarState.ts';
import {
  backTargets,
  firstInDocument,
  navBarShown,
  newTargetId,
  pageBackTarget,
  validateTargets,
} from './navBarState.ts';

/** Props of the page buttons relayed by the nav bar. */
export interface PageNavButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick' | 'children'
> {
  /** Legacy text of the button (`◀ Équipages`, `✔ Terminé`, `✔ Valider`…), shown when no children. */
  label: string;
  /** Action of the button (also run by the nav bar). */
  onClick: () => void;
  /**
   * Content when it is richer than the label (a `<small>`…); the label still names it.
   * @default undefined
   */
  children?: ReactNode;
}

/**
 * The page's own « ◀ word » button (legacy `pageBack`, nav.js:38): the nav bar
 * back button shows its text and runs it; when it is a direct child of
 * `#view` before any heading or section, it gets `nav-dup` (hidden by the CSS,
 * the nav bar replaces it).
 * @param props - Button props.
 * @returns The page button.
 */
export function PageBack(props: PageNavButtonProps) {
  return <RelayedButton kind="back" {...props} />;
}

/**
 * A `✔ Terminé` page button: the nav bar back button reads `✔ Terminé` and runs
 * it when the page has no `◀` button.
 * @param props - Button props.
 * @returns The page button.
 */
export function PageDone(props: PageNavButtonProps) {
  return <RelayedButton kind="done" {...props} />;
}

/**
 * A page « Valider » button (nav.js:1252): it moves up into the green ✔ of the
 * nav bar (classes `nav-dup ok-up`) and the ✔ runs it.
 * @param props - Button props.
 * @returns The page button.
 */
export function PageValidate(props: PageNavButtonProps) {
  return <RelayedButton kind="validate" {...props} />;
}

interface RelayedButtonProps extends PageNavButtonProps {
  kind: 'back' | 'done' | 'validate';
}

/** Ids of the relayed buttons that carry `nav-dup`. */
const duplicates = signal<ReadonlySet<number>>(new Set());

function RelayedButton({
  kind,
  label,
  onClick,
  children,
  className = 'btn',
  disabled,
  ...rest
}: RelayedButtonProps) {
  useSignals();
  const reference = useRef<HTMLButtonElement>(null);
  const [id] = useState(newTargetId);
  const action = useRef(onClick);
  useLayoutEffect(() => {
    action.current = onClick;
  });
  useLayoutEffect(() => {
    if (kind === 'validate' && disabled) return undefined;
    const target: NavTarget = {
      id,
      label,
      onClick: () => action.current(),
      element: () => reference.current,
    };
    if (kind === 'validate') {
      validateTargets.value = [...validateTargets.value, target];
    } else {
      backTargets.value = [...backTargets.value, { ...target, kind }];
    }
    return () => {
      validateTargets.value = validateTargets.value.filter(
        (item) => item.id !== id,
      );
      backTargets.value = backTargets.value.filter((item) => item.id !== id);
    };
  }, [id, kind, label, disabled]);
  const shown = navBarShown.value;
  const selected =
    kind === 'validate'
      ? firstInDocument(validateTargets.value)?.id === id
      : pageBackTarget()?.id === id;
  const duplicate = duplicates.value.has(id);
  useLayoutEffect(() => {
    if (duplicate || !selected) return;
    const element = reference.current;
    // Legacy added the class once and never removed it until the next render.
    if (
      kind === 'validate' ||
      (shown &&
        label.trim().startsWith('◀') &&
        element?.parentElement?.id === 'view' &&
        !headingBefore(element))
    ) {
      duplicates.value = new Set([...duplicates.value, id]);
    }
  }, [duplicate, selected, shown, kind, label, id]);
  useLayoutEffect(
    () => () => {
      if (!duplicates.peek().has(id)) return;
      const next = new Set(duplicates.peek());
      next.delete(id);
      duplicates.value = next;
    },
    [id],
  );
  const classes = [className];
  if (duplicate) {
    classes.push(kind === 'validate' ? 'nav-dup ok-up' : 'nav-dup');
  }
  return (
    <Button
      ref={reference}
      className={classes.join(' ')}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {children ?? label}
    </Button>
  );
}

function headingBefore(element: HTMLElement): boolean {
  for (
    let sibling = element.parentElement?.firstElementChild ?? null;
    sibling && sibling !== element;
    sibling = sibling.nextElementSibling
  ) {
    if (/^H[1-3]$/.test(sibling.tagName) || sibling.tagName === 'SECTION') {
      return true;
    }
  }
  return false;
}
