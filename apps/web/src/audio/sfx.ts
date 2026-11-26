/**
 * Original procedural audio (Web Audio API). No external sound files, so there are
 * no licensing concerns. Audio starts only after the first user gesture.
 */
import { useSettings } from '../state/settings';

export type SfxName =
  | 'click'
  | 'tick'
  | 'correct'
  | 'wrong'
  | 'attack'
  | 'hit'
  | 'shield'
  | 'charge'
  | 'heal'
  | 'boost'
  | 'turbo'
  | 'countdown'
  | 'go'
  | 'victory'
  | 'defeat'
  | 'levelup'
  | 'promote'
  | 'tile'
  | 'whoosh';

type Listener = (name: SfxName) => void;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private listeners = new Set<Listener>();
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicTrack: 'lobby' | 'battle' | null = null;
  private step = 0;

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
    this.master = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.6;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    if (this.musicTrack) this.startMusicLoop();
  }

  applyVolumes(): void {
    const s = useSettings.getState();
    if (!this.master || !this.sfxBus || !this.musicBus || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : 1, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfxVolume * 0.6, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.musicVolume * 0.22, t, 0.2);
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, slideTo?: number, bus?: GainNode): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(bus ?? this.sfxBus!);
    osc.start(start);
    osc.stop(start + dur + 0.05);
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

  play(name: SfxName): void {
    for (const l of this.listeners) l(name);
    if (!this.ctx || !this.sfxBus) return;
    const s = useSettings.getState();
    if (s.muted || s.sfxVolume <= 0) return;
    const t = this.ctx.currentTime + 0.005;
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
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.12, 0.5, 'triangle', 0.2));
        [523.25, 659.25, 783.99].forEach((f) => this.tone(f, t + 0.55, 1.1, 'sine', 0.12));
        break;
      case 'defeat':
        [392, 349.23, 311.13, 261.63].forEach((f, i) => this.tone(f, t + i * 0.16, 0.45, 'triangle', 0.14));
        break;
      case 'levelup':
        [659.25, 783.99, 987.77, 1318.51].forEach((f, i) => this.tone(f, t + i * 0.08, 0.3, 'square', 0.08));
        break;
      case 'promote':
        [523.25, 783.99, 1046.5, 1567.98].forEach((f, i) => this.tone(f, t + i * 0.14, 0.7, 'triangle', 0.18));
        this.burst(t + 0.5, 0.8, 5000, 0.1, 0.5, 'highpass');
        break;
    }
  }

  setMusic(track: 'lobby' | 'battle' | null): void {
    if (this.musicTrack === track) return;
    this.musicTrack = track;
    this.stopMusicLoop();
    if (track && this.ctx) this.startMusicLoop();
  }

  private stopMusicLoop(): void {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  /** Small generative loop: pad chords + arpeggio (lobby) or pulse + drums (battle). */
  private startMusicLoop(): void {
    const lobbyChords = [
      [220, 261.63, 329.63],
      [174.61, 220, 261.63],
      [196, 246.94, 293.66],
      [164.81, 207.65, 246.94],
    ];
    const battleRoots = [110, 110, 98, 130.81];
    const beat = this.musicTrack === 'battle' ? 0.2 : 0.32;
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
      if (this.musicTrack === 'lobby') {
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
