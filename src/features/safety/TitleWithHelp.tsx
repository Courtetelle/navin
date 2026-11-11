import { useSignals } from '@preact/signals-react/runtime';
import type { ReactNode } from 'react';

import { HelpPill } from '../../components/shared/HelpText.tsx';
import { helpBubbleText, keepHelp } from '../../components/shared/helpRules.ts';
import { useIntroLead } from '../../components/shared/introLead.ts';
import { state } from '../../state/index.ts';

/** Props of {@link TitleWithHelp}. */
interface TitleWithHelpProps {
  /** Classes of the `h1`. */
  className: string;
  /** Title. */
  children: string;
  /**
   * Help paragraph right under the title.
   * @default undefined
   */
  help?: string;
}

/**
 * A coloured `h1` with its help: `PageTitle` for the titles that carry a class.
 * @param props - Title, classes and help.
 * @returns The title and the paragraph.
 */
export function TitleWithHelp({
  className,
  children,
  help,
}: TitleWithHelpProps): ReactNode {
  useSignals();
  const lead = useIntroLead(state.view.currentView.value, children);
  const popped = help !== undefined && !keepHelp(help);
  const classes = ['help'];
  if (popped) classes.push('help-pop');
  if (lead) classes.push('help-lead');
  return (
    <>
      <h1 className={className}>
        {children}
        {popped ? <HelpPill text={helpBubbleText(help)} inTitle /> : null}
      </h1>
      {help === undefined ? null : <p className={classes.join(' ')}>{help}</p>}
    </>
  );
}
