import { signal } from '@preact/signals-react';

import { state, toast } from '../../state/index.ts';

import { runRouting } from './routingRun.ts';
import { showRouting } from './routingShown.ts';
import type { RoutingStats, ShownRouting } from './routingState.ts';
import { routingShape, shownRouting } from './routingState.ts';

/** A routing is being computed again at another ETD. */
export const shiftBusy = signal(false);

/**
 * Route again the routing shown, its ETD moved by whole hours: the wind,
 * the waves and the currents of the new hours along the route.
 * @param hours - Hours later (negative: earlier).
 * @returns When done.
 */
export async function shiftRouting(hours: number): Promise<void> {
  const shown = shownRouting.peek();
  const plan = shown?.plan;
  if (!shown || !plan || shown.departMs === undefined || shiftBusy.peek()) {
    return;
  }
  const route = state.data.routes
    .peek()
    .find((item) => item.id === plan.routeId);
  const boat = state.data.boats.peek().find((item) => item.id === plan.boatId);
  if (!route || !boat) {
    toast('La route ou le bateau de ce routage n’existe plus.');
    return;
  }
  const departMs = shown.departMs + hours * 3_600_000;
  shiftBusy.value = true;
  try {
    const run = await runRouting(route, boat, departMs, {
      motorBelow: plan.motorBelow,
      motorKn: plan.motorKn,
      motorAssist: plan.motorAssist === true,
      model: plan.model,
      boatId: plan.boatId,
    });
    if (run.kind === 'error') {
      toast(run.error);
      return;
    }
    const { result } = run;
    if (result.kind === 'no-wind') {
      toast('La prévision s’arrête avant l’arrivée à cette heure de départ.');
      return;
    }
    if (result.kind === 'too-long') {
      toast('Plus de 14 jours de route à cette heure de départ.');
      return;
    }
    // Still the routing shown (not erased meanwhile).
    if (shownRouting.peek() !== shown) return;
    const next: ShownRouting = {
      ...routingShape(shown.name, result, route.points),
      plan,
      ...(shown.id ? { id: shown.id } : {}),
    };
    showRouting(next);
  } finally {
    shiftBusy.value = false;
  }
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
