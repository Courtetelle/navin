import { describe, expect, it } from 'vitest';

import type { ScreenBox } from '../zoneFit.ts';
import { edgesOf } from '../zoneFit.ts';

const box = (
  left: number,
  top: number,
  right: number,
  bottom: number,
): ScreenBox => ({ left, top, right, bottom });

describe('edgesOf', () => {
  it('a column of rail buttons down the left keeps the left clear, not the height', () => {
    // SP10X landscape: eight buttons down the left, LiveMétéo in a row.
    const rails = Array.from({ length: 8 }, (_, rank) =>
      box(10, 10 + rank * 98, 110, 90 + rank * 98),
    );
    const rows = [box(120, 480, 1030, 540)];
    const edges = edgesOf(rails, rows, 1280, 800);
    expect(edges.left).toBe(110);
    expect(edges.right).toBe(0);
    expect(edges.top).toBe(0);
    expect(edges.bottom).toBe(320);
    // The zones keep most of the screen.
    expect(800 - edges.top - edges.bottom).toBeGreaterThan(400);
  });

  it('a row of rail buttons along the bottom keeps the bottom clear', () => {
    const rails = [box(10, 780, 90, 840), box(100, 780, 180, 840)];
    const edges = edgesOf(rails, [], 390, 844);
    expect(edges.bottom).toBe(64);
    expect(edges.left).toBe(0);
  });

  it('never keeps more than 45 % of a side', () => {
    const edges = edgesOf([], [box(0, 100, 400, 700)], 400, 800);
    expect(edges.bottom).toBeLessThanOrEqual(360);
  });

  it('leaves out hidden buttons', () => {
    const edges = edgesOf([box(0, 0, 0, 0)], [], 800, 600);
    expect(edges).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });
});
