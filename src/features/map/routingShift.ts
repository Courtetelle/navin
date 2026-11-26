import { signal } from '@preact/signals-react';

import type { NavRoute } from '../../model/routes.ts';
import type { RoutingResult } from '../../model/sailRouting.ts';
import type { Boat } from '../../model/types.ts';
import { state, toast } from '../../state/index.ts';

import { runRouting } from './routingRun.ts';
import { showRouting } from './routingShown.ts';
import type {
  RoutingPlan,
  RoutingStats,
  ShownRouting,
} from './routingState.ts';
import {
  routingOverlay,
  routingShape,
  shiftPrefs,
  shownRouting,
} from './routingState.ts';

export type { ShiftPrefs } from './routingState.ts';
export {
  DEFAULT_SHIFT,
  RANK_SPANS,
  SHIFT_STEPS,
  saveShiftPrefs,
  shiftPrefs,
} from './routingState.ts';

/** A routing is being computed again at another ETD. */
export const shiftBusy = signal(false);

type Done = Extract<RoutingResult, { kind: 'done' }>;

/** The routing shown, with what routes it again; `null` if it cannot be. */
function asked(): {
  shown: ShownRouting;
  plan: RoutingPlan;
  route: NavRoute;
  boat: Boat;
} | null {
  const shown = shownRouting.peek();
  const plan = shown?.plan;
  if (!shown || !plan || shown.departMs === undefined) return null;
  const route = state.data.routes
    .peek()
    .find((item) => item.id === plan.routeId);
  const boat = state.data.boats.peek().find((item) => item.id === plan.boatId);
  if (!route || !boat) {
    toast('La route ou le bateau de ce routage n’existe plus.');
    return null;
  }
  return { shown, plan, route, boat };
}

/**
 * Route again at an ETD.
 * @param plan - What the routing was asked with.
 * @param route - The route.
 * @param boat - The boat.
 * @param departMs - The ETD.
 * @returns The routing, or why not.
 */
async function routeAt(
  plan: RoutingPlan,
  route: NavRoute,
  boat: Boat,
  departMs: number,
): Promise<Done | { error: string }> {
  const run = await runRouting(route, boat, departMs, {
    motorBelow: plan.motorBelow,
    motorKn: plan.motorKn,
    motorAssist: plan.motorAssist === true,
    model: plan.model,
    boatId: plan.boatId,
  });
  if (run.kind === 'error') return { error: run.error };
  const { result } = run;
  if (result.kind === 'no-wind') {
    return {
      error: 'La prévision s’arrête avant l’arrivée à cette heure de départ.',
    };
  }
  if (result.kind === 'too-long') {
    return { error: 'Plus de 14 jours de route à cette heure de départ.' };
  }
  return result;
}

/** Run one change of the routing shown, the arrows waiting meanwhile. */
async function busyWith(
  work: (
    ask: NonNullable<ReturnType<typeof asked>>,
  ) => Promise<Done | { error: string } | null>,
  live = false,
  quiet = false,
): Promise<void> {
  if (shiftBusy.peek()) return;
  const ask = asked();
  if (!ask) return;
  shiftBusy.value = true;
  try {
    const result = await work(ask);
    if (!result) return;
    if ('error' in result) {
      if (!quiet) toast(result.error);
      return;
    }
    // Still the routing shown (not erased meanwhile).
    if (shownRouting.peek() !== ask.shown) return;
    showRouting({
      ...routingShape(ask.shown.name, result, ask.route.points),
      plan: ask.plan,
      ...(ask.shown.id ? { id: ask.shown.id } : {}),
      ...(live ? { live: true } : {}),
    });
    if (!live) routingOverlay.value = false;
  } finally {
    shiftBusy.value = false;
  }
}

/** A departure this close to now is « imminent ». */
const NOW_SLACK_MS = 60_000;

/**
 * The ETD can go this many minutes earlier (not before now).
 * @param departMs - The ETD shown.
 * @param minutes - The step.
 * @param now - Now.
 * @returns It can.
 */
export function canGoEarlier(
  departMs: number,
  minutes: number,
  now = Date.now(),
): boolean {
  return departMs - minutes * 60_000 >= now - NOW_SLACK_MS;
}

/**
 * Route again the routing shown, its ETD moved by some minutes, with the
 * wind, the waves and the currents of the new hours along the route; never
 * before now.
 * @param minutes - Minutes later (negative: earlier).
 * @returns When done.
 */
export function shiftRouting(minutes: number): Promise<void> {
  return busyWith(({ shown, plan, route, boat }) => {
    const departMs = shown.departMs as number;
    if (minutes < 0 && !canGoEarlier(departMs, -minutes)) {
      return Promise.resolve({ error: 'Pas de départ avant maintenant.' });
    }
    // From « Départ imminent », the first step counts from now.
    const from = shown.live ? Date.now() : departMs;
    return routeAt(
      plan,
      route,
      boat,
      Math.round((from + minutes * 60_000) / 60_000) * 60_000,
    );
  });
}

/**
 * « Départ imminent »: the routing shown routed again from now.
 * @param quiet - No toast on failure (the regular refresh).
 * @returns When done.
 */
export function departNow(quiet = false): Promise<void> {
  return busyWith(
    ({ plan, route, boat }) =>
      routeAt(plan, route, boat, Math.floor(Date.now() / 60_000) * 60_000),
    true,
    quiet,
  );
}

/** « Départ imminent » is routed again this often. */
export const LIVE_REFRESH_MS = 10 * 60_000;

/**
 * The routing leaving now, routed again once its ETD is 10 minutes old.
 * @param now - Now.
 * @returns When done.
 */
export function refreshLive(now = Date.now()): Promise<void> {
  const shown = shownRouting.peek();
  if (
    !shown?.live ||
    shown.departMs === undefined ||
    now - shown.departMs < LIVE_REFRESH_MS
  ) {
    return Promise.resolve();
  }
  return departNow(true);
}

/**
 * The routings of the next hours sorted from the most efficient to the
 * least (the green sort of the bar), for the routing they were calculated
 * from.
 */
export const rankSort = signal<{
  plan: RoutingPlan;
  rank: number;
  count: number;
} | null>(null);

/** The routings of the green sort, most efficient first. */
let ranked: Done[] = [];

/**
 * Back to « Départ imminent »; in the green sort, to the most efficient.
 * @returns When done.
 */
export function resetRouting(): Promise<void> {
  const sort = rankSort.peek();
  if (sort && sort.plan === shownRouting.peek()?.plan) return showRank(0);
  return departNow();
}

/**
 * Show another routing of the green sort.
 * @param rank - Its rank, 0 the most efficient.
 * @returns When done.
 */
export function showRank(rank: number): Promise<void> {
  const sort = rankSort.peek();
  const result = ranked[rank];
  if (!sort || !result) return Promise.resolve();
  return busyWith(({ plan }) => {
    if (plan !== sort.plan) return Promise.resolve(null);
    rankSort.value = { ...sort, rank };
    return Promise.resolve(result);
  });
}

/**
 * Move in the green sort: toward the less efficient (1) or the more (−1).
 * @param step - How many ranks.
 * @returns When done.
 */
export function stepRank(step: number): Promise<void> {
  const sort = rankSort.peek();
  if (!sort) return Promise.resolve();
  const rank = Math.min(sort.count - 1, Math.max(0, sort.rank + step));
  if (rank === sort.rank) {
    toast(
      rank === 0
        ? 'Déjà le routage le plus efficient'
        : 'Déjà le routage le moins efficient',
    );
    return Promise.resolve();
  }
  return showRank(rank);
}

/** Leave the green sort: the arrows move the hour again. */
export function leaveRankSort(): void {
  rankSort.value = null;
  ranked = [];
}

/**
 * The worth of a routing: the shorter the better, the motor counting half
 * more (less efficient under sail, fuel).
 * @param result - The routing.
 * @returns Minutes, the less the better.
 */
export function routingCost(result: Done): number {
  const departMs = result.steps[0]?.ms ?? result.arriveMs;
  return (result.arriveMs - departMs) / 60_000 + result.motorMin / 2;
}

/**
 * The ETDs of the sort: from now (rounded up to the step) over the next
 * hours set, at most about 25.
 * @param hours - The span, hours.
 * @param stepMin - The step of the arrows, minutes.
 * @param now - Now.
 * @returns The ETDs, epoch ms.
 */
export function rankDeparts(
  hours: number,
  stepMin: number,
  now = Date.now(),
): number[] {
  const minutes = Math.max(30, stepMin, Math.ceil((hours * 60) / 24 / 30) * 30);
  const step = minutes * 60_000;
  const first = Math.ceil(now / step) * step;
  const departs: number[] = [];
  for (let at = first; at <= now + hours * 3_600_000; at += step) {
    departs.push(at);
  }
  return departs;
}

/** Every ETD of the next hours set, routed; why not when none. */
async function routeAhead(
  plan: RoutingPlan,
  route: NavRoute,
  boat: Boat,
): Promise<Done[] | { error: string }> {
  const prefs = shiftPrefs.peek();
  const found: Done[] = [];
  let lastError = '';
  for (const departMs of rankDeparts(prefs.rankHours, prefs.stepMin)) {
    // eslint-disable-next-line no-await-in-loop -- one routing after the other
    const result = await routeAt(plan, route, boat, departMs);
    if ('error' in result) lastError = result.error;
    else found.push(result);
  }
  if (found.length === 0) {
    return { error: lastError || 'Aucun départ possible sur cette plage.' };
  }
  return sortByCost(found);
}

/** The most efficient routing of the next hours, for the label. */
export interface BestAhead {
  /** The routing it is for (route, boat, motor, model). */
  key: string;
  hours: number;
  departMs: number;
  /** Its length, minutes. */
  lengthMin: number;
  /** The earliest departure of the span, and its length, minutes. */
  soonDepartMs: number;
  soonLengthMin: number;
  /** Its motor, minutes. */
  motorMin: number;
  /** When it was found. */
  at: number;
}

/** The most efficient routing of the next hours, found in the background. */
export const bestAhead = signal<BestAhead | null>(null);

/**
 * What a routing was asked with, without its first routing.
 * @param plan - The plan.
 * @returns A key.
 */
export function planKey(plan: RoutingPlan): string {
  const { base: _base, ...asked } = plan;
  return JSON.stringify(asked);
}

function departOf(result: Done): number {
  return result.steps[0]?.ms ?? result.arriveMs;
}

function keepBest(plan: RoutingPlan, found: readonly Done[]): void {
  const best = found[0];
  if (!best) return;
  let soon = best;
  for (const result of found) {
    if (departOf(result) < departOf(soon)) soon = result;
  }
  const departMs = departOf(best);
  const soonDepartMs = departOf(soon);
  bestAhead.value = {
    key: planKey(plan),
    hours: shiftPrefs.peek().rankHours,
    departMs,
    lengthMin: (best.arriveMs - departMs) / 60_000,
    soonDepartMs,
    soonLengthMin: (soon.arriveMs - soonDepartMs) / 60_000,
    motorMin: best.motorMin,
    at: Date.now(),
  };
}

/** Found again this often (the forecast is kept 30 minutes). */
const BEST_FRESH_MS = 30 * 60_000;

/** The best departure is being looked for. */
const seeking = { on: false };

/**
 * Find in the background the most efficient routing of the next hours set,
 * for the label of the routing shown (its length against it).
 * @returns When done.
 */
export async function findBestAhead(): Promise<void> {
  const ask = asked();
  if (!ask || seeking.on) return;
  // The green sort shown found it: one best departure, the same for all.
  if (rankSort.peek()?.plan === ask.plan) return;
  const known = bestAhead.peek();
  if (
    known?.key === planKey(ask.plan) &&
    known.hours === shiftPrefs.peek().rankHours &&
    Date.now() - known.at < BEST_FRESH_MS &&
    known.departMs >= Date.now() - 60_000
  ) {
    return;
  }
  seeking.on = true;
  try {
    const found = await routeAhead(ask.plan, ask.route, ask.boat);
    if (Array.isArray(found)) keepBest(ask.plan, found);
  } finally {
    seeking.on = false;
  }
}

/**
 * The green sort: every ETD of the next hours set (6, 12 or 24, from now),
 * routed and sorted from the most efficient (the fastest, the motor
 * counting half more) to the least; the most efficient shown.
 * @returns When done.
 */
export function sortAhead(): Promise<void> {
  return busyWith(async ({ plan, route, boat }) => {
    const found = await routeAhead(plan, route, boat);
    if (!Array.isArray(found)) return found;
    ranked = found;
    const best = found[0] as Done;
    keepBest(plan, found);
    rankSort.value = { plan, rank: 0, count: ranked.length };
    toast(
      `${ranked.length} routages des ${shiftPrefs.peek().rankHours} prochaines heures, du plus au moins efficient : ▼ le suivant, ▲ le précédent`,
    );
    return best;
  });
}

/**
 * Routings sorted from the most efficient to the least.
 * @param results - The routings.
 * @returns A sorted copy.
 */
export function sortByCost(results: readonly Done[]): Done[] {
  return results.toSorted((one, two) => routingCost(one) - routingCost(two));
}

/**
 * What the ETD moved changes against the first routing.
 * @param now - The figures now.
 * @param base - The figures of the first routing.
 * @param nowMin - Its length now, minutes.
 * @param baseMin - The length of the first, minutes.
 * @returns The changes, shortest first; empty when none.
 */
export function routingChanges(
  now: RoutingStats,
  base: RoutingStats,
  nowMin: number,
  baseMin: number,
): string[] {
  const minutes = (value: number) => {
    const sign = value > 0 ? '+' : '−';
    const all = Math.round(Math.abs(value));
    const h = Math.floor(all / 60);
    const m = all % 60;
    return `${sign}${h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`}`;
  };
  const changes: string[] = [];
  const length = nowMin - baseMin;
  if (Math.abs(length) >= 5) changes.push(`durée ${minutes(length)}`);
  const motor = now.motorMin - base.motorMin;
  if (Math.abs(motor) >= 5) changes.push(`moteur ${minutes(motor)}`);
  const tacks = now.tacks - base.tacks;
  if (tacks !== 0) {
    changes.push(
      `${tacks > 0 ? '+' : '−'}${Math.abs(tacks)} virement${Math.abs(tacks) > 1 ? 's' : ''}`,
    );
  }
  const gybes = now.gybes - base.gybes;
  if (gybes !== 0) {
    changes.push(
      `${gybes > 0 ? '+' : '−'}${Math.abs(gybes)} empannage${Math.abs(gybes) > 1 ? 's' : ''}`,
    );
  }
  return changes;
}
