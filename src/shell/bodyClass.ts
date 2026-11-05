import { signal } from '@preact/signals-react';
import { useLayoutEffect } from 'react';

/** Reference counts of the classes the app sets on `<body>`. */
const counts = new Map<string, number>();

/** Classes currently set on `<body>` by the app (reactive). */
export const bodyClasses = signal<ReadonlySet<string>>(new Set());

/**
 * Set or remove a class on `<body>` (several owners may hold the same class:
 * it stays while one of them holds it).
 * @param className - Class name.
 * @param on - Hold it (`true`) or release it (`false`).
 */
export function holdBodyClass(className: string, on: boolean): void {
  const count = (counts.get(className) ?? 0) + (on ? 1 : -1);
  if (count > 0) counts.set(className, count);
  else counts.delete(className);
  apply(className);
}

/**
 * Force a class on `<body>` on or off, whoever held it (legacy
 * `document.body.classList.toggle`, for classes owned by a single module such
 * as `zone-lac` or `is-tracking`).
 * @param className - Class name.
 * @param on - Present or not.
 */
export function setBodyClass(className: string, on: boolean): void {
  if (on) counts.set(className, Math.max(1, counts.get(className) ?? 0));
  else counts.delete(className);
  apply(className);
}

/**
 * Whether the app currently sets this class on `<body>`; reading it inside a
 * component or a `computed` subscribes to changes.
 * @param className - Class name.
 * @returns `true` when set.
 */
export function hasBodyClass(className: string): boolean {
  return bodyClasses.value.has(className);
}

/**
 * Hold a `<body>` class while the component is mounted and `on` is true
 * (replaces legacy `document.body.classList.add/remove` in pages, and the
 * removal of `has-prep-fab` / `trk-mode` that legacy `go` did for everyone).
 * @param className - Class name.
 * @param on - Hold it now.
 */
export function useBodyClass(className: string, on = true): void {
  useLayoutEffect(() => {
    if (!on) return undefined;
    holdBodyClass(className, true);
    return () => holdBodyClass(className, false);
  }, [className, on]);
}

function apply(className: string): void {
  const present = counts.has(className);
  globalThis.document?.body.classList.toggle(className, present);
  if (bodyClasses.value.has(className) === present) return;
  const next = new Set(bodyClasses.value);
  if (present) next.add(className);
  else next.delete(className);
  bodyClasses.value = next;
}
