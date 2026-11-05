import { useSignals } from '@preact/signals-react/runtime';
import type { HTMLAttributes, ReactNode } from 'react';
import { createElement } from 'react';

import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { toast } from '../../state/index.ts';

import type { HelpContext } from './helpRules.ts';
import { helpBubbleText, keepHelp, splitEmptyHelp } from './helpRules.ts';

/** Props of {@link HelpText}. */
export interface HelpTextProps
  extends HelpContext, Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Content: a French string (translated), or richer markup with `text`. */
  children: ReactNode;
  /**
   * Plain text of rich `children` (rules and bubble); defaults to `children` when a string.
   * @default undefined
   */
  text?: string;
  /**
   * List items of an `ol.help` / `ul.help` (bubble text, joined by ` · `).
   * @default undefined
   */
  items?: readonly string[];
  /**
   * Element: legacy turned `p.help`, `div.help`, `ol.help` and `ul.help` into pills.
   * @default 'p'
   */
  as?: 'p' | 'div' | 'ol' | 'ul';
  /**
   * Leading help of a fresh screen entry: class `help-lead` (see `useIntroLead`).
   * @default false
   */
  introLead?: boolean;
}

/**
 * An explanation text (legacy `p.help` after `helpToPopup`, nav.js:1122-1152):
 * long texts become a small ⓘ pill placed before a hidden paragraph
 * (`help-pop`); touching the pill shows the text in the bubble. Short texts,
 * empty-state messages and texts flagged `keep` stay visible. An empty-state
 * sentence followed by an explanation is split in two.
 * For the help right under the page title, use `PageTitle` (pill inside the h1).
 * @param props - Content, element and context.
 * @returns The pill and the paragraph, or the plain paragraph.
 */
export function HelpText({
  children,
  text,
  items,
  as = 'p',
  className,
  keep,
  nextIsRow,
  introLead = false,
  ...rest
}: HelpTextProps) {
  useSignals();
  const tr = useTr();
  const plain = text ?? (typeof children === 'string' ? children : '');
  const shown =
    typeof children === 'string' ? tr(children, { help: true }) : children;
  const classes = (extra: string) =>
    ['help', className, extra, introLead ? 'help-lead' : '']
      .filter(Boolean)
      .join(' ');
  const kept = keep === true || Boolean(rest.id);
  const split = as === 'p' && !kept ? splitEmptyHelp(plain) : null;
  if (split) {
    return (
      <>
        <p className="help">{tr(split.first, { help: true })}</p>
        <HelpText
          {...rest}
          className={className}
          nextIsRow={nextIsRow}
          introLead={introLead}
        >
          {split.rest}
        </HelpText>
      </>
    );
  }
  if (keepHelp(plain, { keep: kept, nextIsRow })) {
    return createElement(as, { ...rest, className: classes('') }, shown);
  }
  const bubble = items
    ? helpBubbleText(items.map((item) => tr(item, { help: true })))
    : helpBubbleText(typeof shown === 'string' ? shown : plain);
  return (
    <>
      <HelpPill text={bubble} />
      {createElement(as, { ...rest, className: classes('help-pop') }, shown)}
    </>
  );
}

/** Props of {@link HelpPill}. */
export interface HelpPillProps {
  /** Text shown in the bubble. */
  text: string;
  /**
   * Pill placed inside the page title (class `help-i-h1`).
   * @default false
   */
  inTitle?: boolean;
}

/**
 * The ⓘ pill (`span.help-i`): a touch shows the help in the bubble, without
 * triggering what is around it (the settings hide pills with `html.no-help-i`).
 * @param props - Bubble text and placement.
 * @returns The pill.
 */
export function HelpPill({ text, inTitle = false }: HelpPillProps) {
  return (
    <span
      className={inTitle ? 'help-i help-i-h1' : 'help-i'}
      role="button"
      aria-label="Aide"
      onClickCapture={(event) => {
        event.stopPropagation();
        event.preventDefault();
        buzz();
        toast(text, true);
      }}
    >
      ⓘ
    </span>
  );
}
