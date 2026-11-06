/**
 * The example records serve the tests only: the app starts without them.
 * @returns `true` when the examples are to be added.
 */
export function examplesWanted(): boolean {
  return import.meta.env?.MODE === 'test';
}
