import type { HTMLAttributes, MouseEvent, ReactNode } from 'react';
import { use } from 'react';

import { Button } from '../../../components/shared/Button.tsx';
import { useTr } from '../../../i18n/useTr.ts';
import { buzz } from '../../../lib/dom.ts';
import { descEn } from '../../../lib/translate.ts';
import type { FieldDefinition } from '../../../model/field.ts';
import { WATERS_SEA_ONLY } from '../../../model/techFields.ts';

import { isCellHidden } from './cellRules.ts';
import {
  GroupValueContext,
  InFrameContext,
  useCompactForm,
} from './compactContext.ts';
import { isFilled } from './fieldChange.ts';

/** Props of {@link Cell}. */
export interface CellProps extends HTMLAttributes<HTMLDivElement> {
  field: FieldDefinition;
  /**
   * Full row width.
   * @default false
   */
  wide?: boolean;
  children?: ReactNode;
}

/**
 * Frame of one field (`div.cf`): visibility rules, the ＋ button of the next
 * field and the English translation under the input.
 * @param props - Field, attributes and content.
 * @returns The cell.
 */
export function Cell({
  field,
  wide = false,
  className,
  children,
  ...rest
}: CellProps) {
  const form = useCompactForm();
  const tr = useTr();
  const groupValue = use(GroupValueContext);
  const inFrame = use(InFrameContext);
  const classes = ['cf'];
  if (wide) classes.push('wide');
  if (className) classes.push(className);
  if (field.reveal && !form.revealed.has(field.key)) classes.push('rev-hide');
  if (form.inland && WATERS_SEA_ONLY.includes(field.key)) {
    classes.push('waters-hide');
  }
  const value = form.shown[field.key];
  const more = field.addMore;
  return (
    <div
      {...rest}
      className={classes.join(' ')}
      hidden={
        isCellHidden(field, form.values, groupValue) ||
        (form.filledOnly && !isFilled(value))
      }
      style={inFrame ? undefined : form.cellStyle?.(field.key)}
    >
      {children}
      {more && !form.revealed.has(more.key) ? (
        <Button
          type="button"
          className="more-add no-navact"
          data-reveal={more.key}
          onClick={(event: MouseEvent) => {
            event.preventDefault();
            buzz();
            form.reveal(more.key);
          }}
        >
          {tr(`＋ ${more.label}`)}
        </Button>
      ) : null}
      {field.en ? (
        <small className="en-tr">{value ? `🇬🇧 ${descEn(value)}` : ''}</small>
      ) : null}
    </div>
  );
}
