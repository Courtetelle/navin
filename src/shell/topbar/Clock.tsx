import { useSignals } from '@preact/signals-react/runtime';
import { useLayoutEffect, useRef } from 'react';

import { useLongPress } from '../../components/shared/useLongPress.ts';
import { tipFocus } from '../tips.ts';

import { clockFace, showSunTimes, toggleClock } from './clockState.ts';

const SUN_LABELS = { rise: 'Lever', set: 'Coucher' } as const;

/**
 * The top bar clock (`#clock`): UTC or zone time, the small label never wider
 * than the time above it. A tap switches UTC / zone time, a long press shows
 * the sunrise and sunset in turn for 6 s.
 * @returns The clock element.
 */
export function Clock() {
  useSignals();
  const face = clockFace.value;
  const focused = tipFocus.value === 'clock';
  const timeReference = useRef<HTMLSpanElement>(null);
  const labelReference = useRef<HTMLElement>(null);
  const press = useLongPress(showSunTimes);
  useLayoutEffect(() => {
    // The label style is measured, so it is written here, never by React.
    const time = timeReference.current;
    const label = labelReference.current;
    if (time && label) fitLabel(time, label, face.local || Boolean(face.sun));
  }, [face]);
  const classes = ['clock', face.local ? 'tz-local' : 'tz-utc'];
  if (focused) classes.push('tip-focus');
  let label = face.local ? 'Zone Time' : 'UTC';
  if (face.sun) {
    label = face.local ? SUN_LABELS[face.sun] : `${SUN_LABELS[face.sun]} UTC`;
  }
  return (
    <div
      className={classes.join(' ')}
      id="clock"
      {...press.handlers}
      onClick={toggleClock}
    >
      <span className="clock-t" ref={timeReference}>
        {face.time}
      </span>
      <small className="clock-utc" ref={labelReference}>
        {label}
      </small>
    </div>
  );
}

/**
 * Shrink « Zone Time » or the sun label to the width of the time (app.js:601);
 * the UTC label has no inline style (legacy rewrote the element at each tick).
 * @param time - The time span.
 * @param label - The small label.
 * @param fit - The label may be wider than the time.
 */
function fitLabel(time: HTMLElement, label: HTMLElement, fit: boolean): void {
  if (!fit) {
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
