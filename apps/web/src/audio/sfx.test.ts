import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { useSettings } from '../state/settings';
import { SFX_NAMES, sfx } from './sfx';

/** Minimal Web Audio stand-in that records which sound sources were scheduled. */
class FakeParam {
  value = 0;
  events: [string, number][] = [];
  setValueAtTime(v: number) {
    this.events.push(['set', v]);
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number) {
    this.events.push(['ramp', v]);
    return this;
  }
  setTargetAtTime(v: number) {
    this.value = v;
    return this;
  }
}

class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  detune = new FakeParam();
  Q = new FakeParam();
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
  type = '';
  buffer: unknown = null;
  connect<T>(n: T): T {
    return n;
  }
}

class FakeSource extends FakeNode {
  started = false;
  stopped = false;
  constructor(private log: FakeSource[]) {
    super();
  }
  start() {
    this.started = true;
    this.log.push(this);
  }
  stop() {
    this.stopped = true;
  }
}

class FakeAudioContext {
  static last: FakeAudioContext | null = null;
  sources: FakeSource[] = [];
  currentTime = 1;
  sampleRate = 8000;
  state: 'running' | 'suspended' = 'running';
  destination = new FakeNode();
  constructor() {
    FakeAudioContext.last = this;
  }
  createGain() {
    return new FakeNode();
  }
  createBiquadFilter() {
    return new FakeNode();
  }
  createConvolver() {
    return new FakeNode();
  }
  createDynamicsCompressor() {
    return new FakeNode();
  }
  createOscillator() {
    return new FakeSource(this.sources);
  }
  createBufferSource() {
    return new FakeSource(this.sources);
  }
  createBuffer(channels: number, length: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { getChannelData: (c: number) => data[c]! };
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
}

const doc = {
  visibilityState: 'visible' as 'visible' | 'hidden',
  handlers: [] as (() => void)[],
  addEventListener(type: string, fn: () => void) {
    if (type === 'visibilitychange') this.handlers.push(fn);
  },
  fire(state: 'visible' | 'hidden') {
    this.visibilityState = state;
    this.handlers.forEach((h) => h());
  },
};

const g = globalThis as unknown as Record<string, unknown>;
const saved = { AudioContext: g.AudioContext, document: g.document };

beforeAll(() => {
  g.AudioContext = FakeAudioContext;
  g.document = doc;
  useSettings.getState().set({ muted: false, sfxVolume: 0.7, musicVolume: 0.35 });
  sfx.unlock();
});

afterAll(() => {
  sfx.setMusic(null);
  g.AudioContext = saved.AudioContext;
  g.document = saved.document;
});

const ctx = () => FakeAudioContext.last!;
/** Advance the fake clock past the merge window so consecutive plays are independent. */
const tick = () => {
  ctx().currentTime += 1;
};

describe('procedural audio engine', () => {
  it('every cue schedules at least one sound and stops everything it starts', () => {
    for (const name of SFX_NAMES) {
      tick();
      const before = ctx().sources.length;
      sfx.play(name);
      const started = ctx().sources.slice(before);
      expect(started.length, name).toBeGreaterThan(0);
      expect(started.every((s) => s.stopped), name).toBe(true);
    }
  });

  it('keeps visual cues working while muted, but makes no sound', () => {
    const heard: string[] = [];
    const off = sfx.onPlay((n) => heard.push(n));
    useSettings.getState().set({ muted: true });
    tick();
    const before = ctx().sources.length;
    sfx.play('unlock');
    expect(ctx().sources.length).toBe(before);
    expect(heard).toEqual(['unlock']);
    useSettings.getState().set({ muted: false });
    off();
  });

  it('merges identical cues fired in the same instant, but not different ones', () => {
    tick();
    const before = ctx().sources.length;
    sfx.play('tile');
    const one = ctx().sources.length - before;
    sfx.play('tile');
    expect(ctx().sources.length - before).toBe(one);
    sfx.play('reward');
    expect(ctx().sources.length - before).toBeGreaterThan(one);
  });

  it('raises the combo cue with each step of a streak', () => {
    const firstFreq = (level: number) => {
      tick();
      const before = ctx().sources.length;
      sfx.play('combo', { level });
      const [, value] = ctx().sources[before]!.frequency.events[0]!;
      return value;
    };
    const base = firstFreq(0);
    expect(firstFreq(2)).toBeGreaterThan(base);
    expect(firstFreq(4)).toBeGreaterThan(firstFreq(2));
    // Capped, so very long streaks never become shrill.
    expect(firstFreq(50)).toBe(firstFreq(8));
  });

  it('pauses music and the audio clock in the background, and resumes on return', async () => {
    sfx.setMusic('mystery');
    expect(sfx.musicPlaying).toBe('mystery');
    doc.fire('hidden');
    expect(ctx().state).toBe('suspended');
    expect(sfx.musicPlaying).toBe(null);
    doc.fire('visible');
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx().state).toBe('running');
    expect(sfx.musicPlaying).toBe('mystery');
    sfx.setMusic(null);
    expect(sfx.musicPlaying).toBe(null);
  });
});
