import { useState } from 'react';

import { stringOf } from '../../../lib/format.ts';
import type { FieldDefinition } from '../../../model/field.ts';
import { autoVal } from '../../../model/field.ts';

import { useCompactForm } from './compactContext.ts';
import { isFilled } from './fieldChange.ts';

/** Text of an input of a compact form. */
export interface CellText {
  text: string;
  setText: (text: string) => void;
  /** The input has the focus. */
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
}

/**
 * Text shown by an input: what was typed while it has the focus; otherwise the
 * stored value, or the computed one while empty (legacy `refreshAutos`). An
 * input keeps what was typed even when it is not stored as is.
 * @param field - Field.
 * @returns The text and focus handlers.
 */
export function useCellText(field: FieldDefinition): CellText {
  const form = useCompactForm();
  const value = form.shown[field.key];
  const target = isFilled(value)
    ? stringOf(value)
    : autoVal(field, form.values, form.settings);
  const [text, setText] = useState(target);
  const [focused, setFocused] = useState(false);
  const [seen, setSeen] = useState({ target, focused });
  if (seen.target !== target || seen.focused !== focused) {
    setSeen({ target, focused });
    if (!focused && (field.auto || seen.target !== target)) setText(target);
  }
  return {
    text,
    setText,
    focused,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };
}
