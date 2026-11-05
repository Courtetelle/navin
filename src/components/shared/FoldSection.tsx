import { useSignals } from '@preact/signals-react/runtime';
import type { HTMLAttributes, MouseEvent, ReactNode } from 'react';
import { Children } from 'react';

import { useTr } from '../../i18n/useTr.ts';
import { state } from '../../state/index.ts';

import { FOLD_SKIP, isFolded, setFolded } from './folds.ts';

/** Props of {@link FoldSection}. */
export interface FoldSectionProps extends Omit<
  HTMLAttributes<HTMLElement>,
  'title'
> {
  /** Title of the `h2` (a French string is translated). */
  title: ReactNode;
  /**
   * Plain title text when `title` is rich (fold key).
   * @default undefined
   */
  titleText?: string;
  /**
   * Classes of the `h2` besides the fold ones.
   * @default undefined
   */
  headingClassName?: string;
  /** Section content after the title. */
  children?: ReactNode;
}

/**
 * A `section.field` whose `h2` title folds it (legacy `foldEnhance`,
 * nav.js:378-413): arrow ▾ / ▸ (`span.fold-arr`), `h2.fold-h`, section class
 * `folded`; closed by default except on SOS / MOB / SOS logs, state kept per
 * screen and title in `ldb.folds2`. No folding on the input forms and SOS
 * (`new`, `day`, `sheet`, `sos`), nor for a section with only its title.
 * A tap on a button, link or field inside the title keeps its own role.
 * @param props - Title, classes and content.
 * @returns The section.
 */
export function FoldSection({
  title,
  titleText,
  headingClassName,
  className = 'field',
  children,
  ...rest
}: FoldSectionProps) {
  useSignals();
  const tr = useTr();
  const view = state.view.currentView.value;
  const text = (titleText ?? (typeof title === 'string' ? title : '')).trim();
  const shownTitle = typeof title === 'string' ? tr(title) : title;
  const foldable = !FOLD_SKIP.includes(view) && Children.count(children) > 0;
  if (!foldable) {
    return (
      <section {...rest} className={className}>
        <h2 className={headingClassName}>{shownTitle}</h2>
        {children}
      </section>
    );
  }
  const closed = isFolded(view, text);
  const toggle = (event: MouseEvent) => {
    if ((event.target as Element).closest('button, a, input, select, label')) {
      return;
    }
    setFolded(view, text, !closed);
  };
  const headingClasses = [
    headingClassName,
    'fold-h',
    closed ? 'fold-closed' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <section {...rest} className={closed ? `${className} folded` : className}>
      <h2 className={headingClasses} onClick={toggle}>
        <span className={closed ? 'fold-arr closed' : 'fold-arr'}>
          {closed ? '▸' : '▾'}
        </span>
        {shownTitle}
      </h2>
      {children}
    </section>
  );
}
