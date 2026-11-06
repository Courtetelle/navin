/** Timers started by one effect, stopped together by its cleanup. */
export interface TimerGroup {
  /** Run an action after a delay in milliseconds. */
  after: (delay: number, action: () => void) => void;
  /** Stop every timer still pending. */
  clear: () => void;
}

/**
 * Timers that one cleanup can stop, however many callbacks started them.
 * @returns The group.
 */
export function createTimerGroup(): TimerGroup {
  const pending = new Set<ReturnType<typeof setTimeout>>();
  return {
    after: (delay, action) => {
      const timer = setTimeout(() => {
        pending.delete(timer);
        action();
      }, delay);
      pending.add(timer);
    },
    clear: () => {
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    },
  };
}
