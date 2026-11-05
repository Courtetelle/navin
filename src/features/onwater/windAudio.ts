import { bft } from '../../lib/wind.ts';
import { BFT_KN } from '../../model/lists.ts';

import { flashColor, flashInk } from './windLogic.ts';
import { addWindFlash } from './windOverlayState.ts';

const SIGNAL_MS = 1200;
const PAUSE_MS = 400;

let audioContext: AudioContext | null = null;
let keepAlive: HTMLAudioElement | null = null;

/** Sound can only be unlocked by a touch: run it on each touch while the alerts are on. */
export function unlockAudio(): void {
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state !== 'running') void audioContext.resume();
  } catch {
    audioContext = null;
  }
  try {
    if (!keepAlive) {
      keepAlive = new Audio(silentWavUrl());
      keepAlive.loop = true;
      keepAlive.setAttribute('playsinline', '');
    }
    if (keepAlive.paused) keepAlive.play().catch(() => undefined);
  } catch {
    // No audio on this device.
  }
}

/** Wake the audio output when the app comes back to the foreground. */
export function resumeAudio(): void {
  if (audioContext && audioContext.state !== 'running') {
    audioContext.resume().catch(() => undefined);
  }
}

/**
 * Two beeps and two colour flashes showing the wind (legacy `playAlarm`).
 * @param level - Alert level, sets the tone, the volume and the colour.
 * @param knots - Wind shown; the level's threshold by default.
 */
export function playAlarm(level: number, knots?: number): void {
  if (audioContext && audioContext.state !== 'running') {
    audioContext
      .resume()
      .then(() => playTones(level))
      .catch(() => undefined);
    showFlash(level, knots);
    return;
  }
  playTones(level);
  showFlash(level, knots);
}

function showFlash(level: number, knots: number | undefined): void {
  const color = flashColor(level);
  const shown =
    knots != null && !Number.isNaN(knots)
      ? Math.round(knots)
      : (BFT_KN[Math.min(level + 3, 11)] as number);
  addWindFlash({
    color,
    ink: flashInk(color),
    knots: shown,
    force: bft(shown),
  });
  navigator.vibrate?.([SIGNAL_MS, PAUSE_MS, SIGNAL_MS]);
}

function playTones(level: number): void {
  if (!audioContext) return;
  const context = audioContext;
  const volume = Math.min(1, 0.35 + level * 0.15);
  const start = context.currentTime + 0.05;
  for (const offset of [0, SIGNAL_MS + PAUSE_MS]) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const from = start + offset / 1000;
    const to = start + (offset + SIGNAL_MS) / 1000;
    oscillator.type = 'square';
    oscillator.frequency.value = 880 + level * 60;
    gain.gain.setValueAtTime(0, from);
    gain.gain.linearRampToValueAtTime(volume, from + 0.01);
    gain.gain.setValueAtTime(volume, to - 0.01);
    gain.gain.linearRampToValueAtTime(0, to);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(from);
    oscillator.stop(to + 0.02);
  }
}

// A silent WAV played in a loop keeps the audio output open on iPhone, where
// the second beep can otherwise stay mute.
function silentWavUrl(): string {
  const samples = 8000;
  const buffer = new ArrayBuffer(44 + samples);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) {
      view.setUint8(offset + index, value.codePointAt(index) as number);
    }
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, 'data');
  view.setUint32(40, samples, true);
  for (let index = 0; index < samples; index++) {
    view.setUint8(44 + index, 128);
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}
