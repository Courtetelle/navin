/**
 * Decimal comma (nav.js:98-105): in fields with `inputMode="decimal"`, the dot
 * of the phone keyboard becomes a comma as it is typed. The value is written
 * through the prototype setter, before React reads it, so that `onChange`
 * handlers of controlled inputs see the comma.
 * @returns Removes the listener.
 */
export function installDecimalComma(): () => void {
  document.addEventListener('input', replaceDecimalDot, true);
  return () => document.removeEventListener('input', replaceDecimalDot, true);
}

function replaceDecimalDot(event: Event): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (input.inputMode !== 'decimal' || !input.value.includes('.')) return;
  const caret = input.selectionStart;
  Reflect.set(
    HTMLInputElement.prototype,
    'value',
    input.value.replaceAll('.', ','),
    input,
  );
  try {
    input.setSelectionRange(caret, caret);
  } catch {
    // Some input types refuse a selection.
  }
}
