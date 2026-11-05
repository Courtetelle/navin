/** A localStorage seed: key → value (objects are JSON-stringified, strings stored as-is). */
export type Fixture = Record<string, unknown>;

/** One action replayed identically in the legacy app and in the React app. */
export type Step =
  /** Navigate with the app router: legacy `go(view, arg)`, React `window.__parity.go(view, arg)`. */
  | { go: string; arg?: unknown }
  | { click: string }
  /** Press, hold for `ms` (default 800), release. */
  | { longpress: string; ms?: number }
  | { fill: string; value: string }
  | { press: string; key: string }
  | { wait: number }
  /** Run a JS expression in both pages (use only globals both apps share, e.g. localStorage). */
  | { eval: string }
  /** Capture the DOM and a screenshot under this name and compare them. */
  | { snapshot: string };

/** A parity scenario: same seed, same clock, same steps in both apps. */
export interface Scenario {
  name: string;
  /**
   * localStorage seed, or the name of a JSON file in scripts/parity/fixtures/.
   * @default {}
   */
  fixture?: Fixture | string;
  steps: Step[];
  /**
   * Fixed wall-clock time (ISO string).
   * @default '2026-07-15T10:30:00+02:00'
   */
  time?: string;
  /**
   * Grant geolocation at this position; otherwise geolocation is denied.
   * @default undefined
   */
  geolocation?: { latitude: number; longitude: number };
  /**
   * Attributes ignored in the DOM comparison (regular expression source).
   * @default undefined
   */
  ignoreAttributes?: string;
  /**
   * Milliseconds to wait after every step.
   * @default 500
   */
  settle?: number;
  /**
   * Viewport size.
   * @default { width: 390, height: 844 }
   */
  viewport?: { width: number; height: number };
}

/** Result of one snapshot comparison. */
export interface SnapshotResult {
  scenario: string;
  snapshot: string;
  domDiffLines: number;
  pixelRatio: number;
  error?: string;
}
