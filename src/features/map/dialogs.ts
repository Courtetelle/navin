/**
 * Ask a yes / no question with the browser dialog.
 * @param question - The question.
 * @returns `true` when accepted.
 */
export function askConfirm(question: string): boolean {
  const { confirm: ask } = globalThis;
  return ask(question);
}

/**
 * Ask for a text with the browser dialog.
 * @param question - The question.
 * @param value - Text proposed.
 * @returns The text, or `null` when cancelled.
 */
export function askText(question: string, value: string): string | null {
  const { prompt: ask } = globalThis;
  return ask(question, value);
}
