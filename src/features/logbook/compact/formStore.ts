import type { FieldData } from '../../../model/field.ts';

/**
 * What a compact form needs between two renders: the latest values (two
 * changes can follow each other before React renders) and the inputs to focus.
 */
export class FormStore {
  #values: FieldData;
  readonly #inputs = new Map<string, HTMLElement>();

  /**
   * @param values - Initial values.
   */
  public constructor(values: FieldData) {
    this.#values = values;
  }

  /**
   * Latest values.
   * @returns The values.
   */
  public latest = (): FieldData => this.#values;

  /**
   * Remember the latest values.
   * @param values - The values.
   */
  public keep(values: FieldData): void {
    this.#values = values;
  }

  /**
   * Remember the input of a field.
   * @param key - Field key.
   * @param element - The input, or null when it goes away.
   */
  public register(key: string, element: HTMLElement | null): void {
    if (element) this.#inputs.set(key, element);
    else this.#inputs.delete(key);
  }

  /**
   * Focus the input of a field.
   * @param key - Field key.
   */
  public focus(key: string): void {
    this.#inputs.get(key)?.focus();
  }
}
