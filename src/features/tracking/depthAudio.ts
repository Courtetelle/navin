import { state } from '../../state/index.ts';

interface AudioSessionNavigator {
  audioSession?: { type: string };
}

interface WebkitWindow {
  webkitAudioContext?: typeof AudioContext;
}

let audioContext: AudioContext | null = null;
let siren: { stop: () => void } | null = null;
let hapticSwitch: HTMLLabelElement | null = null;

/**
 * Maximum beep volume, 0 to 1 (legacy `depthVol`).
 * @returns The volume.
 */
export function depthVolume(): number {
  const volume = state.preferences.settings.peek().depthVol;
  return typeof volume === 'number' ? volume : 1;
}

/**
 * Prepare the sound at the first touches: browsers only start audio from a
 * gesture, and on an iPhone in silent mode the `playback` session is what lets
 * the alarm sound.
 */
export function unlockDepthAudio(): void {
  document.addEventListener('pointerdown', prepareAudio, { capture: true });
}

/**
 * One beep whose volume, pitch and length rise with the intensity (legacy `depthBeep`).
 * @param intensity - 0 to 1.
 */
export function depthBeep(intensity: number): void {
  if (!audioContext) return;
  const time = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'square';
  oscillator.frequency.value = 700 + 900 * intensity;
  const volume = (0.05 + 0.9 * intensity) * depthVolume();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(volume, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12 + 0.1 * intensity);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(time);
  oscillator.stop(time + 0.3);
}

/**
 * Under the minimum sounding: a continuous two-tone siren at full volume,
 * whatever the setting (legacy `sirenOn`).
 */
export function sirenOn(): void {
  if (!audioContext || siren) return;
  try {
    siren = startSiren(audioContext);
  } catch {
    // No sound on this device: the screen and the vibrations remain.
  }
}

/**
 * Stop the siren (legacy `sirenOff`).
 */
export function sirenOff(): void {
  siren?.stop();
  siren = null;
}

/**
 * Vibrate at the rhythm of the beeps, longer and in bursts as the margin
 * shrinks (legacy `depthBuzz`).
 * @param intensity - 0 to 1.
 */
export function depthBuzz(intensity: number): void {
  if (state.preferences.settings.peek().depthVib === false) return;
  const length = Math.round(80 + 220 * intensity);
  const count = burstCount(intensity);
  const pattern: number[] = [];
  for (let index = 0; index < count; index++) {
    pattern.push(length);
    if (index < count - 1) pattern.push(70);
  }
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    } else {
      for (let index = 0; index < count; index++) {
        setTimeout(iosTick, index * 120);
      }
    }
  } catch {
    // Vibration refused.
  }
}

/**
 * Long vibration of the danger state.
 */
export function dangerBuzz(): void {
  if (state.preferences.settings.peek().depthVib === false) return;
  try {
    if ('vibrate' in navigator) navigator.vibrate([500, 100, 500]);
    else iosTick();
  } catch {
    // Vibration refused.
  }
}

function burstCount(intensity: number): number {
  if (intensity > 0.66) return 3;
  return intensity > 0.33 ? 2 : 1;
}

function prepareAudio(): void {
  try {
    const session = (navigator as unknown as AudioSessionNavigator)
      .audioSession;
    if (session && session.type !== 'playback') session.type = 'playback';
  } catch {
    // Not supported.
  }
  try {
    const Context =
      globalThis.AudioContext ??
      (globalThis as unknown as WebkitWindow).webkitAudioContext;
    audioContext ??= new Context();
    if (audioContext.state === 'suspended') void audioContext.resume();
  } catch {
    // No sound on this device.
  }
}

function startSiren(context: AudioContext): { stop: () => void } {
  const first = context.createOscillator();
  const second = context.createOscillator();
  const gain = context.createGain();
  const sweep = context.createOscillator();
  const sweepGain = context.createGain();
  const compressor = context.createDynamicsCompressor();
  first.type = 'sawtooth';
  second.type = 'square';
  first.frequency.value = 900;
  second.frequency.value = 905;
  sweep.type = 'triangle';
  sweep.frequency.value = 2.2;
  // Howl between 350 and 1450 Hz.
  sweepGain.gain.value = 550;
  sweep.connect(sweepGain);
  sweepGain.connect(first.frequency);
  sweepGain.connect(second.frequency);
  gain.gain.value = 1;
  first.connect(gain);
  second.connect(gain);
  gain.connect(compressor);
  compressor.connect(context.destination);
  first.start();
  second.start();
  sweep.start();
  return {
    stop: () => {
      try {
        first.stop();
        second.stop();
        sweep.stop();
      } catch {
        // Already stopped.
      }
    },
  };
}

// Safari has no vibration API: toggling a hidden iOS 18 switch gives a small haptic tick.
function iosTick(): void {
  try {
    if (!hapticSwitch) {
      hapticSwitch = document.createElement('label');
      hapticSwitch.style.cssText =
        'position:fixed;left:-99px;top:-99px;opacity:0';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      hapticSwitch.append(input);
      document.body.append(hapticSwitch);
    }
    hapticSwitch.click();
  } catch {
    // No haptics.
  }
}
