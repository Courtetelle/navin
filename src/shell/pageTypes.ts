import type { ComponentType } from 'react';

/** Props every screen receives from the shell. */
export interface PageProps {
  /** Second argument of `go(view, arg)` (legacy `VIEWS[view](arg)`). */
  arg: unknown;
  /**
   * Screen shown before this navigation (legacy `currentView` read at the top of
   * `go`). Equal to the page's own view when `go` re-renders the same screen.
   */
  from: string;
}

/** A screen component, rendered inside `<main id="view">`. */
export type PageComponent = ComponentType<PageProps>;

/** One navigation made by `go`: every call remounts the page, like legacy re-renders. */
export interface Navigation {
  /** Increases on every `go` call; used as the page key. */
  id: number;
  /** Screen rendered (after the `nonav` redirection). */
  view: string;
  /** Argument passed to the screen. */
  arg: unknown;
  /** Screen shown before this navigation. */
  from: string;
}
