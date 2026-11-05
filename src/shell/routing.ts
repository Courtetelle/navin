import { NO_CRUISE_VIEWS } from './viewLists.ts';

export { NO_CRUISE_VIEWS, ROOTS, VIEW_NAMES } from './viewLists.ts';
export type { ViewName } from './viewLists.ts';

/** Context of the tab rules. */
export interface TabContext {
  /** A cruise is open. */
  cruiseOpen: boolean;
  /** Where the alphabet goes back to (legacy `alphaBack`). */
  alphaBack: string;
}

const COMMON_TABS: Record<string, string> = {
  prep: 'tracker',
  dock: 'tracker',
  traces: 'more',
  new: 'tracker',
  day: 'more',
  log: 'more',
  info: 'more',
  checklist: 'tracker',
  crew: 'more',
  export: 'more',
  cruises: 'more',
  print: 'more',
  boats: 'more',
  sheet: 'more',
  rules: 'more',
  docs: 'more',
  ckbases: 'more',
  aboard: 'more',
  stats: 'more',
  map: 'more',
  vhf: 'tracker',
  tasktpl: 'more',
  dossier: 'more',
  people: 'more',
  crews: 'more',
  soslogs: 'more',
  marks: 'more',
  zones: 'more',
  cartes: 'more',
  lists: 'more',
  beaufort: 'more',
  douglas: 'more',
};

/**
 * Tab of a screen, as `go` computes it for the screen being opened (app.js:662).
 * Unlike {@link tabOf}, `nmea` has no entry here (no tab is lit on that screen).
 * @param view - Screen name.
 * @param context - Cruise and alphabet context.
 * @returns The `data-view` of the tab to light, or another value lighting none.
 */
export function tabFor(view: string, context: TabContext): string {
  const special = specialTab(view, context);
  if (special) return special;
  if (view === 'settings') return 'more';
  if (view === 'tracker') return 'tracker';
  return COMMON_TABS[view] ?? view;
}

/**
 * Tab of another screen (app.js:663): used for `nonav` (tab of the screen asked
 * for) and for the settings opened with the gear (tab of the screen left).
 * @param view - Screen name, or anything (no match lights no tab).
 * @param context - Cruise and alphabet context.
 * @returns The `data-view` of the tab to light.
 */
export function tabOf(view: unknown, context: TabContext): string | null {
  if (typeof view !== 'string') return null;
  const special = specialTab(view, context);
  if (special) return special;
  if (view === 'nmea') return 'more';
  return COMMON_TABS[view] ?? (view || null);
}

/** Screen state read by {@link activeTab}. */
export interface ActiveTabContext extends TabContext {
  /** Tab the settings were opened from with the gear (null = from data). */
  settingsFrom: string | null;
}

/**
 * The tab lit by `go` (app.js:664).
 * @param view - Screen rendered.
 * @param arg - Its argument (`nonav` receives the screen asked for).
 * @param context - Cruise, alphabet and settings context.
 * @returns The `data-view` of the active tab (no tab matches `null` or unknown names).
 */
export function activeTab(
  view: string,
  arg: unknown,
  context: ActiveTabContext,
): string | null {
  if (view === 'nonav') return tabOf(arg, context);
  if (
    view === 'settings' &&
    context.settingsFrom &&
    context.settingsFrom !== 'settings'
  ) {
    return tabOf(context.settingsFrom, context);
  }
  return tabFor(view, context);
}

/**
 * Redirect to `nonav` a screen that needs an open cruise (app.js:651).
 * @param view - Screen asked for.
 * @param arg - Its argument.
 * @param cruiseOpen - A cruise is open.
 * @returns The screen and argument to render.
 */
export function resolveView(
  view: string,
  arg: unknown,
  cruiseOpen: boolean,
): { view: string; arg: unknown } {
  if (cruiseOpen || NO_CRUISE_VIEWS.includes(view)) return { view, arg };
  if (view === 'checklist' && hasBoatId(arg)) return { view, arg };
  return { view: 'nonav', arg: view };
}

/**
 * Where the alphabet goes back to when it is opened from `current` (app.js:654).
 * @param current - Screen being left.
 * @returns `sos`, `vhf`, `lists` or `more`.
 */
export function alphaBackFor(current: string): string {
  return ['sos', 'vhf', 'lists'].includes(current) ? current : 'more';
}

const DATA_BACK_VIEWS = new Set([
  'traces',
  'day',
  'log',
  'info',
  'crew',
  'export',
  'cruises',
  'print',
  'boats',
  'sheet',
  'rules',
  'docs',
  'ckbases',
  'aboard',
  'stats',
  'map',
  'tasktpl',
  'dossier',
  'marks',
  'zones',
  'cartes',
  'lists',
  'settings',
  'people',
  'crews',
  'nmea',
]);

/**
 * Screen opened by the nav bar back button when the history is empty (nav.js:93).
 * @param current - Screen shown.
 * @returns The screen to go back to.
 */
export function backFallback(current: string): string {
  if (DATA_BACK_VIEWS.has(current)) return 'more';
  if (current === 'beaufort' || current === 'douglas') return 'lists';
  return 'tracker';
}

function specialTab(view: string, context: TabContext): string | null {
  if (view === 'mob') return context.cruiseOpen ? 'sos' : 'more';
  if (view === 'alpha') {
    return ['more', 'lists'].includes(context.alphaBack) ? 'more' : 'sos';
  }
  return null;
}

function hasBoatId(arg: unknown): boolean {
  if (!arg || typeof arg !== 'object') return false;
  return Boolean((arg as { boatId?: unknown }).boatId);
}
