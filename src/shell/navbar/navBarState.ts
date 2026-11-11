import { computed, signal } from '@preact/signals-react';
import type { ReactNode } from 'react';

import { state } from '../../state/index.ts';
import { bodyClasses } from '../bodyClass.ts';
import { ROOTS } from '../routing.ts';

/** A page button the nav bar relays (back, done, validate). */
export interface NavTarget {
  /** Registration id. */
  id: number;
  /** Text of the page button, as legacy read it (`◀ Équipages`, `✔ Terminé`, `Valider`). */
  label: string;
  /** What the page button does. */
  onClick: () => void;
  /** The page button element (to order several by document position). */
  element: () => HTMLElement | null;
}

/** PréP steps shown in the nav bar (has-steps mode, nav.js:58-69). */
export interface NavStepsConfig {
  /** Content of the step pills (the page's `.prep-steps` children), copied into the hidden `#navMid`. */
  pills: ReactNode;
  /** Content of `#prepLine` (legacy `window.prepLine()`). */
  line: ReactNode;
  /** The current step page holds the « Départ » button (`[data-p="depart"]`): ✔ triggers it. */
  onDepart?: () => void;
  /** Browse to the next step without validating (legacy `prepBrowseNext`). */
  onBrowseNext: () => void;
  /** Long press on ✖: reset the PréP path (legacy `prepReset`). */
  onReset: () => void;
  /** A pill of `#navMid` was clicked (legacy `prepJump`). */
  onPill?: (step: number) => void;
  /**
   * The PréP bar (`#prepBar`, body class `prep-on`) is shown with its buttons.
   * @default undefined
   */
  prepBar?: {
    /** Its « Suivant ▶ » button exists: ▶ of the nav bar triggers it. */
    onNext?: () => void;
    /** Its hidden ◀ button: the nav bar back button triggers it. */
    onBack: () => void;
  };
}

let nextId = 1;

/** Page back buttons (`◀ …`) and `✔ Terminé` buttons, in registration order. */
export const backTargets = signal<
  ReadonlyArray<NavTarget & { kind: 'back' | 'done' }>
>([]);
/** Page « Valider » buttons, moved up into the green ✔ (nav.js:1252). */
export const validateTargets = signal<readonly NavTarget[]>([]);
/** A page read-only until edited: the green ✔ becomes a pencil and runs this. */
export const navEdit = signal<(() => void) | null>(null);
/** Number of mounted pages declaring form fields (the green ✔ appears, nav.js:1255). */
export const fieldOwners = signal(0);
/** PréP steps of the page, or null. */
export const navSteps = signal<NavStepsConfig | null>(null);
/** `#prepLine` exists once steps were shown; it then stays (hidden) with its last content. */
export const prepLineContent = signal<ReactNode>(null);

/**
 * New registration id.
 * @returns A unique id.
 */
export function newTargetId(): number {
  return nextId++;
}

/**
 * The first target in document order.
 * @param targets - Candidate targets.
 * @returns The first one whose element precedes the others.
 */
export function firstInDocument<T extends NavTarget>(
  targets: readonly T[],
): T | null {
  let best: T | null = null;
  let bestElement: HTMLElement | null = null;
  for (const target of targets) {
    const element = target.element();
    if (!best) {
      best = target;
      bestElement = element;
      continue;
    }
    if (
      element &&
      bestElement &&
      element.compareDocumentPosition(bestElement) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ) {
      best = target;
      bestElement = element;
    }
  }
  return best;
}

/**
 * The page button the nav bar back button relays (nav.js:38-41): the first
 * `◀ word` button, else the first `✔ Terminé`.
 * @returns The target, or null.
 */
export function pageBackTarget():
  (NavTarget & { kind: 'back' | 'done' }) | null {
  const targets = backTargets.value;
  const backs = targets.filter((target) => target.kind === 'back');
  if (backs.length > 0) return firstInDocument(backs);
  return firstInDocument(targets);
}

/**
 * Label of `#navBack` (nav.js:56): the page back text without its arrow
 * (`◀ Plus` reads `data`), `✔ Terminé` for a done button, `Retour` otherwise
 * or while the PréP bar is shown.
 * @param target - Page back target.
 * @param prepOn - The PréP bar is shown.
 * @returns The label.
 */
export function navBackLabel(
  target: { label: string } | null,
  prepOn: boolean,
  destination?: string,
): string {
  // Without a back button of its own, the name of the screen it goes back to.
  let label = destination ? `◀ ${destination}` : '◀ Retour';
  if (!prepOn && target) {
    const text = target.label.trim();
    label = text.startsWith('✔')
      ? '✔ Terminé'
      : text.replace(/^◀ Plus$/, '◀ data').replace(/^◀ Traceur$/, '◀ NavIn');
  }
  return label.replace(/^◀\s*/, '');
}

/**
 * Whether `#navtop` is shown (nav.js:45): on every non-root screen and on PréP,
 * except in the full-screen tracker (`trk-mode`).
 */
export const navBarShown = computed(() => {
  const view = state.view.currentView.value;
  return (
    (!ROOTS.includes(view) || view === 'prep') &&
    !bodyClasses.value.has('trk-mode')
  );
});
