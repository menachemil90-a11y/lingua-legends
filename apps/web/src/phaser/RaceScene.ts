/**
 * Grammar Race: neon sky-highway with parallax skyline, lanes, moving vehicles,
 * thruster flames, turbo speed lines and a finish gate. Vehicle positions come
 * from the authoritative host (10 Hz) and are smoothly extrapolated at 60 fps.
 */
import Phaser from 'phaser';
import { VEHICLES } from '@lingua/shared';
import { flameSvg, vehicleSvg } from '../art/vehicles';
import { prefersReducedMotion, radialCanvas, svgToImage } from './textures';

export interface RacerInfo {
  playerId: string;
  vehicleId: string;
  nickname: string;
  isSelf: boolean;
}

export interface RacerUpdate {
  playerId: string;
  distance: number;
  speed: number;
  turbo: boolean;
  stalled: boolean;
  finished: boolean;
}

export interface RaceApi {
  update(racers: RacerUpdate[]): void;
  pulse(playerId: string, kind: 'boost' | 'stall' | 'turbo'): void;
  destroy(): void;
}

const W = 1280;
const H = 720;
const PX_PER_M = 7;
const SELF_X = 360;

interface Car {
  info: RacerInfo;
  lane: number;
  body: Phaser.GameObjects.Image;
  flame: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  shownDistance: number;
  target: RacerUpdate;
  receivedAt: number;
  marker: Phaser.GameObjects.Container;
}

class RaceScene extends Phaser.Scene {
  private cars: Car[] = [];
  private camDistance = 0;
  private far!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;
  private dashes: Phaser.GameObjects.TileSprite[] = [];
  private speedLines!: Phaser.GameObjects.Particles.ParticleEmitter;
  private finishGate!: Phaser.GameObjects.Container;
  private startLine!: Phaser.GameObjects.Graphics;
  private reduced = prefersReducedMotion();
  private laneY: number[] = [];

  constructor(
    private readonly racers: RacerInfo[],
    private readonly trackLength: number,
    private readonly images: Record<string, HTMLImageElement>,
    private readonly onReady: (s: RaceScene) => void,
  ) {
    super('race');
  }

  create(): void {
    for (const [k, img] of Object.entries(this.images)) if (!this.textures.exists(k)) this.textures.addImage(k, img);
    if (!this.textures.exists('rglow')) this.textures.addCanvas('rglow', radialCanvas(64, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]));
    this.buildBackground();
    const lanes = this.racers.length;
    const top = 452;
    const laneH = lanes <= 2 ? 96 : 66;
    this.laneY = Array.from({ length: lanes }, (_, i) => top + laneH * (i + 0.5));
    this.buildTrack(top, laneH, lanes);
    this.racers.forEach((info, i) => {
      const y = this.laneY[i]!;
      const flame = this.add.image(0, y + 6, `flame-${info.vehicleId}`).setOrigin(1, 0.5).setBlendMode('ADD').setScale(0.9);
      const body = this.add.image(0, y, `car-${info.vehicleId}`).setOrigin(0.5, 0.62).setScale(lanes <= 2 ? 0.95 : 0.75);
      const label = this.add
        .text(0, y - 62, info.isSelf ? `▼ ${info.nickname}` : info.nickname, {
          fontFamily: 'Rubik Variable, Rubik, sans-serif',
          fontSize: '20px',
          fontStyle: '800',
          color: info.isSelf ? '#ffe7a3' : '#cfe8ff',
          stroke: '#050b1f',
          strokeThickness: 5,
        })
        .setOrigin(0.5);
      const markerBg = this.add.rectangle(0, 0, 150, 34, 0x0a1636, 0.85).setStrokeStyle(2, 0x7ff3ff, 0.7);
      const markerText = this.add.text(0, 0, '', { fontFamily: 'Rubik Variable, Rubik, sans-serif', fontSize: '18px', fontStyle: '800', color: '#eaf6ff' }).setOrigin(0.5);
      const marker = this.add.container(0, y - 30, [markerBg, markerText]).setVisible(false);
      this.cars.push({
        info,
        lane: i,
        body,
        flame,
        label,
        shownDistance: 0,
        target: { playerId: info.playerId, distance: 0, speed: 0, turbo: false, stalled: false, finished: false },
        receivedAt: this.time.now,
        marker,
      });
    });
    this.speedLines = this.add.particles(0, 0, 'rglow', {
      x: W + 20,
      y: { min: 60, max: H - 40 },
      speedX: { min: -2400, max: -1600 },
      lifespan: 600,
      scaleX: { start: 2.6, end: 2.6 },
      scaleY: 0.05,
      alpha: { start: 0.55, end: 0 },
      quantity: 2,
      frequency: 30,
      blendMode: 'ADD',
      emitting: false,
    });
    this.onReady(this);
  }

  private buildBackground(): void {
    const sky = document.createElement('canvas');
    sky.width = W;
    sky.height = H;
    const ctx = sky.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a1a4a');
    g.addColorStop(0.45, '#3a1c78');
    g.addColorStop(0.62, '#ff7a59');
    g.addColorStop(0.7, '#1a0f3a');
    g.addColorStop(1, '#050b1f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.6 + 0.1})`;
      ctx.fillRect(Math.random() * W, Math.random() * H * 0.4, 1.5, 1.5);
    }
    const sun = ctx.createRadialGradient(W * 0.68, H * 0.6, 10, W * 0.68, H * 0.6, 220);
    sun.addColorStop(0, 'rgba(255,230,170,0.95)');
    sun.addColorStop(0.3, 'rgba(255,140,90,0.6)');
    sun.addColorStop(1, 'rgba(255,90,120,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);
    this.textures.addCanvas('race-sky', sky);
    this.add.image(0, 0, 'race-sky').setOrigin(0);

    const skyline = (key: string, color: string, windowColor: string, maxH: number, base: number) => {
      const c = document.createElement('canvas');
      c.width = 1024;
      c.height = 360;
      const x = c.getContext('2d')!;
      let px = 0;
      while (px < 1024) {
        const w = 40 + Math.random() * 70;
        const h = maxH * (0.35 + Math.random() * 0.65);
        x.fillStyle = color;
        x.fillRect(px, 360 - h, w - 6, h);
        if (Math.random() > 0.6) {
          x.fillRect(px + w / 2 - 4, 360 - h - 24, 3, 24);
        }
        x.fillStyle = windowColor;
        for (let wy = 360 - h + 10; wy < 350; wy += 14) {
          for (let wx = px + 6; wx < px + w - 12; wx += 11) if (Math.random() > 0.55) x.fillRect(wx, wy, 4, 6);
        }
        px += w;
      }
      this.textures.addCanvas(key, c);
      return this.add.tileSprite(0, base, W, 360, key).setOrigin(0, 1);
    };
    this.far = skyline('sky-far', '#1c1450', 'rgba(255,200,120,0.35)', 220, 455);
    this.far.setAlpha(0.9);
    this.near = skyline('sky-near', '#0d0a2c', 'rgba(127,243,255,0.55)', 300, 470);
  }

  private buildTrack(top: number, laneH: number, lanes: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x070d22, 1);
    g.fillRect(0, top - 18, W, laneH * lanes + 36);
    g.fillStyle(0x0f1a3c, 1);
    g.fillRect(0, top, W, laneH * lanes);
    g.lineStyle(4, 0x38e1ff, 0.9);
    g.lineBetween(0, top, W, top);
    g.lineStyle(4, 0xb26bff, 0.9);
    g.lineBetween(0, top + laneH * lanes, W, top + laneH * lanes);
    this.add.image(W / 2, top, 'rglow').setScale(30, 0.4).setTint(0x38e1ff).setAlpha(0.35).setBlendMode('ADD');
    // Lane dashes as scrolling tile sprites
    const dash = document.createElement('canvas');
    dash.width = 160;
    dash.height = 8;
    const d = dash.getContext('2d')!;
    d.fillStyle = 'rgba(200,230,255,0.55)';
    d.fillRect(0, 2, 80, 4);
    this.textures.addCanvas('dash', dash);
    for (let i = 1; i < lanes; i++) {
      this.dashes.push(this.add.tileSprite(0, top + laneH * i, W, 8, 'dash').setOrigin(0, 0.5));
    }
    // Barrier posts under the track
    const posts = document.createElement('canvas');
    posts.width = 120;
    posts.height = 40;
    const p = posts.getContext('2d')!;
    p.fillStyle = '#1a2a5e';
    p.fillRect(0, 0, 120, 10);
    p.fillStyle = '#38e1ff';
    p.fillRect(10, 2, 20, 6);
    this.textures.addCanvas('posts', posts);
    this.dashes.push(this.add.tileSprite(0, top + laneH * lanes + 18, W, 40, 'posts').setOrigin(0, 0));

    this.startLine = this.add.graphics();
    this.drawCheckered(this.startLine, top, laneH * lanes);
    const finishG = this.add.graphics();
    this.drawCheckered(finishG, top, laneH * lanes);
    const arch = this.add.graphics();
    arch.fillStyle(0xf5c451, 1);
    arch.fillRect(-12, top - 220, 12, 220);
    arch.fillRect(-12, top + laneH * lanes, 12, 30);
    arch.fillStyle(0x0a1636, 0.95);
    arch.fillRect(-150, top - 260, 290, 56);
    arch.lineStyle(3, 0xf5c451, 1);
    arch.strokeRect(-150, top - 260, 290, 56);
    const finishText = this.add.text(-5, top - 232, 'FINISH', { fontFamily: 'Cinzel, serif', fontSize: '34px', fontStyle: '900', color: '#ffe7a3' }).setOrigin(0.5);
    this.finishGate = this.add.container(0, 0, [finishG, arch, finishText]);
  }

  private drawCheckered(g: Phaser.GameObjects.Graphics, top: number, height: number): void {
    const size = 12;
    for (let row = 0; row < Math.ceil(height / size); row++) {
      for (let col = 0; col < 3; col++) {
        g.fillStyle((row + col) % 2 ? 0xffffff : 0x111111, 1);
        g.fillRect(col * size - 18, top + row * size, size, Math.min(size, height - row * size));
      }
    }
  }

  setRacers(updates: RacerUpdate[]): void {
    for (const u of updates) {
      const car = this.cars.find((c) => c.info.playerId === u.playerId);
      if (!car) continue;
      car.target = u;
      car.receivedAt = this.time.now;
    }
  }

  pulse(playerId: string, kind: 'boost' | 'stall' | 'turbo'): void {
    const car = this.cars.find((c) => c.info.playerId === playerId);
    if (!car) return;
    if (kind === 'stall') {
      this.tweens.add({ targets: car.body, angle: -3, duration: 80, yoyo: true, repeat: 3 });
      car.body.setTint(0x8899bb);
      this.time.delayedCall(700, () => car.body.clearTint());
    } else {
      this.tweens.add({ targets: car.flame, scaleX: kind === 'turbo' ? 2.6 : 1.8, duration: 160, yoyo: true });
      if (kind === 'turbo' && car.info.isSelf && !this.reduced) this.cameras.main.shake(300, 0.003);
    }
  }

  override update(time: number, delta: number): void {
    const dt = delta / 1000;
    for (const c of this.cars) {
      const age = Math.min(0.25, (time - c.receivedAt) / 1000);
      const predicted = c.target.finished ? c.target.distance : c.target.distance + c.target.speed * age;
      // Smoothly approach the predicted position (never visibly snap backwards much).
      c.shownDistance += (predicted - c.shownDistance) * Math.min(1, dt * 10);
    }
    const self = this.cars.find((c) => c.info.isSelf) ?? this.cars[0]!;
    const targetCam = self.shownDistance;
    const prevCam = this.camDistance;
    this.camDistance += (targetCam - this.camDistance) * Math.min(1, dt * 8);
    const moved = (this.camDistance - prevCam) * PX_PER_M;
    this.far.tilePositionX += moved * 0.15;
    this.near.tilePositionX += moved * 0.35;
    for (const d of this.dashes) d.tilePositionX += moved;
    const worldToScreen = (m: number) => SELF_X + (m - this.camDistance) * PX_PER_M;
    this.startLine.x = worldToScreen(0);
    this.finishGate.x = worldToScreen(this.trackLength);
    for (const c of this.cars) {
      const x = worldToScreen(c.shownDistance);
      const y = this.laneY[c.lane]!;
      const bob = this.reduced ? 0 : Math.sin(time / 180 + c.lane) * 2.5;
      c.body.setPosition(x, y + bob);
      c.flame.setPosition(x - c.body.displayWidth * 0.45, y + 4 + bob);
      const sp = c.target.speed;
      const fl = c.target.finished ? 0.2 : c.target.stalled ? 0.25 : Math.min(2.2, 0.5 + sp / 12 + (c.target.turbo ? 0.9 : 0));
      c.flame.scaleX += (fl - c.flame.scaleX) * Math.min(1, dt * 8);
      c.flame.scaleY = 0.7 + Math.min(0.6, sp / 40);
      c.flame.setAlpha(c.target.stalled ? 0.4 : 0.95);
      c.label.setPosition(x, y - 62 + bob);
      const off = x < -60 || x > W + 60;
      c.body.setVisible(!off);
      c.flame.setVisible(!off);
      c.label.setVisible(!off);
      c.marker.setVisible(off);
      if (off) {
        const ahead = x > W;
        const gap = Math.abs(Math.round(c.shownDistance - self.shownDistance));
        c.marker.setPosition(ahead ? W - 90 : 90, y - 30);
        (c.marker.list[1] as Phaser.GameObjects.Text).setText(`${ahead ? '' : '◀ '}${c.info.nickname} ${ahead ? '+' : '-'}${gap}m${ahead ? ' ▶' : ''}`);
      }
    }
    if (self.target.turbo && !this.reduced) {
      if (!this.speedLines.emitting) this.speedLines.start();
    } else if (this.speedLines.emitting) this.speedLines.stop();
  }
}

export async function bootRace(parent: HTMLElement, racers: RacerInfo[], trackLength: number): Promise<RaceApi> {
  const images: Record<string, HTMLImageElement> = {};
  await Promise.all(
    [...new Set(racers.map((r) => r.vehicleId))].flatMap((vid) => {
      const v = VEHICLES.find((x) => x.id === vid) ?? VEHICLES[0]!;
      return [
        svgToImage(vehicleSvg(vid, `rc${vid}`), 520, 220).then((img) => (images[`car-${vid}`] = img)),
        svgToImage(flameSvg(v.flame, `fl${vid}`), 280, 120).then((img) => (images[`flame-${vid}`] = img)),
      ];
    }),
  );
  return new Promise((resolve) => {
    let game: Phaser.Game | null = null;
    const scene = new RaceScene(racers, trackLength, images, (s) =>
      resolve({
        update: (u) => s.setRacers(u),
        pulse: (id, k) => s.pulse(id, k),
        destroy: () => {
          game?.destroy(true);
          game = null;
        },
      }),
    );
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
    });
  });
}
