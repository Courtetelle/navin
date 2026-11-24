import { afterEach, describe, expect, it, vi } from 'vitest';

import { destination } from '../../../lib/geo.ts';
import type { RoutingResult, RoutingStep } from '../../../model/sailRouting.ts';
import { state } from '../../../state/index.ts';
import { gotoTarget, gotoUpdate, setGoto } from '../goto.ts';
import {
  boxEdge,
  clearRouting,
  gotoRouting,
  markHtml,
  placeMarks,
  showRouting,
} from '../routingShown.ts';
import {
  removeRouting,
  routingLeg,
  routingShape,
  saveRouting,
  savedRoutings,
  shownRouting,
} from '../routingState.ts';

const A = { lat: 48.65, lon: -2.83 };
const B = destination(A, 0, 2);
const C = destination(B, 90, 2);

function step(at: { lat: number; lon: number }, rank: number): RoutingStep {
  return {
    ms: Date.UTC(2027, 5, 12, 8) + rank * 600_000,
    lat: at.lat,
    lon: at.lon,
    mode: 'sail',
    course: rank < 6 ? 0 : 90,
    kn: 6,
    twd: 270,
    tws: 12,
    twa: 90,
    side: 'bâbord',
    sails: 'Polaire',
    toPoint: rank < 6 ? 1 : 2,
    sog: 6,
    cog: rank < 6 ? 0 : 90,
    driftKn: 1.2,
    setDeg: 45,
    waveM: rank > 0 ? 1 : Number.NaN,
    waveFrom: rank > 0 ? 300 : Number.NaN,
    wavePeriod: rank > 0 ? 6 : Number.NaN,
    awa: 60,
    aws: 14.5,
  };
}

const steps = [
  ...Array.from({ length: 6 }, (_, rank) =>
    step(destination(A, 0, (rank * 2) / 6), rank),
  ),
  ...Array.from({ length: 6 }, (_, rank) =>
    step(destination(B, 90, (rank * 2) / 6), rank + 6),
  ),
];

const done: Extract<RoutingResult, { kind: 'done' }> = {
  kind: 'done',
  steps,
  legs: [],
  arriveMs: Date.UTC(2027, 5, 12, 10),
  nm: 4,
  sailMin: 120,
  motorMin: 0,
  tacks: 0,
  gybes: 0,
};

function at(where: { lat: number; lon: number }): void {
  state.view.myPos.value = { ...where, sog: 6, cog: 0, t: Date.now() };
}

afterEach(() => {
  for (const saved of savedRoutings.value) removeRouting(saved.id);
  clearRouting();
  setGoto(null);
  state.view.myPos.value = null;
  vi.useRealTimers();
});

describe('routingShape', () => {
  it('keeps the way, the turns and evenly spaced wind, current and waves', () => {
    const shown = routingShape('Essai', done, [A, B, C]);
    expect(shown.track).toHaveLength(steps.length + 1);
    expect(shown.turns).toHaveLength(3);
    expect(shown.marks.length).toBeGreaterThan(3);
    expect(shown.marks.length).toBeLessThanOrEqual(steps.length);
    expect(shown.marks[0]).toMatchObject({
      twd: 270,
      driftKn: 1.2,
      waveM: null,
    });
  });
});

describe('markHtml', () => {
  it('draws the wind barb, the waves and the current as LiveMétéo, and the apparent wind', () => {
    const wavy = routingShape('Essai', done, [A, B, C]).marks.find(
      (mark) => mark.waveM !== null,
    );
    if (!wavy) throw new Error('no mark');
    const html = markHtml(wavy);
    expect(html.match(/<svg/g)).toHaveLength(3);
    expect(html).toContain('wx-dg');
    expect(html).toContain('wx-cur');
    expect(html).toContain('∡ 60° Bd');
  });
});

describe('routingLeg', () => {
  it('aims at the end of the nearest leg, then the next, never back', () => {
    const turns = [A, B, C];
    expect(routingLeg(turns, destination(A, 0, 1))).toBe(1);
    expect(routingLeg(turns, destination(B, 90, 1))).toBe(2);
    expect(routingLeg(turns, B)).toBe(2);
    expect(routingLeg(turns, destination(A, 0, 0.5), 2)).toBe(2);
  });
});

describe('Go to along the routing', () => {
  it('passes from one leg to the next as the boat goes', () => {
    showRouting(routingShape('Essai', done, [A, B, C]));
    expect(shownRouting.value?.name).toBe('Essai');
    at(destination(A, 0, 0.5));
    gotoRouting();
    expect(gotoTarget.value?.leg).toBe(1);
    expect(gotoTarget.value?.name).toContain('segment 1/2');
    at(destination(B, 90, 0.3));
    gotoUpdate();
    expect(gotoTarget.value?.leg).toBe(2);
    expect(gotoTarget.value?.name).toContain('arrivée');
    clearRouting();
    expect(gotoTarget.value).toBeNull();
  });
});

describe('Routages', () => {
  it('keeps a routing once under its id, newest first, and removes it', () => {
    const shown = { ...routingShape('Essai', done, [A, B, C]), id: 'r1' };
    const saved = {
      id: 'r1',
      at: '',
      departMs: 0,
      arriveMs: done.arriveMs,
      nm: 4,
      summary: '',
      model: 'best_match',
      shown,
    };
    saveRouting(saved);
    saveRouting({ ...saved, nm: 5 });
    saveRouting({ ...saved, id: 'r2' });
    expect(savedRoutings.value.map((item) => item.id)).toStrictEqual([
      'r2',
      'r1',
    ]);
    expect(savedRoutings.value[1]?.nm).toBe(5);
    removeRouting('r2');
    expect(savedRoutings.value).toHaveLength(1);
  });
});

describe('placeMarks', () => {
  it('keeps as many places as fit, set off one side then the other', () => {
    const down = Array.from({ length: 40 }, (_, rank) => ({
      x: 100,
      y: rank * 10,
    }));
    const placed = placeMarks(down);
    // Down the screen, a box takes half its height on each side: ~56 px.
    expect(placed.length).toBeGreaterThan(5);
    expect(placed.length).toBeLessThan(10);
    expect(Math.sign(placed[0]?.dx ?? 0)).toBe(-Math.sign(placed[1]?.dx ?? 0));
    expect(Math.abs(placed[0]?.dx ?? 0)).toBeGreaterThan(98);
    const across = Array.from({ length: 40 }, (_, rank) => ({
      x: rank * 10,
      y: 100,
    }));
    // Across the screen, the boxes are wider: fewer of them.
    expect(placeMarks(across).length).toBeLessThan(placed.length);
  });
});

describe('boxEdge', () => {
  it('ends the line from the route at the edge of the label', () => {
    // Set off sideways: the edge is half the width short of the centre.
    const side = boxEdge(200, 0);
    expect(side.y).toBe(0);
    expect(side.x).toBeGreaterThan(0);
    expect(side.x).toBeLessThan(200);
    // A label over the point: no line.
    expect(boxEdge(10, 5)).toStrictEqual({ x: 0, y: 0 });
  });
});
