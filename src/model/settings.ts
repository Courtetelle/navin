/** Wind alert settings (`settings.windAlert`). */
export interface WindAlertSettings {
  /** @default undefined */
  on?: boolean;
  /** @default undefined */
  basis?: string;
  [key: string]: unknown;
}

/**
 * User settings (`ldb.settings`). Known keys are typed; legacy screens add more
 * keys over time, so unknown keys are kept as-is.
 */
export interface Settings {
  /** App icon name. */
  icon: string;
  /** `'day'` or `'night'`. */
  theme: string;
  /** Carry values of the previous entry into a new one. */
  prefill: boolean;
  /** Keep the screen on. */
  wake: boolean;
  /** Automatic entries per hour while tracking. */
  autoPerHour: number;
  /** Course change (°) that creates an automatic entry. */
  autoTurn: number;
  /** Fetch weather for automatic entries. */
  autoWeather: boolean;
  /** Map radius in NM. */
  mapRadius: number;
  /**
   * Hide the help "i" pills.
   * @default undefined
   */
  noHelpI?: boolean;
  /**
   * Former name of `noHelpI`, migrated once at load.
   * @default undefined
   */
  noPopups?: unknown;
  /**
   * Pilot foot margin (m) added to the draft.
   * @default 0.6
   */
  piedPilote?: number | string;
  /**
   * Margin (m) added to the air draft.
   * @default 1.5
   */
  margeHaut?: number | string;
  /**
   * Hull length reduction (%) from the length overall.
   * @default 1
   */
  coquePct?: number | string;
  /**
   * Rounding step (m) of the minimum depth.
   * @default 0.1
   */
  arrProf?: number;
  /**
   * Rounding step (m) of the minimum clearance.
   * @default 0.1
   */
  arrHaut?: number;
  /**
   * Renamed member card labels: key → label.
   * @default undefined
   */
  memberAlias?: Record<string, string>;
  /**
   * Custom member card fields.
   * @default undefined
   */
  memberCustom?: Array<{ id: string; label: string; after?: string }>;
  /**
   * Wind alert configuration.
   * @default undefined
   */
  windAlert?: WindAlertSettings;
  [key: string]: unknown;
}

/** Settings defaults applied under the stored settings (legacy app.js:372). */
export const SETTINGS_DEFAULTS: Readonly<Settings> = {
  icon: 'compas',
  theme: 'day',
  prefill: true,
  wake: true,
  autoPerHour: 1,
  autoTurn: 30,
  autoWeather: true,
  mapRadius: 50,
};

/** Margins used by the computed boat fields when the setting is empty. */
export const MARGIN_DEFAULTS = {
  piedPilote: 0.6,
  margeHaut: 1.5,
  coquePct: 1,
} as const;

/** Keys of {@link MARGIN_DEFAULTS}. */
export type MarginKey = keyof typeof MARGIN_DEFAULTS;
