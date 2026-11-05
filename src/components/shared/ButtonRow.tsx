import { useSignals } from '@preact/signals-react/runtime';
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { Children, cloneElement, isValidElement } from 'react';

import { buttonTexts } from '../../shell/uiEdit/applyUiEdit.tsx';
import { state } from '../../state/index.ts';

import type { RowChild } from './buttonTypology.ts';
import { rowTypology } from './buttonTypology.ts';

/** Props of {@link ButtonRow}. */
export interface ButtonRowProps extends HTMLAttributes<HTMLDivElement> {
  /** The row children: `Button`, `HoldDeleteButton`, `ArmedButton`, `<a className="btn">`… */
  children: ReactNode;
  /**
   * The row sits inside `.chips`, `.ck-tabs`, `.seg` or `.lang-row`.
   * @default false
   */
  choice?: boolean;
}

interface ChildProps {
  className?: string;
  children?: ReactNode;
}

/**
 * A `div.row` of buttons with the final classes of legacy
 * `dataButtonsLayout` and `plusTypology` (nav.js:1175-1241): `row-stack`,
 * `act-add`, `act-plain`, `primary` removed or added according to the screen.
 * Use it for every `.row` that holds only buttons.
 * @param props - Row class (default `row`), children and attributes.
 * @returns The row.
 */
export function ButtonRow({
  children,
  className = 'row',
  choice = false,
  ...rest
}: ButtonRowProps) {
  useSignals();
  const view = state.view.currentView.value;
  const items = Children.toArray(children);
  const described: RowChild[] = [];
  for (const item of items) described.push(describe(item, choice));
  const { stacked, classNames } = rowTypology(view, described);
  const rendered: ReactNode[] = [];
  for (const [index, item] of items.entries()) {
    rendered.push(
      isValidElement<ChildProps>(item)
        ? cloneElement(item, { className: classNames[index] })
        : item,
    );
  }
  return (
    <div {...rest} className={stacked ? `${className} row-stack` : className}>
      {rendered}
    </div>
  );
}

function describe(item: ReactNode, choice: boolean): RowChild {
  if (!isValidElement<ChildProps>(item)) {
    return { text: '', className: '', tag: 'text', inChoiceGroup: choice };
  }
  return {
    text: buttonTexts(item.props.children).text,
    className: item.props.className ?? '',
    tag: tagOf(item),
    data: Object.keys(item.props).filter((name) => name.startsWith('data-')),
    inChoiceGroup: choice,
  };
}

function tagOf(item: ReactElement): string {
  return typeof item.type === 'string' ? item.type : 'button';
}
