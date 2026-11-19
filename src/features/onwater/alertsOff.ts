import { dayKey } from '../../lib/format.ts';
import { state, toast, updateSettings } from '../../state/index.ts';

import type { ReOnRule } from './windReOn.ts';
import { REON_CHOICES, reOnDue } from './windReOn.ts';
import { resetWindSignal, windWatchStart } from './windWatch.ts';

/** The alerts that can be switched off, each coming back on by its rule. */
export type AlertKind = 'wind' | 'lightning' | 'lakeWarn' | 'depth';

/** The alerts, in the order of the Alertes menu. */
export const ALERT_KINDS: readonly AlertKind[] = [
  'wind',
  'lightning',
  'lakeWarn',
  'depth',
];

/** Their names in a sentence. */
const ALERT_NAMES: Readonly<Record<AlertKind, string>> = {
  wind: 'vent',
  lightning: 'orage',
  lakeWarn: 'feux d’avis',
  depth: 'profondeur',
};

type Settings = ReturnType<typeof state.preferences.settings.peek>;

/** The object of an alert in the settings (`depth` has none: flat keys). */
const OBJECT_OF = {
  wind: 'windAlert',
  lightning: 'lightning',
  lakeWarn: 'lakeWarn',
} as const;

function objectOf(
  settings: Settings,
  kind: Exclude<AlertKind, 'depth'>,
): Record<string, unknown> {
  return (settings[OBJECT_OF[kind]] ?? {}) as Record<string, unknown>;
}

/**
 * The alert is on (all are, until switched off).
 * @param kind - The alert.
 * @param settings - The settings read.
 * @returns Whether it is on.
 */
export function alertOn(
  kind: AlertKind,
  settings: Settings = state.preferences.settings.value,
): boolean {
  if (kind === 'depth') return settings.depthAlarm !== false;
  return objectOf(settings, kind).on !== false;
}

/**
 * Switch an alert on or off; switched off, the day is kept (« à minuit »
 * counts from it).
 * @param kind - The alert.
 * @param on - On or off.
 */
export function setAlertOn(kind: AlertKind, on: boolean): void {
  const offDay = dayKey(new Date());
  updateSettings((settings) => {
    if (kind === 'depth') {
      settings.depthAlarm = on;
      settings.depthOffDay = offDay;
      return;
    }
    const key = OBJECT_OF[kind];
    settings[key] = { ...objectOf(settings, kind), on, offDay };
  });
  if (kind === 'wind') {
    resetWindSignal();
    windWatchStart();
  }
}

/**
 * When the alert switched off comes back on: at the launch of NavIn by
 * default, so that an alert forgotten off never stays off for long.
 * @param kind - The alert.
 * @returns The rule.
 */
export function reOnRuleOf(kind: AlertKind): ReOnRule {
  const settings = state.preferences.settings.value;
  const rules = (settings.alertReOn ?? {}) as Record<string, unknown>;
  // The wind alerts had their rule before the others.
  const rule =
    rules[kind] ??
    (kind === 'wind' ? objectOf(settings, 'wind').reOn : undefined);
  return REON_CHOICES.some(([key]) => key === rule)
    ? (rule as ReOnRule)
    : 'launch';
}

/**
 * The rule shared by every alert, null when they differ.
 * @returns The rule.
 */
export function sharedReOnRule(): ReOnRule | null {
  const rules = new Set(ALERT_KINDS.map((kind) => reOnRuleOf(kind)));
  return rules.size === 1 ? ([...rules][0] ?? null) : null;
}

/**
 * Keep when an alert, or all of them, come back on.
 * @param kind - The alert, or `all`.
 * @param rule - The rule.
 */
export function setReOnRule(kind: AlertKind | 'all', rule: ReOnRule): void {
  const kinds = kind === 'all' ? ALERT_KINDS : [kind];
  updateSettings((settings) => {
    const rules = { ...(settings.alertReOn as object) } as Record<
      string,
      ReOnRule
    >;
    for (const each of kinds) rules[each] = rule;
    settings.alertReOn = rules;
  });
}

/**
 * The words of the rule, under the switch of an alert.
 * @param rule - The rule.
 * @param many - Said of several alerts.
 * @returns The sentence.
 */
export function reOnText(rule: ReOnRule, many = false): string {
  const what = many ? 'Coupées, les alertes' : 'Coupée, l’alerte';
  if (rule === 'trace') {
    return `${what} ${many ? 'se rallument' : 'se rallume'} seule${many ? 's' : ''} à la fin de la prochaine trace.`;
  }
  if (rule === 'midnight') {
    return `${what} ${many ? 'se rallument' : 'se rallume'} seule${many ? 's' : ''} à minuit.`;
  }
  if (rule === 'launch') {
    return `${what} ${many ? 'se rallument' : 'se rallume'} seule${many ? 's' : ''} au prochain lancement de NavIn.`;
  }
  return `${what} ${many ? 'restent coupées' : 'reste coupée'} jusqu’à ce que vous ${many ? 'les' : 'la'} rallumiez.`;
}

function offDayOf(kind: AlertKind, settings: Settings): string | undefined {
  const day =
    kind === 'depth' ? settings.depthOffDay : objectOf(settings, kind).offDay;
  return typeof day === 'string' ? day : undefined;
}

/**
 * Switch back on the alerts whose rule says so, and say it.
 * @param moment - What happens.
 * @returns The alerts switched on.
 */
export function applyReOn(moment: 'launch' | 'tick' | 'trace'): AlertKind[] {
  const settings = state.preferences.settings.peek();
  const today = dayKey(new Date());
  const back = ALERT_KINDS.filter(
    (kind) =>
      !alertOn(kind, settings) &&
      reOnDue(reOnRuleOf(kind), moment, offDayOf(kind, settings), today),
  );
  for (const kind of back) setAlertOn(kind, true);
  if (back.length > 0) {
    const names = back.map((kind) => ALERT_NAMES[kind]).join(', ');
    toast(
      back.length === 1
        ? `🔔 Alerte ${names} de nouveau active`
        : `🔔 Alertes de nouveau actives : ${names}`,
    );
  }
  return back;
}
