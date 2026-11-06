import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  holdScrollAnchoring,
  installTapScrollHold,
  suspendScrollAnchoring,
} from '../scrollAnchor.ts';

const style = {
  overflowAnchor: '',
  removeProperty: (name: string) => {
    expect(name).toBe('overflow-anchor');
    style.overflowAnchor = '';
  },
};
const listeners = new Map<string, (event: Event) => void>();

beforeEach(() => {
  vi.useFakeTimers();
  style.overflowAnchor = '';
  listeners.clear();
  vi.stubGlobal('document', {
    documentElement: { style },
    addEventListener: (name: string, listener: (event: Event) => void) => {
      listeners.set(name, listener);
    },
    removeEventListener: (name: string) => {
      listeners.delete(name);
    },
  });
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
    setTimeout(callback, 16);
  });
  vi.stubGlobal('Element', FakeElement);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

class FakeElement {
  fold: boolean;

  constructor(fold: boolean) {
    this.fold = fold;
  }

  closest(): FakeElement | null {
    return this.fold ? this : null;
  }
}

test('anchoring stays off until the last suspension is released', () => {
  const first = suspendScrollAnchoring();
  const second = suspendScrollAnchoring();
  expect(style.overflowAnchor).toBe('none');
  first();
  first();
  expect(style.overflowAnchor).toBe('none');
  second();
  expect(style.overflowAnchor).toBe('');
});

test('a hold ends after the next frame', () => {
  holdScrollAnchoring();
  vi.advanceTimersByTime(15);
  expect(style.overflowAnchor).toBe('none');
  vi.advanceTimersByTime(2);
  expect(style.overflowAnchor).toBe('');
});

test('a tap holds the position, a fold keeps the anchoring', () => {
  const remove = installTapScrollHold();
  listeners.get('click')?.({ target: new FakeElement(true) } as never);
  expect(style.overflowAnchor).toBe('');
  listeners.get('click')?.({ target: new FakeElement(false) } as never);
  expect(style.overflowAnchor).toBe('none');
  vi.advanceTimersByTime(17);
  remove();
  expect([...listeners.keys()]).toStrictEqual([]);
});
