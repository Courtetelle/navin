import { batch, signal } from '@preact/signals-react';

import { state } from '../state/index.ts';

import type { Navigation } from './pageTypes.ts';
import {
  ROOTS,
  VIEW_NAMES,
  activeTab,
  alphaBackFor,
  backFallback,
  resolveView,
} from './routing.ts';
import { hideToast } from './toastControl.ts';
import { computeVoyageName } from './voyageName.ts';

/** Moment of a navigation event. */
export type NavigationPhase = 'before' | 'after';

/** What a navigation listener receives. */
export interface NavigationEvent {
  /** `before`: the old page is still shown; `after`: the new page is set. */
  phase: NavigationPhase;
  /** Screen left. */
  from: string;
  /** Screen opened (after the `nonav` redirection). */
  to: string;
  /** Argument of the screen opened. */
  arg: unknown;
}

/** Called around every `go`. */
export type NavigationListener = (event: NavigationEvent) => void;

/** The page shown and its argument; every `go` creates a new one (new id). */
export const navigation = signal<Navigation>({
  id: 0,
  view: 'new',
  arg: null,
  from: 'new',
});

/** Tab lit by the last `go` (`data-view` of the tab, or null). */
export const routedTab = signal<string | null>(null);

/** Text of the hidden `#voyageName` element, written by `go`. */
export const voyageName = signal<string>('NavIn');

const history: string[] = [];
const listeners = new Set<NavigationListener>();
let goingBack = false;

/**
 * Open a screen (legacy `go`, app.js:648 wrapped by nav.js:27): history of
 * non-root screens, bubble hidden when a root screen is opened, `nonav`
 * redirection, settings and alphabet context, tab lit, voyage name, page
 * remounted, scroll to the top.
 * @param view - Screen name.
 * @param arg - Screen argument.
 */
export function go(view: string, arg: unknown = null): void {
  const from = state.view.currentView.value;
  if (!goingBack && from && from !== view && !ROOTS.includes(view)) {
    history.push(from);
  }
  if (ROOTS.includes(view)) history.length = 0;
  if (ROOTS.includes(view) && from !== view) hideToast();
  goingBack = false;
  render(view, arg);
}

/**
 * The gear button: opens the settings of the current screen, or goes back to
 * that screen when the settings are shown (app.js:3297).
 */
export function goFromGear(): void {
  const current = state.view.currentView.value;
  if (current === 'settings') {
    go(state.view.settingsFrom.value ?? 'tracker');
    return;
  }
  batch(() => {
    state.view.settingsFrom.value = current;
    state.view.settingsAll.value = false;
    state.view.gear.value = true;
  });
  go('settings');
}

/**
 * The nav bar back button without a page back button: previous screen of the
 * history, or the parent of the current screen (nav.js:90-93).
 */
export function goBackInHistory(): void {
  const previous = history.pop();
  goingBack = true;
  const known = previous !== undefined && isView(previous);
  go(known ? previous : backFallback(state.view.currentView.value));
}

/**
 * The screen the nav bar back button goes to without a page back button.
 * @returns Its view name.
 */
export function backDestination(): string {
  const previous = history.at(-1);
  return previous !== undefined && isView(previous)
    ? previous
    : backFallback(state.view.currentView.value);
}

/** Forget the history (nav bar exit button, nav.js:82). */
export function clearHistory(): void {
  history.length = 0;
}

/**
 * Listen to every navigation; pages and domains use it for side effects legacy
 * `go` ran for everyone (close a popup, leave the full-screen map, sync the
 * PréP bar).
 * @param listener - Called with phase `before`, then `after`.
 * @returns Unsubscribe function.
 */
export function addNavigationListener(
  listener: NavigationListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Recompute the hidden voyage name (legacy app.js:2748, after renaming the cruise).
 */
export function refreshVoyageName(): void {
  voyageName.value = computeVoyageName();
}

/**
 * Snapshot of the history, oldest first (tests and diagnostics).
 * @returns A copy of the history stack.
 */
export function historySnapshot(): string[] {
  return [...history];
}

function render(requested: string, requestedArg: unknown): void {
  const from = state.view.currentView.value;
  const cruiseOpen = state.data.cruise.value !== null;
  const { view, arg } = resolveView(requested, requestedArg, cruiseOpen);
  emit({ phase: 'before', from, to: view, arg });
  batch(() => {
    if (view === 'settings' && !state.view.gear.value) {
      state.view.settingsFrom.value = null;
    }
    state.view.gear.value = false;
    if (view === 'alpha' && from !== 'alpha') {
      state.view.alphaBack.value = alphaBackFor(from);
    }
    state.view.currentView.value = view;
    state.view.viewArg.value = arg;
    state.view.tzLocalOnly.value = false;
    routedTab.value = activeTab(view, arg, {
      cruiseOpen,
      alphaBack: state.view.alphaBack.value,
      settingsFrom: state.view.settingsFrom.value,
    });
    voyageName.value = computeVoyageName();
    navigation.value = { id: navigation.value.id + 1, view, arg, from };
  });
  emit({ phase: 'after', from, to: view, arg });
  globalThis.scrollTo?.(0, 0);
}

function emit(event: NavigationEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // A failing listener must not block the navigation.
    }
  }
}

function isView(name: string): boolean {
  return (VIEW_NAMES as readonly string[]).includes(name);
}
