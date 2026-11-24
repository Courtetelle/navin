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
  ShiftPrefs,
  ShownRouting,
} from './routingState.ts';
import { routingShape, shiftPrefs, shownRouting } from './routingState.ts';

export type { ShiftPrefs } from './routingState.ts';
export {
  DEFAULT_SHIFT,
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
): Promise<void> {
  if (shiftBusy.peek()) return;
  const ask = asked();
  if (!ask) return;
  shiftBusy.value = true;
  try {
    const result = await work(ask);
    if (!result) return;
    if ('error' in result) {
      toast(result.error);
      return;
    }
    // Still the routing shown (not erased meanwhile).
    if (shownRouting.peek() !== ask.shown) return;
    showRouting({
      ...routingShape(ask.shown.name, result, ask.route.points),
      plan: ask.plan,
      ...(ask.shown.id ? { id: ask.shown.id } : {}),
    });
  } finally {
    shiftBusy.value = false;
  }
}

/**
 * Route again the routing shown, moved by some minutes: its ETD, or its ETA
 * (the ETD found again so that it arrives then), with the wind, the waves
 * and the currents of the new hours along the route.
 * @param minutes - Minutes later (negative: earlier).
 * @param moves - What moves: the ETD or the ETA.
 * @returns When done.
 */
export function shiftRouting(
  minutes: number,
  moves: ShiftPrefs['moves'] = shiftPrefs.peek().moves,
): Promise<void> {
  return busyWith(async ({ shown, plan, route, boat }) => {
    const step = minutes * 60_000;
    const departMs = shown.departMs as number;
    if (moves === 'etd') return routeAt(plan, route, boat, departMs + step);
    // The ETA asked: a few tries, the ETD moved by what is still missing.
    const wanted = (shown.arriveMs ?? departMs) + step;
    let depart = departMs + step;
    let result = await routeAt(plan, route, boat, depart);
    for (let tries = 0; tries < 3 && !('error' in result); tries++) {
      const missing = wanted - result.arriveMs;
      if (Math.abs(missing) < 5 * 60_000) break;
      depart += missing;
      // eslint-disable-next-line no-await-in-loop -- each try follows the last
      result = await routeAt(plan, route, boat, depart);
    }
    return result;
  });
}

/**
 * The routings of the day sorted from the most efficient to the least (the
 * green sort of the bar), for the routing they were calculated from.
 */
export const daySort = signal<{
  plan: RoutingPlan;
  rank: number;
  count: number;
} | null>(null);

/** The routings of the green sort, most efficient first. */
let ranked: Done[] = [];

/**
 * Back to the routing first calculated; in the green sort, to the most
 * efficient of the day.
 * @returns When done.
 */
export function resetRouting(): Promise<void> {
  const sort = daySort.peek();
  if (sort && sort.plan === shownRouting.peek()?.plan) return showRank(0);
  return busyWith(({ plan, route, boat }) =>
    routeAt(plan, route, boat, plan.base.departMs),
  );
}

/**
 * Show another routing of the green sort.
 * @param rank - Its rank, 0 the most efficient.
 * @returns When done.
 */
export function showRank(rank: number): Promise<void> {
  const sort = daySort.peek();
  const result = ranked[rank];
  if (!sort || !result) return Promise.resolve();
  return busyWith(({ plan }) => {
    if (plan !== sort.plan) return Promise.resolve(null);
    daySort.value = { ...sort, rank };
    return Promise.resolve(result);
  });
}

/**
 * Move in the green sort: toward the less efficient (1) or the more (−1).
 * @param step - How many ranks.
 * @returns When done.
 */
export function stepRank(step: number): Promise<void> {
  const sort = daySort.peek();
  if (!sort) return Promise.resolve();
  const rank = Math.min(sort.count - 1, Math.max(0, sort.rank + step));
  if (rank === sort.rank) {
    toast(
      rank === 0
        ? 'Déjà le routage le plus efficient du jour'
        : 'Déjà le routage le moins efficient du jour',
    );
    return Promise.resolve();
  }
  return showRank(rank);
}

/** Leave the green sort: the arrows move the hour again. */
export function leaveDaySort(): void {
  daySort.value = null;
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
 * The green sort: every ETD of the day of the ETD shown (not before now),
 * routed and sorted from the most efficient (the fastest, the motor
 * counting half more) to the least; the most efficient shown.
 * @returns When done.
 */
export function sortDay(): Promise<void> {
  return busyWith(async ({ shown, plan, route, boat }) => {
    const day = new Date(shown.departMs as number);
    day.setHours(0, 0, 0, 0);
    const step = Math.max(30, shiftPrefs.peek().stepMin) * 60_000;
    const first = Math.max(day.getTime(), Math.ceil(Date.now() / step) * step);
    const end = day.getTime() + 86_400_000;
    const found: Done[] = [];
    let lastError = '';
    for (let departMs = first; departMs < end; departMs += step) {
      // eslint-disable-next-line no-await-in-loop -- one routing after the other
      const result = await routeAt(plan, route, boat, departMs);
      if ('error' in result) lastError = result.error;
      else found.push(result);
    }
    const best = sortByCost(found)[0];
    if (!best) return { error: lastError || 'Aucun départ possible ce jour.' };
    ranked = sortByCost(found);
    daySort.value = { plan, rank: 0, count: ranked.length };
    toast(
      `${ranked.length} routages du jour, du plus au moins efficient : ▼ le suivant, ▲ le précédent`,
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
