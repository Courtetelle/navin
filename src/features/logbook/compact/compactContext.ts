import type { CSSProperties } from 'react';
import { createContext, use } from 'react';

import type { FieldData, FieldDefinition } from '../../../model/field.ts';
import type { Settings } from '../../../model/settings.ts';

import type { FormStore } from './formStore.ts';

/** What every cell of a compact form shares. */
export interface CompactFormContext {
  /** Latest values (calculations, computed fields). */
  values: FieldData;
  /** Values shown by the cells. */
  shown: FieldData;
  /** Every field of the form, groups flattened. */
  fields: readonly FieldDefinition[];
  settings: Settings;
  /** Ids of the cells. */
  ids: ReadonlyMap<string, string>;
  /** Keys of the `reveal` fields already shown. */
  revealed: ReadonlySet<string>;
  /** The boat sails on inland waters: its sea-only fields are hidden. */
  inland: boolean;
  /**
   * Change a value (legacy `set`). A choice shows what the owner kept (it may
   * fill the value again), a text keeps what was typed.
   */
  set: (key: string, value: unknown, choice?: boolean) => void;
  /** Latest values, even between two renders. */
  latest: () => FieldData;
  /** Show a hidden field and focus it. */
  reveal: (key: string) => void;
  /** Memory of the form between two renders. */
  store: FormStore;
  /** Inline style of a frame. */
  cellStyle?: (key: string) => CSSProperties | undefined;
}

const Context = createContext<CompactFormContext | null>(null);

/** Provider of the form context. */
export const CompactFormProvider = Context;

/** Value of the group selector around a cell (`undefined` outside a group). */
export const GroupValueContext = createContext<string | undefined>(undefined);

/** The cell sits in a `.cf-frame`, which carries the style. */
export const InFrameContext = createContext(false);

/**
 * The enclosing compact form.
 * @returns The form context.
 */
export function useCompactForm(): CompactFormContext {
  const context = use(Context);
  if (!context) throw new Error('CompactFormProvider is missing');
  return context;
}
