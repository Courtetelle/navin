import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useRef } from 'react';

import { wakeVideoOn } from './wake.ts';

const STYLE = {
  position: 'fixed',
  width: '1px',
  height: '1px',
  opacity: 0,
  pointerEvents: 'none',
  left: 0,
  top: 0,
} as const;

/**
 * The muted looping video fed by a 2 × 2 canvas that flickers once a second,
 * which keeps the screen on where Wake Lock is missing (app.js:609-624).
 * @returns The video element, or nothing.
 */
export function WakeVideo() {
  useSignals();
  return wakeVideoOn.value ? <WakeVideoElement /> : null;
}

function WakeVideoElement() {
  const reference = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = reference.current;
    if (!video) return undefined;
    // React sets `muted` as a property only; legacy also wrote the attribute.
    video.setAttribute('muted', '');
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const context = canvas.getContext('2d');
    let frame = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    if (typeof canvas.captureStream === 'function') {
      video.srcObject = canvas.captureStream(1);
      interval = setInterval(() => {
        if (!context) return;
        context.fillStyle = frame++ % 2 ? '#000' : '#010101';
        context.fillRect(0, 0, 2, 2);
      }, 1000);
    }
    if (video.paused) video.play().catch(() => undefined);
    return () => {
      clearInterval(interval);
      video.pause();
    };
  }, []);
  return <video ref={reference} muted loop playsInline style={STYLE} />;
}
