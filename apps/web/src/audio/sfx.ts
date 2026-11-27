/**
 * Original procedural audio (Web Audio API). No external sound files, so there are
 * no licensing concerns. Audio starts only after the first user gesture.
 */
import { useSettings } from '../state/settings';

export const SFX_NAMES = [
  'click',
  'tick',
  'correct',
  'wrong',
  'attack',
  'hit',
  'shield',
  'charge',
  'heal',
  'boost',
  'turbo',
  'countdown',
  'go',
  'victory',
  'defeat',
  'levelup',
  'promote',
  'tile',
  'whoosh',
  // Mode-specific cues (all original, synthesised at runtime).
  'unlock',
  'capture',
  'combo',
  'milestone',
  'reward',
  'clue',
  'page',
  'advance',
  'select',
] as const;

export type SfxName = (typeof SFX_NAMES)[number];
export type MusicTrack = 'lobby' | 'battle' | 'mystery';

export interface PlayOptions {
  /** Escalation step for repeating cues such as combos (0 = base pitch). */
  level?: number;
}

type Listener = (name: SfxName) => void;

/** Short cues repeated in quick succession get a little pitch variation so they never sound mechanical. */
const VARIED: ReadonlySet<SfxName> = new Set(['click', 'tick', 'tile', 'hit', 'attack', 'select', 'page']);
/** Identical cues closer together than this are merged (avoids loud stacking on bursts of events). */
const MERGE_WINDOW_S = 0.03;
/** Semitone ratio. */
const semi = (n: number) => Math.pow(2, n / 12);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private listeners = new Set<Listener>();
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicTrack: MusicTrack | null = null;
  private step = 0;
  private lastPlayed = new Map<SfxName, number>();
  private detune = 0;
  private hiddenSuspend = false;

  /** Visual-cue subscribers (accessible alternative to audio). */
  onPlay(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    // A gentle limiter keeps overlapping cues (e.g. a combo during a victory) from clipping.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 8;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(limiter).connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.6);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    // Small synthetic room (decaying stereo noise) used as a send for celebratory and "space" cues.
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.35;
    const verb = ctx.createConvolver();
    verb.buffer = this.impulse(1.4, 3);
    this.reverbSend.connect(verb).connect(this.sfxBus);
    this.applyVolumes();
    if (this.musicTrack) this.startMusicLoop();
    // Mobile battery and performance: stop the audio clock while the app is in the background.
    globalThis.document?.addEventListener?.('visibilitychange', () => this.onVisibility());
  }

  private impulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  private onVisibility(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (globalThis.document?.visibilityState === 'hidden') {
      if (ctx.state === 'running') {
        this.hiddenSuspend = true;
        this.stopMusicLoop();
        void ctx.suspend();
      }
    } else if (this.hiddenSuspend) {
      this.hiddenSuspend = false;
      void ctx.resume().then(() => {
        if (this.musicTrack && !this.musicTimer) this.startMusicLoop();
      });
    }
  }

  /** For tests and diagnostics. */
  get musicPlaying(): MusicTrack | null {
    return this.musicTimer ? this.musicTrack : null;
  }

  applyVolumes(): void {
    const s = useSettings.getState();
    if (!this.master || !this.sfxBus || !this.musicBus || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : 1, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfxVolume * 0.6, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.musicVolume * 0.22, t, 0.2);
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, slideTo?: number, bus?: GainNode, wet = 0): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (this.detune) osc.detune.setValueAtTime(this.detune, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(bus ?? this.sfxBus!);
    if (wet > 0 && this.reverbSend && !bus) {
      const send = ctx.createGain();
      send.gain.value = wet;
      g.connect(send).connect(this.reverbSend);
    }
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  /** Bell-like tone: a fundamental plus an inharmonic partial, with a long tail. */
  private bell(freq: number, start: number, dur: number, vol = 0.12, wet = 0.6): void {
    this.tone(freq, start, dur, 'sine', vol, undefined, undefined, wet);
    this.tone(freq * 2.76, start, dur * 0.45, 'sine', vol * 0.35, undefined, undefined, wet);
  }

  private burst(start: number, dur: number, freq: number, vol = 0.3, q = 1, type: BiquadFilterType = 'bandpass'): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, start);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f).connect(g).connect(this.sfxBus!);
    src.start(start);
    src.stop(start + dur + 0.05);
  }

  play(name: SfxName, opts: PlayOptions = {}): void {
    for (const l of this.listeners) l(name);
    if (!this.ctx || !this.sfxBus) return;
    const s = useSettings.getState();
    if (s.muted || s.sfxVolume <= 0) return;
    const now = this.ctx.currentTime;
    const prev = this.lastPlayed.get(name);
    if (prev !== undefined && now - prev < MERGE_WINDOW_S) return;
    this.lastPlayed.set(name, now);
    this.detune = VARIED.has(name) ? Math.round((Math.random() * 2 - 1) * 25) : 0;
    try {
      this.render(name, now + 0.005, Math.max(0, Math.min(8, opts.level ?? 0)));
    } finally {
      this.detune = 0;
    }
  }

  private render(name: SfxName, t: number, level: number): void {
    switch (name) {
      case 'click':
        this.tone(660, t, 0.06, 'triangle', 0.18, 880);
        break;
      case 'tick':
        this.tone(1200, t, 0.03, 'square', 0.06);
        break;
      case 'tile':
        this.tone(520, t, 0.07, 'triangle', 0.2, 700);
        break;
      case 'correct':
        [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, t + i * 0.07, 0.22, 'triangle', 0.22));
        this.tone(1567.98, t + 0.2, 0.3, 'sine', 0.08);
        break;
      case 'wrong':
        this.tone(220, t, 0.25, 'sawtooth', 0.12, 140);
        this.tone(185, t + 0.08, 0.25, 'square', 0.06, 120);
        break;
      case 'whoosh':
        this.burst(t, 0.35, 900, 0.25, 0.8);
        break;
      case 'attack':
        this.burst(t, 0.25, 1600, 0.3, 0.7);
        this.tone(320, t, 0.18, 'sawtooth', 0.14, 90);
        break;
      case 'hit':
        this.burst(t, 0.18, 400, 0.45, 0.9, 'lowpass');
        this.tone(110, t, 0.2, 'sine', 0.4, 50);
        break;
      case 'shield':
        [880, 1174.66, 1760].forEach((f, i) => this.tone(f, t + i * 0.04, 0.5, 'sine', 0.1));
        break;
      case 'charge':
        this.tone(220, t, 0.5, 'sawtooth', 0.1, 880);
        this.tone(330, t + 0.05, 0.5, 'triangle', 0.08, 1320);
        break;
      case 'heal':
        [392, 523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, t + i * 0.06, 0.35, 'sine', 0.12));
        break;
      case 'boost':
        this.tone(180, t, 0.35, 'sawtooth', 0.12, 520);
        this.burst(t, 0.3, 2400, 0.12, 0.6, 'highpass');
        break;
      case 'turbo':
        this.tone(150, t, 0.8, 'sawtooth', 0.14, 900);
        this.burst(t, 0.8, 3000, 0.18, 0.4, 'highpass');
        break;
      case 'countdown':
        this.tone(587.33, t, 0.16, 'square', 0.12);
        break;
      case 'go':
        this.tone(1174.66, t, 0.4, 'square', 0.14);
        this.tone(587.33, t, 0.4, 'triangle', 0.14);
        break;
      case 'victory':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.12, 0.5, 'triangle', 0.2, undefined, undefined, 0.3));
        [523.25, 659.25, 783.99].forEach((f) => this.tone(f, t + 0.55, 1.1, 'sine', 0.12, undefined, undefined, 0.5));
        this.bell(2093, t + 0.55, 1.2, 0.05);
        break;
      case 'defeat':
        [392, 349.23, 311.13, 261.63].forEach((f, i) => this.tone(f, t + i * 0.16, 0.45, 'triangle', 0.14));
        break;
      case 'levelup':
        [659.25, 783.99, 987.77, 1318.51].forEach((f, i) => this.tone(f, t + i * 0.08, 0.3, 'square', 0.08));
        break;
      case 'promote':
        [523.25, 783.99, 1046.5, 1567.98].forEach((f, i) => this.tone(f, t + i * 0.14, 0.7, 'triangle', 0.18, undefined, undefined, 0.4));
        this.burst(t + 0.5, 0.8, 5000, 0.1, 0.5, 'highpass');
        break;
      case 'unlock':
        // Mechanical latch (two filtered clicks), then a rising open chime.
        this.burst(t, 0.04, 3200, 0.35, 6);
        this.burst(t + 0.07, 0.05, 1800, 0.3, 5);
        this.tone(140, t + 0.07, 0.12, 'square', 0.08, 90);
        [587.33, 880, 1174.66].forEach((f, i) => this.bell(f, t + 0.16 + i * 0.07, 0.7, 0.1));
        break;
      case 'capture':
        // Low drum + a bold open fifth: a territory changes hands.
        this.tone(90, t, 0.32, 'sine', 0.45, 45);
        this.burst(t, 0.2, 260, 0.35, 0.8, 'lowpass');
        this.tone(392, t + 0.08, 0.45, 'sawtooth', 0.07, undefined, undefined, 0.3);
        this.tone(587.33, t + 0.08, 0.45, 'sawtooth', 0.06, undefined, undefined, 0.3);
        this.tone(783.99, t + 0.2, 0.5, 'triangle', 0.1, undefined, undefined, 0.3);
        break;
      case 'combo': {
        // Each further step of a streak rises a whole tone, capped at an octave and a half.
        const base = 659.25 * semi(Math.min(level, 9) * 2);
        this.tone(base, t, 0.12, 'square', 0.07);
        this.tone(base * 1.5, t + 0.06, 0.2, 'triangle', 0.12, undefined, undefined, 0.25);
        break;
      }
      case 'milestone':
        // A warm, unhurried phrase — progress worth noticing, not a slot-machine jingle.
        [392, 493.88, 587.33, 783.99].forEach((f, i) => this.tone(f, t + i * 0.1, 0.9 - i * 0.1, 'triangle', 0.13, undefined, undefined, 0.45));
        this.bell(1567.98, t + 0.42, 1.4, 0.06);
        break;
      case 'reward':
        [1318.51, 1760, 2349.32].forEach((f, i) => this.bell(f, t + i * 0.05, 0.45, 0.06, 0.4));
        break;
      case 'clue':
        // Two soft, slightly questioning notes (a rising minor sixth).
        this.bell(440, t, 0.9, 0.11, 0.7);
        this.bell(698.46, t + 0.18, 1.1, 0.09, 0.7);
        this.burst(t, 0.25, 6000, 0.04, 0.4, 'highpass');
        break;
      case 'page':
        this.burst(t, 0.16, 2600, 0.16, 0.7, 'highpass');
        this.burst(t + 0.05, 0.12, 1200, 0.08, 1.2);
        break;
      case 'advance':
        // Short two-step fanfare for moving on in a bracket.
        [[392, 587.33], [523.25, 783.99]].forEach(([a, b], i) => {
          this.tone(a!, t + i * 0.16, 0.3, 'sawtooth', 0.07, undefined, undefined, 0.3);
          this.tone(b!, t + i * 0.16, 0.3, 'triangle', 0.12, undefined, undefined, 0.3);
        });
        this.tone(1046.5, t + 0.34, 0.6, 'triangle', 0.12, undefined, undefined, 0.4);
        break;
      case 'select':
        this.tone(440, t, 0.08, 'triangle', 0.14, 660);
        this.tone(880, t + 0.05, 0.1, 'sine', 0.08);
        break;
    }
  }

  setMusic(track: MusicTrack | null): void {
    if (this.musicTrack === track) return;
    this.musicTrack = track;
    this.stopMusicLoop();
    if (track && this.ctx) this.startMusicLoop();
  }

  private stopMusicLoop(): void {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  /** Small generative loop: pad chords + arpeggio (lobby), pulse + drums (battle) or sparse bells (mystery). */
  private startMusicLoop(): void {
    if (!this.ctx) return;
    const lobbyChords = [
      [220, 261.63, 329.63],
      [174.61, 220, 261.63],
      [196, 246.94, 293.66],
      [164.81, 207.65, 246.94],
    ];
    const battleRoots = [110, 110, 98, 130.81];
    // D minor-ish drones with a raised sixth now and then: curious rather than scary.
    const mysteryDrones = [
      [146.83, 220],
      [130.81, 196],
      [116.54, 174.61],
      [123.47, 185],
    ];
    const mysteryBells = [587.33, 698.46, 880, 987.77, 1174.66];
    const beat = this.musicTrack === 'battle' ? 0.2 : this.musicTrack === 'mystery' ? 0.45 : 0.32;
    this.step = 0;
    this.musicTimer = setInterval(() => {
      const ctx = this.ctx;
      const bus = this.musicBus;
      if (!ctx || !bus || ctx.state !== 'running') return;
      const s = useSettings.getState();
      if (s.muted || s.musicVolume <= 0) {
        this.step++;
        return;
      }
      const t = ctx.currentTime + 0.05;
      const bar = Math.floor(this.step / 8) % 4;
      const pos = this.step % 8;
      if (this.musicTrack === 'mystery') {
        const drone = mysteryDrones[bar]!;
        if (pos === 0) drone.forEach((f) => this.tone(f, t, beat * 8.5, 'sine', 0.1, undefined, bus));
        // Deterministic but irregular-sounding bell pattern (no randomness, so it never clusters).
        if (pos === 1 || pos === 4 || (pos === 6 && bar % 2 === 1)) {
          const f = mysteryBells[(this.step * 3 + bar) % mysteryBells.length]!;
          this.tone(f, t, beat * 2.5, 'sine', 0.04, undefined, bus);
          this.tone(f * 2.76, t, beat * 1.1, 'sine', 0.012, undefined, bus);
        }
      } else if (this.musicTrack === 'lobby') {
        const chord = lobbyChords[bar]!;
        if (pos === 0) chord.forEach((f) => this.tone(f, t, beat * 8, 'sine', 0.12, undefined, bus));
        const arp = chord[pos % 3]! * (pos >= 4 ? 4 : 2);
        this.tone(arp, t, beat * 0.9, 'triangle', 0.05, undefined, bus);
      } else {
        const root = battleRoots[bar]!;
        this.tone(root, t, beat * 0.9, 'sawtooth', pos % 2 === 0 ? 0.1 : 0.06, undefined, bus);
        if (pos % 4 === 0) this.tone(60, t, 0.18, 'sine', 0.35, 35, bus);
        if (pos % 4 === 2) {
          const src = ctx.createBufferSource();
          src.buffer = this.noise;
          const f = ctx.createBiquadFilter();
          f.type = 'highpass';
          f.frequency.value = 6000;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.12, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
          src.connect(f).connect(g).connect(bus);
          src.start(t);
          src.stop(t + 0.1);
        }
        if (pos === 0 || pos === 3 || pos === 6) this.tone(root * 4, t, beat * 1.4, 'square', 0.025, undefined, bus);
      }
      this.step++;
    }, beat * 1000);
  }
}

export const sfx = new AudioEngine();

useSettings.subscribe(() => sfx.applyVolumes());
