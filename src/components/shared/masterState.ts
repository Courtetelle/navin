/**
 * State class of the master checkbox.
 * @param checked - Items checked.
 * @param total - Items.
 * @returns `on`, `part` or `''`.
 */
export function masterState(
  checked: number,
  total: number,
): 'on' | 'part' | '' {
  if (checked === total) return 'on';
  return checked ? 'part' : '';
}
