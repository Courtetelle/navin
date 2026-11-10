import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initState } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';

interface FakeContext {
  state: string;
  oscillators: number;
}

vi.mock('../windOverlayState.ts', () => ({ addWindFlash: () => undefined }));

const contexts: FakeContext[] = [];

class FakeAudioContext {
  state = 'suspended';
  oscillators = 0;
  currentTime = 0;
  destination = {};
  constructor() {
    contexts.push(this);
  }
  resume(): Promise<void> {
    if (!FakeAudioContext.allow) return Promise.reject(new Error('locked'));
    this.state = 'running';
    return Promise.resolve();
  }
  createOscillator() {
    this.oscillators++;
    const node = {
      type: '',
      frequency: { value: 0 },
      connect: (next: unknown) => next,
      start: () => undefined,
      stop: () => undefined,
    };
    return node;
  }
  createGain() {
    return {
      gain: {
        setValueAtTime: () => undefined,
        linearRampToValueAtTime: () => undefined,
      },
      connect: (next: unknown) => next,
    };
  }
  static allow = false;
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('wind alarm sound', () => {
  beforeEach(() => {
    vi.resetModules();
    contexts.length = 0;
    FakeAudioContext.allow = false;
    initState(createMemoryStorage({}));
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('Audio', undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('beeps at the next touch when the phone refused the sound', async () => {
    const audio = await import('../windAudio.ts');
    audio.unlockAudio();
    await flush();
    audio.playAlarm(2, 25);
    await flush();
    const context = contexts[0] as FakeContext;
    expect(context.oscillators).toBe(0);
    FakeAudioContext.allow = true;
    audio.unlockAudio();
    await flush();
    expect(context.oscillators).toBe(2);
    audio.unlockAudio();
    await flush();
    expect(context.oscillators).toBe(2);
  });

  it('beeps right away when the sound is open', async () => {
    FakeAudioContext.allow = true;
    const audio = await import('../windAudio.ts');
    audio.unlockAudio();
    await flush();
    audio.playAlarm(1);
    expect((contexts[0] as FakeContext).oscillators).toBe(2);
  });
});
