/**
 * Everywhere in NavIn, a text longer than its button or its field scrolls
 * once when it shows, then again at every touch.
 */

import { runMarquee } from '../components/shared/useMarquee.ts';

/** What may hold a cut text: fields, buttons, links and their words. */
const HOLDERS = [
  'input:not([type])',
  'input[type=text]',
  'input[type=search]',
  'input[type=url]',
  'input[type=email]',
  'input[type=tel]',
  'button',
  '.btn',
  'a',
  'label',
  '[role=button]',
  'button *',
  '.btn *',
  'a *',
  '[role=button] *',
].join(',');

/** A touch on one of these scrolls the cut texts inside it. */
const TOUCHED = 'button, .btn, a, label, [role=button], .cf, input, textarea';

/** Longer by this, in pixels, a text is cut. */
const CUT_PX = 4;
/** The screen stays still this long before its new texts scroll. */
const SETTLE_MS = 700;
/** A finger moved this far scrolled the page: no touch. */
const MOVE_PX = 12;

const seen = new WeakSet<HTMLElement>();

/**
 * The element shows a text longer than itself, cut at its edge.
 * @param element - A field, a button or a text in one.
 * @returns Its text is cut.
 */
function isCut(element: HTMLElement): boolean {
  if (element.scrollWidth - element.clientWidth <= CUT_PX) return false;
  if (element instanceof HTMLInputElement) return true;
  // A text spilling over shows whole; a strip that scrolls by hand is no text.
  // A photo cut round is no text either.
  const { overflowX, whiteSpace } = globalThis.getComputedStyle(element);
  return (
    (overflowX === 'hidden' || overflowX === 'clip') &&
    (whiteSpace === 'nowrap' || whiteSpace === 'pre') &&
    Boolean(element.textContent?.trim())
  );
}

function onScreen(element: HTMLElement): boolean {
  if (!element.offsetParent) return false;
  const box = element.getBoundingClientRect();
  return (
    box.bottom > 0 &&
    box.top < globalThis.innerHeight &&
    box.right > 0 &&
    box.left < globalThis.innerWidth
  );
}

/** The texts that just showed scroll once. */
function scanNew(): void {
  for (const element of document.querySelectorAll<HTMLElement>(HOLDERS)) {
    if (seen.has(element) || !onScreen(element)) continue;
    seen.add(element);
    // Someone typing keeps their field where it is.
    if (document.activeElement !== element && isCut(element)) {
      runMarquee(element);
    }
  }
}

/**
 * The cut texts of what was touched.
 * @param held - The touched button, field or cell.
 * @returns Those texts.
 */
function cutIn(held: Element): HTMLElement[] {
  const found = [held, ...held.querySelectorAll(`${HOLDERS}, textarea`)];
  return found.filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement && isCut(element),
  );
}

/** Follow the screens and the touches, once, for the whole app. */
export function installTextMarquee(): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(scanNew, SETTLE_MS);
  };
  new MutationObserver(later).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'open', 'hidden'],
  });
  document.addEventListener('toggle', later, true);
  document.addEventListener('scroll', later, { capture: true, passive: true });
  globalThis.addEventListener('resize', later);
  later();

  let down: { x: number; y: number; focused: Element | null } | null = null;
  document.addEventListener(
    'pointerdown',
    (event) => {
      down = {
        x: event.clientX,
        y: event.clientY,
        focused: document.activeElement,
      };
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    'pointerup',
    (event) => {
      const start = down;
      down = null;
      if (!start) return;
      if (
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_PX
      ) {
        return;
      }
      const held = (event.target as Element | null)?.closest(TOUCHED);
      if (!held) return;
      for (const element of cutIn(held)) {
        // A field already being typed in keeps its place.
        if (element !== start.focused) runMarquee(element);
      }
    },
    { capture: true, passive: true },
  );
}
