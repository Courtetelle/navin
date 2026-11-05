import type { CSSProperties, ReactNode } from 'react';

import type { FieldData, FieldDefinition } from '../../../model/field.ts';

/** A group of fields of a compact form. */
export interface CompactSection {
  /**
   * Title of the foldable `details.section` (unused by a flat form).
   * @default undefined
   */
  title?: string;
  fields: readonly FieldDefinition[];
  /**
   * The section starts folded.
   * @default false
   */
  collapsed?: boolean;
}

/** Props of `CompactForm` (legacy `compactForm(container, sections, data, onChange, flat)`). */
export interface CompactFormProps {
  /** Sections to draw; a flat form draws the first one, without `details`. */
  sections: readonly CompactSection[];
  /** Current values. Never mutated: the form calls `onChange` with a new object. */
  data: FieldData;
  /**
   * Runs after every change (legacy `onChange(key)`, with `data` already
   * changed): the owner stores `next`, e.g.
   * `updateCruise((cruise) => { cruise.info = next; })`.
   * @param next - The whole next values.
   * @param key - Key that changed.
   */
  onChange: (next: FieldData, key: string) => void;
  /**
   * One grid without sections.
   * @default false
   */
  flat?: boolean;
  /**
   * Inline style of the frame of a field (`.cf`, or `.cf-frame` when it has one).
   * @default undefined
   */
  cellStyle?: (key: string) => CSSProperties | undefined;
  /**
   * Extra cell placed after the frame of a field.
   * @default undefined
   */
  afterCell?: (key: string) => ReactNode;
  /**
   * When given, only these keys follow changes made by the owner; the other
   * cells keep showing what was on screen (legacy forms were drawn once: the day
   * sheet refreshes only the rental amount after its automatic fill).
   * @default every key follows
   */
  followKeys?: readonly string[];
}
