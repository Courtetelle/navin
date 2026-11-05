import { useSignals } from '@preact/signals-react/runtime';
import { useLayoutEffect, useRef } from 'react';

import { tipFocus } from '../tips.ts';

import { clockFace, toggleClock } from './clockState.ts';

/**
 * The top bar clock (`#clock`): UTC or zone time, the small label never wider
 * than the time above it.
 * @returns The clock element.
 */
export function Clock() {
  useSignals();
  const face = clockFace.value;
  const focused = tipFocus.value === 'clock';
  const timeReference = useRef<HTMLSpanElement>(null);
  const labelReference = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    // The label style is measured, so it is written here, never by React.
    const time = timeReference.current;
    const label = labelReference.current;
    if (time && label) fitLabel(time, label, face.local);
  }, [face]);
  const classes = ['clock', face.local ? 'tz-local' : 'tz-utc'];
  if (focused) classes.push('tip-focus');
  return (
    <div className={classes.join(' ')} id="clock" onPointerDown={toggleClock}>
      <span className="clock-t" ref={timeReference}>
        {face.time}
      </span>
      <small className="clock-utc" ref={labelReference}>
        {face.local ? 'Zone Time' : 'UTC'}
      </small>
    </div>
  );
}

/**
 * Shrink « Zone Time » to the width of the time (app.js:601); the UTC label
 * has no inline style (legacy rewrote the element at each tick).
 * @param time - The time span.
 * @param label - The small label.
 * @param local - The zone time is shown.
 */
function fitLabel(time: HTMLElement, label: HTMLElement, local: boolean): void {
  if (!local) {
    label.removeAttribute('style');
    return;
  }
  label.style.fontSize = '';
  label.style.whiteSpace = 'nowrap';
  const width = time.getBoundingClientRect().width;
  const labelWidth = label.getBoundingClientRect().width;
  if (labelWidth > width && labelWidth > 0) {
    const size = Number.parseFloat(globalThis.getComputedStyle(label).fontSize);
    label.style.fontSize = `${(((size * width) / labelWidth) * 0.98).toFixed(2)}px`;
  }
}
