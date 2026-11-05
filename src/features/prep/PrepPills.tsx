import { useDeferredValue, useRef } from 'react';

import { useAutoRoll } from '../../components/shared/useAutoRoll.tsx';
import { useTr } from '../../i18n/useTr.ts';

import { prepLineJump } from './prepFlow.ts';
import type { PrepLineItem, PrepPill } from './prepLine.ts';

/** Props of {@link PrepPills}. */
export interface PrepPillsProps {
  /** Pills to show. */
  pills: readonly PrepPill[];
}

/**
 * The numbered pills of the steps (children of `.prep-steps`).
 * @param props - The pills.
 * @returns One `span` each.
 */
export function PrepPills({ pills }: PrepPillsProps) {
  return pills.map((pill) => (
    <span
      key={pill.step}
      data-ps={pill.step}
      role="button"
      className={pill.className || undefined}
    >
      {pill.label}
    </span>
  ));
}

/** Props of {@link PrepLineTitles}. */
export interface PrepLineTitlesProps {
  /** Items of the line. */
  items: readonly PrepLineItem[];
}

/**
 * The titles of `#prepLine`: a touch leads back to the step.
 * @param props - The items.
 * @returns One `span` each.
 */
export function PrepLineTitles({ items }: PrepLineTitlesProps) {
  return items.map((item) => (
    <PrepLineTitle key={String(item.target)} item={item} />
  ));
}

function PrepLineTitle({ item }: { item: PrepLineItem }) {
  const tr = useTr();
  const reference = useRef<HTMLSpanElement>(null);
  const text = tr(item.text);
  // The line sets its own layout after its children: measure once it is done.
  const measured = useDeferredValue(text, '');
  const roll = useAutoRoll(reference, measured, text);
  const classes = ['pl-it'];
  if (item.status) classes.push(`pl-${item.status}`);
  if (item.current) classes.push('pl-cur');
  if (roll.className) classes.push(roll.className);
  return (
    <span
      ref={reference}
      role="button"
      className={classes.join(' ')}
      data-tj={item.target}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        prepLineJump(item.target);
      }}
    >
      {roll.content}
    </span>
  );
}
