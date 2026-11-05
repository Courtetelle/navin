/** Layout and input flags of a field definition (how the legacy forms draw it). */
export interface FieldLayout {
  /**
   * Compass rose input.
   * @default false
   */
  rose?: boolean;
  /**
   * Columns of the choice grid.
   * @default undefined
   */
  cols?: number;
  /**
   * Full row width.
   * @default false
   */
  wide?: boolean;
  /**
   * Text that grows with its content.
   * @default false
   */
  grow?: boolean;
  /**
   * Fields sharing a frame have the same frame name.
   * @default undefined
   */
  frame?: string;
  /** @default undefined */
  placeholder?: string;
  /** @default undefined */
  inputmode?: string;
  /**
   * Rows of a text area.
   * @default 3
   */
  rows?: number;
  /**
   * Single chip cycling through the options.
   * @default false
   */
  cycle?: boolean;
  /**
   * Cycle that is not protected (no long press needed).
   * @default false
   */
  free?: boolean;
  /**
   * Shorter cycle chip.
   * @default false
   */
  short?: boolean;
  /**
   * Displayed text of each stored value of a cycle chip.
   * @default undefined
   */
  show?: Readonly<Record<string, string>>;
  /**
   * Prefix shown before the value (e.g. `≥`).
   * @default undefined
   */
  prefix?: string;
  /**
   * Shows only the unit (no label).
   * @default false
   */
  unitOnly?: boolean;
  /**
   * English translation shown under the field.
   * @default false
   */
  en?: boolean;
  /**
   * Shown only when the propulsion is diesel.
   * @default false
   */
  gasOnly?: boolean;
  /**
   * Shown only when the propulsion is electric.
   * @default false
   */
  elecOnly?: boolean;
  /**
   * "＋" button revealing the next field.
   * @default undefined
   */
  addMore?: { key: string; label: string };
  /**
   * Hidden while empty, revealed by the previous field's ＋.
   * @default false
   */
  reveal?: boolean;
  /**
   * Date field whose minimum is another field.
   * @default undefined
   */
  minFrom?: string;
  /**
   * Label that cycles (passport ⇄ identity card).
   * @default undefined
   */
  labelCycle?: {
    key: string;
    options: readonly string[];
    /** @default undefined */
    prefix?: string;
    /** @default undefined */
    suffix?: string;
  };
  /**
   * Phone number field (international format).
   * @default false
   */
  phone?: boolean;
  /**
   * Contact link kind (`tel`, `mail`).
   * @default undefined
   */
  contact?: string;
  /**
   * Expiry date (yellow under 3 months, red when expired).
   * @default false
   */
  expiry?: boolean;
  /**
   * Shares a frame with the next field.
   * @default false
   */
  pairNext?: boolean;
}
