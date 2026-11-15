import { dayKey } from '../../lib/format.ts';
import { state, toast, updateSettings } from '../../state/index.ts';

/** When the wind alerts switched off come back on. */
export type ReOnRule = 'trace' | 'midnight' | 'launch' | 'never';

/** The choices, in the order of the form. */
export const REON_CHOICES: ReadonlyArray<[ReOnRule, string]> = [
  ['trace', 'À la fin d’une trace'],
  ['midnight', 'Une fois par jour, à minuit'],
  ['launch', 'Au lancement de NavIn'],
  ['never', 'Jamais (je les rallume moi-même)'],
];

/**
 * The rule chosen: at the launch of NavIn by default, so that alerts
 * forgotten off never stay off for long.
 * @returns The rule.
 */
export function reOnRule(): ReOnRule {
  const rule = state.preferences.settings.value.windAlert?.reOn;
  return REON_CHOICES.some(([key]) => key === rule)
    ? (rule as ReOnRule)
    : 'launch';
}

/**
 * The words of the rule, for the ⓘ of the button.
 * @param rule - The rule.
 * @returns The sentence.
 */
export function reOnText(rule: ReOnRule): string {
  if (rule === 'trace') {
    return 'Coupées, les alertes de vent se rallument seules à la fin de la prochaine trace.';
  }
  if (rule === 'midnight') {
    return 'Coupées, les alertes de vent se rallument seules à minuit.';
  }
  if (rule === 'launch') {
    return 'Coupées, les alertes de vent se rallument seules au prochain lancement de NavIn.';
  }
  return 'Coupées, les alertes de vent restent coupées jusqu’à ce que vous les rallumiez.';
}

/**
 * Keep the rule chosen with the pencil.
 * @param rule - The rule.
 */
export function setReOnRule(rule: ReOnRule): void {
  updateSettings((settings) => {
    settings.windAlert = { ...settings.windAlert, reOn: rule };
  });
}

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

/**
 * Switch the alerts back on when the rule says so, and say it.
 * @param moment - What happens.
 * @returns Whether they were switched on.
 */
export function applyReOn(moment: 'launch' | 'tick' | 'trace'): boolean {
  const alert = state.preferences.settings.peek().windAlert;
  if (alert?.on !== false) return false;
  const offDay = typeof alert.offDay === 'string' ? alert.offDay : undefined;
  if (!reOnDue(reOnRule(), moment, offDay, dayKey(new Date()))) return false;
  updateSettings((settings) => {
    settings.windAlert = { ...settings.windAlert, on: true };
  });
  toast('🔔 Alertes de vent de nouveau actives');
  return true;
}
