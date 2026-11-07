import type { Map as LeafletMap } from 'leaflet';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { RECENTER_DELAY_MS, recenterAfterDrag } from '../recenterAfterDrag.ts';
import type { TrackerHandle } from '../trackerState.ts';
import { newTracker, setFollow, tracker } from '../trackerState.ts';

const BOAT = { lat: 46.45, lng: 6.6 };

function openTracker() {
  const listeners = new Map<string, Array<() => void>>();
  const setView = vi.fn();
  const map = {
    on(names: string, listener: () => void) {
      for (const name of names.split(' ')) {
        listeners.set(name, [...(listeners.get(name) ?? []), listener]);
      }
    },
    getContainer: () => ({ isConnected: true, querySelector: () => null }),
    getZoom: () => 15,
    setView,
  };
  const handle: TrackerHandle = newTracker();
  handle.map = map as unknown as LeafletMap;
  handle.me = { getLatLng: () => BOAT } as unknown as TrackerHandle['me'];
  tracker.current = handle;
  recenterAfterDrag(handle.map, handle);
  const fire = (name: string) => {
    for (const listener of listeners.get(name) ?? []) listener();
  };
  return { handle, setView, fire };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  tracker.current = null;
});

test('the map comes back to the boat 7 s after the finger left it', () => {
  const { handle, setView, fire } = openTracker();
  fire('dragstart');
  expect(handle.follow).toBe(false);
  fire('dragend');
  vi.advanceTimersByTime(RECENTER_DELAY_MS - 1);
  expect(setView).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(setView).toHaveBeenCalledWith(BOAT, 15);
  expect(handle.follow).toBe(true);
});

test('it does not come back while the finger holds the map', () => {
  const { setView, fire } = openTracker();
  fire('dragstart');
  vi.advanceTimersByTime(RECENTER_DELAY_MS * 2);
  expect(setView).not.toHaveBeenCalled();
});

test('moving or zooming again starts the wait again', () => {
  const { setView, fire } = openTracker();
  fire('dragstart');
  fire('dragend');
  vi.advanceTimersByTime(RECENTER_DELAY_MS - 1);
  fire('dragstart');
  fire('dragend');
  vi.advanceTimersByTime(RECENTER_DELAY_MS - 1);
  fire('zoomstart');
  vi.advanceTimersByTime(RECENTER_DELAY_MS * 2);
  expect(setView).not.toHaveBeenCalled();
  fire('zoomend');
  vi.advanceTimersByTime(RECENTER_DELAY_MS);
  expect(setView).toHaveBeenCalledTimes(1);
});

test('it waits for an open popup to close', () => {
  const { setView, fire } = openTracker();
  fire('dragstart');
  fire('dragend');
  fire('popupopen');
  vi.advanceTimersByTime(RECENTER_DELAY_MS * 2);
  expect(setView).not.toHaveBeenCalled();
  fire('dragstart');
  fire('dragend');
  vi.advanceTimersByTime(RECENTER_DELAY_MS * 2);
  expect(setView).not.toHaveBeenCalled();
  fire('popupclose');
  vi.advanceTimersByTime(RECENTER_DELAY_MS);
  expect(setView).toHaveBeenCalledTimes(1);
});

test('a popup closing does not recentre a map that follows', () => {
  const { setView, fire } = openTracker();
  fire('popupopen');
  fire('popupclose');
  vi.advanceTimersByTime(RECENTER_DELAY_MS);
  expect(setView).not.toHaveBeenCalled();
});

test('a place asked for stays on screen, even when moved', () => {
  const { handle, setView, fire } = openTracker();
  setFollow(false);
  fire('dragstart');
  fire('dragend');
  vi.advanceTimersByTime(RECENTER_DELAY_MS);
  expect(setView).not.toHaveBeenCalled();
  expect(handle.follow).toBe(false);
});

test('showing a place during the wait keeps it on screen', () => {
  const { handle, setView, fire } = openTracker();
  fire('dragstart');
  fire('dragend');
  setFollow(false);
  vi.advanceTimersByTime(RECENTER_DELAY_MS);
  expect(setView).not.toHaveBeenCalled();
  expect(handle.follow).toBe(false);
});

test('without a known position it only follows again', () => {
  const { handle, setView, fire } = openTracker();
  handle.me = null;
  fire('dragstart');
  fire('dragend');
  vi.advanceTimersByTime(RECENTER_DELAY_MS);
  expect(setView).not.toHaveBeenCalled();
  expect(handle.follow).toBe(true);
});

test('a map gone from the screen does not move', () => {
  const { handle, setView, fire } = openTracker();
  fire('dragstart');
  fire('dragend');
  (handle.map as unknown as { getContainer: () => unknown }).getContainer =
    () => ({ isConnected: false });
  vi.advanceTimersByTime(RECENTER_DELAY_MS);
  expect(setView).not.toHaveBeenCalled();
});
