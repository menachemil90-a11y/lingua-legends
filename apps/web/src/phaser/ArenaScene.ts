/**
 * Word Battle arena: original "Skyforge" environment, animated heroes, projectiles,
 * shields, impact particles and non-graphic KO/victory animations.
 * React owns the HUD; this scene only renders combat and atmosphere.
 */
import Phaser from 'phaser';
import { CHARACTERS } from '@lingua/shared';
import { heroSvg } from '../art/characters';
import { hexToNumber } from '../art/color';
import { prefersReducedMotion, radialCanvas, svgToImage } from './textures';

export type Side = 'left' | 'right';

export interface ArenaConfig {
  left: { characterId: string };
  right: { characterId: string };
  theme: 'skyforge' | 'nightbloom';
}

export interface ArenaApi {
  attack(from: Side, amount: number, opts: { surge?: boolean; blocked?: boolean; speedBonus?: number }): void;
  miss(side: Side): void;
  heal(side: Side, amount: number): void;
  setShield(side: Side, on: boolean): void;
  setSurge(side: Side, on: boolean): void;
  charged(side: Side): void;
  finish(winner: Side | null): void;
  destroy(): void;
}

const W = 1280;
const H = 720;
const POS: Record<Side, { x: number; y: number }> = { left: { x: 330, y: 470 }, right: { x: 950, y: 470 } };

class ArenaScene extends Phaser.Scene {
  private heroes = {} as Record<Side, Phaser.GameObjects.Image>;
  private shields = {} as Record<Side, Phaser.GameObjects.Image>;
  private auras = {} as Record<Side, Phaser.GameObjects.Image>;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private reduced = prefersReducedMotion();

  constructor(
    private readonly cfg: ArenaConfig,
    private readonly images: Record<string, HTMLImageElement>,
    private readonly onReady: (scene: ArenaScene) => void,
  ) {
    super('arena');
  }

  create(): void {
    for (const [k, img] of Object.entries(this.images)) if (!this.textures.exists(k)) this.textures.addImage(k, img);
    this.makeTextures();
    this.drawBackground();
    const accent = (id: string) => hexToNumber(CHARACTERS.find((c) => c.id === id)?.palette.accent ?? '#38e1ff');
    for (const side of ['left', 'right'] as Side[]) {
      const p = POS[side];
      const charId = this.cfg[side].characterId;
      const aura = this.add.image(p.x, p.y + 10, 'glow').setScale(3.2, 3.6).setTint(accent(charId)).setAlpha(0).setBlendMode('ADD');
      this.auras[side] = aura;
      const hero = this.add.image(p.x, p.y, `hero-${side}`).setOrigin(0.5, 0.92);
      hero.setDisplaySize(240, 300);
      this.heroes[side] = hero;
      if (!this.reduced) {
        this.tweens.add({ targets: hero, y: p.y - 8, duration: 1600 + (side === 'left' ? 0 : 230), yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        this.tweens.add({ targets: hero, scaleY: hero.scaleY * 1.015, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
      const shield = this.add.image(p.x, p.y - 130, 'shield').setScale(1.6).setAlpha(0).setBlendMode('ADD');
      this.shields[side] = shield;
    }
    this.sparks = this.add.particles(0, 0, 'spark', {
      speed: { min: 120, max: 420 },
      lifespan: { min: 300, max: 700 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: 'ADD',
      emitting: false,
    });
    this.onReady(this);
  }

  private makeTextures(): void {
    if (!this.textures.exists('glow')) this.textures.addCanvas('glow', radialCanvas(128, [[0, 'rgba(255,255,255,0.9)'], [0.35, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]));
    if (!this.textures.exists('spark')) this.textures.addCanvas('spark', radialCanvas(32, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(180,250,255,0.9)'], [1, 'rgba(56,225,255,0)']]));
    if (!this.textures.exists('mote')) this.textures.addCanvas('mote', radialCanvas(16, [[0, 'rgba(200,250,255,1)'], [1, 'rgba(120,200,255,0)']]));
    if (!this.textures.exists('shield')) {
      const c = document.createElement('canvas');
      c.width = c.height = 200;
      const ctx = c.getContext('2d')!;
      const g = ctx.createRadialGradient(100, 100, 40, 100, 100, 98);
      g.addColorStop(0, 'rgba(127,243,255,0.02)');
      g.addColorStop(0.75, 'rgba(127,243,255,0.25)');
      g.addColorStop(0.95, 'rgba(220,252,255,0.9)');
      g.addColorStop(1, 'rgba(127,243,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(100, 100, 98, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(100 + Math.cos(a) * 40, 100 + Math.sin(a) * 40);
        ctx.lineTo(100 + Math.cos(a + 1.05) * 40, 100 + Math.sin(a + 1.05) * 40);
        ctx.stroke();
      }
      this.textures.addCanvas('shield', c);
    }
  }

  private drawBackground(): void {
    const night = this.cfg.theme === 'nightbloom';
    const sky = document.createElement('canvas');
    sky.width = W;
    sky.height = H;
    const ctx = sky.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, night ? '#12052e' : '#071a46');
    g.addColorStop(0.5, night ? '#2a0f55' : '#0d2a6b');
    g.addColorStop(1, '#040918');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Stars
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.7 + 0.1})`;
      const r = Math.random() * 1.6;
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * H * 0.6, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Distant spires
    const drawSpires = (base: number, color: string, count: number, maxH: number) => {
      ctx.fillStyle = color;
      for (let i = 0; i < count; i++) {
        const x = (i / count) * W + Math.random() * 40;
        const w = 30 + Math.random() * 50;
        const h = maxH * (0.4 + Math.random() * 0.6);
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.lineTo(x + w * 0.2, base - h * 0.85);
        ctx.lineTo(x + w * 0.5, base - h);
        ctx.lineTo(x + w * 0.8, base - h * 0.85);
        ctx.lineTo(x + w, base);
        ctx.fill();
      }
    };
    drawSpires(470, night ? '#1d0b3f' : '#0b1f4d', 16, 230);
    drawSpires(500, night ? '#140830' : '#08173a', 12, 160);
    this.textures.addCanvas('arena-sky', sky);
    this.add.image(0, 0, 'arena-sky').setOrigin(0);

    // Aurora bands
    const aurora = night ? [0xb26bff, 0xff6fd8] : [0x38e1ff, 0x8b4dff];
    aurora.forEach((col, i) => {
      const band = this.add.image(W / 2 + (i ? 220 : -200), 150 + i * 40, 'glow').setScale(9, 1.4).setTint(col).setAlpha(0.22).setBlendMode('ADD');
      if (!this.reduced) this.tweens.add({ targets: band, x: band.x + (i ? -160 : 160), alpha: 0.32, duration: 7000 + i * 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });

    // Floating platform
    const plat = this.add.graphics();
    plat.fillStyle(0x0a1636, 1);
    plat.fillEllipse(W / 2, 520, 1180, 170);
    plat.fillStyle(0x13285c, 1);
    plat.fillEllipse(W / 2, 498, 1140, 140);
    plat.fillStyle(0x1b3778, 1);
    plat.fillEllipse(W / 2, 490, 1080, 110);
    plat.lineStyle(3, night ? 0xb26bff : 0x38e1ff, 0.75);
    plat.strokeEllipse(W / 2, 490, 960, 86);
    plat.lineStyle(1.5, 0xffffff, 0.25);
    plat.strokeEllipse(W / 2, 490, 760, 62);
    // Underside rock
    plat.fillStyle(0x060d24, 1);
    plat.fillTriangle(140, 540, W - 140, 540, W / 2, 700);
    // Center rune
    const rune = this.add.graphics();
    rune.lineStyle(3, 0xf5c451, 0.6);
    rune.strokeCircle(0, 0, 46);
    rune.lineStyle(2, 0xf5c451, 0.45);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      rune.lineBetween(Math.cos(a) * 30, Math.sin(a) * 30, Math.cos(a) * 58, Math.sin(a) * 58);
    }
    rune.setPosition(W / 2, 490).setScale(1, 0.3);
    if (!this.reduced) this.tweens.add({ targets: rune, angle: 360, duration: 24000, repeat: -1 });

    // Crystals
    const crystalCol = night ? 0xff6fd8 : 0x7ff3ff;
    [
      [150, 330, 1],
      [1130, 300, 1.2],
      [250, 210, 0.7],
      [1030, 190, 0.8],
    ].forEach(([x, y, s]) => {
      const c = this.add.graphics();
      c.fillStyle(crystalCol, 0.85);
      c.fillTriangle(0, -40, 16, 0, -16, 0);
      c.fillStyle(0xffffff, 0.5);
      c.fillTriangle(0, -40, 6, 0, -4, 0);
      c.fillStyle(crystalCol, 0.55);
      c.fillTriangle(0, 34, 16, 0, -16, 0);
      c.setPosition(x!, y!).setScale(s!);
      const glow = this.add.image(x!, y!, 'glow').setTint(crystalCol).setAlpha(0.35).setScale(1.4 * s!).setBlendMode('ADD');
      if (!this.reduced) this.tweens.add({ targets: [c, glow], y: y! - 16, duration: 2400 + x!, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });

    // Ambient motes
    this.add.particles(0, 0, 'mote', {
      x: { min: 0, max: W },
      y: { min: 380, max: 700 },
      speedY: { min: -40, max: -15 },
      speedX: { min: -10, max: 10 },
      lifespan: 6000,
      alpha: { start: 0.9, end: 0 },
      scale: { start: 0.8, end: 0.2 },
      frequency: this.reduced ? 1000 : 160,
      blendMode: 'ADD',
      tint: night ? 0xe0c2ff : 0x9ff6ff,
    });
  }

  // ------------------------------------------------------------------ API

  attack(from: Side, amount: number, opts: { surge?: boolean; blocked?: boolean; speedBonus?: number }): void {
    const to: Side = from === 'left' ? 'right' : 'left';
    const a = this.heroes[from];
    const dir = from === 'left' ? 1 : -1;
    const start = POS[from];
    const end = POS[to];
    const charId = this.cfg[from].characterId;
    const col = hexToNumber(CHARACTERS.find((c) => c.id === charId)?.palette.accent ?? '#38e1ff');
    this.tweens.add({ targets: a, x: start.x + 70 * dir, duration: 140, yoyo: true, ease: 'Quad.out' });
    const orb = this.add.image(start.x + 90 * dir, start.y - 150, 'glow').setTint(col).setScale(opts.surge ? 1.5 : 0.9).setBlendMode('ADD');
    const core = this.add.image(orb.x, orb.y, 'spark').setScale(opts.surge ? 2.4 : 1.6).setBlendMode('ADD');
    const trail = this.add.particles(0, 0, 'spark', {
      follow: core,
      lifespan: 300,
      scale: { start: opts.surge ? 0.9 : 0.6, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: col,
      frequency: 16,
      blendMode: 'ADD',
    });
    this.tweens.add({
      targets: [orb, core],
      x: end.x - 40 * dir,
      y: end.y - 150,
      duration: 320,
      delay: 100,
      ease: 'Quad.in',
      onComplete: () => {
        orb.destroy();
        core.destroy();
        trail.stop();
        this.time.delayedCall(400, () => trail.destroy());
        this.impact(to, amount, col, !!opts.blocked, !!opts.surge);
      },
    });
  }

  private impact(to: Side, amount: number, col: number, blocked: boolean, surge: boolean): void {
    const d = this.heroes[to];
    const p = POS[to];
    this.sparks.setParticleTint(blocked ? 0x7ff3ff : col);
    this.sparks.explode(blocked ? 18 : surge ? 40 : 26, p.x, p.y - 150);
    if (blocked) {
      const s = this.shields[to];
      this.tweens.add({ targets: s, alpha: { from: 1, to: 0 }, scale: { from: 1.6, to: 2.2 }, duration: 500 });
      this.popText(p.x, p.y - 290, 'BLOCKED', '#bff7ff', 40);
      return;
    }
    if (!this.reduced) this.cameras.main.shake(surge ? 260 : 160, surge ? 0.008 : 0.004);
    d.setTintFill(0xffffff);
    this.time.delayedCall(90, () => d.clearTint());
    const dir = to === 'left' ? -1 : 1;
    this.tweens.add({ targets: d, x: p.x + 26 * dir, angle: 4 * dir, duration: 90, yoyo: true, ease: 'Quad.out' });
    this.popText(p.x + Phaser.Math.Between(-30, 30), p.y - 280, `-${amount}`, surge ? '#ffe7a3' : '#ffffff', surge ? 64 : 52);
  }

  private popText(x: number, y: number, text: string, color: string, size: number): void {
    const t = this.add
      .text(x, y, text, { fontFamily: 'Rubik Variable, Rubik, sans-serif', fontSize: `${size}px`, fontStyle: '900', color, stroke: '#0a0f24', strokeThickness: 8 })
      .setOrigin(0.5)
      .setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.out' });
    this.tweens.add({ targets: t, y: y - 70, alpha: 0, delay: 500, duration: 600, onComplete: () => t.destroy() });
  }

  miss(side: Side): void {
    const p = POS[side];
    this.tweens.add({ targets: this.heroes[side], alpha: 0.75, duration: 120, yoyo: true });
    this.popText(p.x, p.y - 300, 'MISS', '#8aa2d6', 30);
  }

  heal(side: Side, amount: number): void {
    const p = POS[side];
    this.sparks.setParticleTint(0x36e0b0);
    this.sparks.explode(24, p.x, p.y - 120);
    this.popText(p.x, p.y - 290, `+${amount}`, '#8fffd9', 48);
  }

  setShield(side: Side, on: boolean): void {
    const s = this.shields[side];
    this.tweens.killTweensOf(s);
    if (on) {
      this.tweens.add({ targets: s, alpha: 0.85, scale: { from: 1.2, to: 1.6 }, duration: 300, ease: 'Back.out' });
      if (!this.reduced) this.tweens.add({ targets: s, alpha: 0.6, duration: 900, yoyo: true, repeat: -1, delay: 300 });
    } else if (s.alpha > 0) {
      this.tweens.add({ targets: s, alpha: 0, duration: 250 });
    }
  }

  setSurge(side: Side, on: boolean): void {
    const a = this.auras[side];
    this.tweens.killTweensOf(a);
    if (on) {
      a.setAlpha(0.5);
      if (!this.reduced) this.tweens.add({ targets: a, alpha: 0.85, duration: 500, yoyo: true, repeat: -1 });
    } else a.setAlpha(0);
  }

  charged(side: Side): void {
    const p = POS[side];
    this.sparks.setParticleTint(0xf5c451);
    this.sparks.explode(30, p.x, p.y - 40);
    this.popText(p.x, p.y - 320, 'READY!', '#ffe7a3', 34);
  }

  finish(winner: Side | null): void {
    for (const side of ['left', 'right'] as Side[]) {
      const h = this.heroes[side];
      this.tweens.killTweensOf(h);
      if (winner === side) {
        this.tweens.add({ targets: h, y: POS[side].y - 50, duration: 260, yoyo: true, repeat: 2, ease: 'Quad.out' });
        this.add.particles(POS[side].x, POS[side].y - 200, 'spark', {
          speed: { min: 200, max: 520 },
          angle: { min: 200, max: 340 },
          gravityY: 500,
          lifespan: 1400,
          scale: { start: 0.9, end: 0 },
          tint: [0xf5c451, 0x7ff3ff, 0xb26bff],
          quantity: 4,
          frequency: 40,
          duration: 1600,
          blendMode: 'ADD',
        });
      } else if (winner !== null) {
        this.tweens.add({ targets: h, angle: side === 'left' ? -12 : 12, alpha: 0.45, y: POS[side].y + 6, duration: 700, ease: 'Quad.out' });
      }
    }
  }
}

/** Boots the arena inside `parent`; resolves with a small imperative API. */
export async function bootArena(parent: HTMLElement, cfg: ArenaConfig): Promise<ArenaApi> {
  const [left, right] = await Promise.all([
    svgToImage(heroSvg(cfg.left.characterId, 'al', {}), 480, 600),
    svgToImage(heroSvg(cfg.right.characterId, 'ar', { flip: true }), 480, 600),
  ]);
  return new Promise((resolve) => {
    let game: Phaser.Game | null = null;
    const scene = new ArenaScene(cfg, { 'hero-left': left, 'hero-right': right }, (s) => {
      resolve({
        attack: (from, amount, opts) => s.attack(from, amount, opts),
        miss: (side) => s.miss(side),
        heal: (side, amount) => s.heal(side, amount),
        setShield: (side, on) => s.setShield(side, on),
        setSurge: (side, on) => s.setSurge(side, on),
        charged: (side) => s.charged(side),
        finish: (w) => s.finish(w),
        destroy: () => {
          game?.destroy(true);
          game = null;
        },
      });
    });
    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: W,
      height: H,
      backgroundColor: '#050b1f',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [scene],
      banner: false,
      audio: { noAudio: true },
      render: { antialias: true, powerPreference: 'low-power' },
      fps: { target: 60 },
    });
  });
}
