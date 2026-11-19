/** When alerts switched off come back on. */
export type ReOnRule = 'trace' | 'midnight' | 'launch' | 'never';

/** The choices, in the order of the buttons. */
export const REON_CHOICES: ReadonlyArray<[ReOnRule, string]> = [
  ['trace', 'À la fin d’une trace'],
  ['midnight', 'Une fois par jour, à minuit'],
  ['launch', 'Au lancement de NavIn'],
  ['never', 'Jamais (je les rallume moi-même)'],
];

/**
 * Whether alerts switched off come back on now.
 * @param rule - The rule chosen.
 * @param moment - What happens: NavIn starts, a minute passes, a track ends.
 * @param offDay - The day they were switched off.
 * @param today - Today.
 * @returns True to switch them on.
 */
export function reOnDue(
  rule: ReOnRule,
  moment: 'launch' | 'tick' | 'trace',
  offDay: string | undefined,
  today: string,
): boolean {
  if (rule === 'launch') return moment === 'launch';
  if (rule === 'trace') return moment === 'trace';
  if (rule === 'midnight') return Boolean(offDay) && offDay !== today;
  return false;
}
