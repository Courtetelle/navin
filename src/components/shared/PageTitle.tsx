import { useSignals } from '@preact/signals-react/runtime';
import type { ReactNode } from 'react';
import { Fragment } from 'react';

import { useTr } from '../../i18n/useTr.ts';
import { state } from '../../state/index.ts';

import { HelpPill } from './HelpText.tsx';
import type { HelpContext } from './helpRules.ts';
import { helpBubbleText, keepHelp, splitEmptyHelp } from './helpRules.ts';
import { useIntroLead } from './introLead.ts';

/** One help paragraph right under the title. */
export interface LeadHelp extends HelpContext {
  /** French text of the paragraph. */
  text: string;
}

/** Props of {@link PageTitle}. */
export interface PageTitleProps {
  /** Title content (a French string is translated). */
  children: ReactNode;
  /**
   * Plain text of the title when `children` is rich (intro key).
   * @default undefined
   */
  titleText?: string;
  /**
   * Help paragraphs that follow the title (only `p.help` between them).
   * @default []
   */
  helps?: ReadonlyArray<string | LeadHelp>;
  /**
   * The title and its helps open `#view` (only `.nav-dup` / `.prep-title`
   * before): they get `help-lead` on a fresh entry (nav.js:117-128).
   * @default true
   */
  atTop?: boolean;
}

/**
 * A page `h1` with its introduction (nav.js:1137-1140): the first long help
 * puts its ⓘ pill inside the title (`help-i-h1`), the next long ones join the
 * same bubble text; their paragraphs stay hidden (`help-pop`). Short ones stay
 * visible as plain `p.help`.
 * @param props - Title, helps and position.
 * @returns The `h1` and the help paragraphs.
 */
export function PageTitle({
  children,
  titleText,
  helps = [],
  atTop = true,
}: PageTitleProps) {
  useSignals();
  const tr = useTr();
  const plainTitle =
    titleText ?? (typeof children === 'string' ? children : '');
  const fresh = useIntroLead(state.view.currentView.value, plainTitle);
  const lead = atTop && fresh;
  const paragraphs = leadParagraphs(helps);
  const bubble: string[] = [];
  for (const { text, popped } of paragraphs) {
    if (popped) bubble.push(tr(text, { help: true }).trim());
  }
  return (
    <>
      <h1>
        {typeof children === 'string' ? tr(children) : children}
        {bubble.length > 0 ? (
          <HelpPill text={helpBubbleText(bubble.join(' · '))} inTitle />
        ) : null}
      </h1>
      {paragraphs.map((paragraph) => (
        <Fragment key={paragraph.key}>
          <p className={paragraphClass(paragraph, lead)}>
            {tr(paragraph.text, { help: true })}
          </p>
        </Fragment>
      ))}
    </>
  );
}

interface LeadParagraph {
  key: string;
  text: string;
  popped: boolean;
}

function leadParagraphs(
  helps: ReadonlyArray<string | LeadHelp>,
): LeadParagraph[] {
  const paragraphs: LeadParagraph[] = [];
  for (const [index, entry] of helps.entries()) {
    const help = typeof entry === 'string' ? { text: entry } : entry;
    const split = help.keep ? null : splitEmptyHelp(help.text);
    if (split) {
      paragraphs.push({ key: `${index}a`, text: split.first, popped: false });
    }
    const text = split ? split.rest : help.text;
    const popped = !keepHelp(text, split ? {} : help);
    paragraphs.push({ key: `${index}`, text, popped });
  }
  return paragraphs;
}

function paragraphClass(paragraph: LeadParagraph, lead: boolean): string {
  const classes = ['help'];
  if (paragraph.popped) classes.push('help-pop');
  // The paragraph inserted by the empty-state split is not a lead paragraph.
  if (lead && !paragraph.key.endsWith('a')) classes.push('help-lead');
  return classes.join(' ');
}
