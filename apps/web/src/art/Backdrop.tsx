/**
 * App-wide scene backdrop. One fixed, layered background (nebula, stars, two silhouette layers,
 * drifting motes, vignette) whose theme follows the current screen, so all game modes read as one
 * world while each keeps its own place. Silhouettes are generated from seeded shapes (original art,
 * no assets to download). Only opacity/transform animate; reduced-motion and the "lite" performance
 * mode switch the movement off.
 */
import { memo } from 'react';

export type BackdropTheme = 'sky' | 'arena' | 'race' | 'library' | 'sea' | 'noir' | 'escape' | 'forum' | 'city' | 'tournament';

const W = 1600;
const H = 600;

/** Deterministic pseudo-random sequence (mulberry32), so the scenery is identical on every load. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r1 = (n: number) => Math.round(n * 10) / 10;

function skyline(seed: number, base: number, minH: number, maxH: number, minW: number, maxW: number): string {
  const r = rng(seed);
  let x = -20;
  let d = `M${x} ${H}V${base}`;
  while (x < W + 20) {
    const w = minW + r() * (maxW - minW);
    const top = base - (minH + r() * (maxH - minH));
    d += `H${r1(x)}V${r1(top)}`;
    if (r() > 0.75) d += `H${r1(x + w * 0.45)}V${r1(top - 18 - r() * 22)}H${r1(x + w * 0.5)}V${r1(top)}`;
    if (r() > 0.8) d += `H${r1(x + w * 0.2)}L${r1(x + w * 0.5)} ${r1(top - w * 0.35)}L${r1(x + w * 0.8)} ${r1(top)}`;
    x += w;
    d += `H${r1(x)}`;
  }
  return `${d}V${H}Z`;
}

function crystals(seed: number, base: number, count: number, minH: number, maxH: number): string {
  const r = rng(seed);
  let d = '';
  for (let i = 0; i < count; i++) {
    const cx = (i + r() * 0.8) * (W / count);
    const h = minH + r() * (maxH - minH);
    const w = h * (0.16 + r() * 0.12);
    const lean = (r() - 0.5) * w * 0.8;
    d += `M${r1(cx - w)} ${base}L${r1(cx - w * 0.6 + lean)} ${r1(base - h * 0.82)}L${r1(cx + lean)} ${r1(base - h)}L${r1(cx + w * 0.6 + lean)} ${r1(base - h * 0.8)}L${r1(cx + w)} ${base}Z`;
  }
  return `${d}M0 ${H}V${base - 4}H${W}V${H}Z`;
}

function hills(seed: number, base: number, amp: number, steps = 9): string {
  const r = rng(seed);
  let d = `M0 ${H}V${base}`;
  const step = W / steps;
  for (let i = 0; i < steps; i++) {
    const x = (i + 1) * step;
    const y = base - r() * amp;
    d += `Q${r1(x - step / 2)} ${r1(y - amp * 0.6)} ${r1(x)} ${r1(base - r() * amp * 0.4)}`;
  }
  return `${d}V${H}Z`;
}

function waves(base: number, amp: number, len: number): string {
  let d = `M0 ${H}V${base}`;
  for (let x = 0; x < W + len * 2; x += len) d += `q${len / 4} ${-amp} ${len / 2} 0t${len / 2} 0`;
  return `${d}V${H}Z`;
}

function columns(base: number, count: number, height: number): string {
  let d = '';
  const gap = W / count;
  for (let i = 0; i < count; i++) {
    const x = i * gap + gap * 0.3;
    const w = gap * 0.18;
    d += `M${r1(x)} ${base}V${base - height}h${r1(w)}V${base}Z`;
    d += `M${r1(x - w * 0.4)} ${base - height}h${r1(w * 1.8)}v-14h${r1(-w * 1.8)}Z`;
  }
  // Architrave and steps.
  d += `M0 ${base - height - 14}h${W}v-22H0Z`;
  d += `M0 ${H}V${base}h${W}V${H}Z`;
  return d;
}

function arches(seed: number, base: number, count: number, height: number): string {
  const r = rng(seed);
  let d = `M0 ${H}V${base - height - 40}H${W}V${H}Z`;
  const gap = W / count;
  // Window openings are cut out with the even-odd rule.
  for (let i = 0; i < count; i++) {
    const w = gap * (0.42 + r() * 0.1);
    const x = i * gap + (gap - w) / 2;
    const top = base - height + w / 2;
    d += `M${r1(x)} ${base}V${r1(top)}A${r1(w / 2)} ${r1(w / 2)} 0 0 1 ${r1(x + w)} ${r1(top)}V${base}Z`;
  }
  return d;
}

function shelves(seed: number, base: number, rows: number): string {
  const r = rng(seed);
  let d = `M0 ${H}V${base}H${W}V${H}Z`;
  for (let row = 0; row < rows; row++) {
    const y = base - row * 58;
    d += `M0 ${y}h${W}v6H0Z`;
    let x = 0;
    while (x < W) {
      const w = 9 + r() * 14;
      const h = 30 + r() * 20;
      if (r() > 0.12) d += `M${r1(x)} ${y}v${r1(-h)}h${r1(w - 2)}v${r1(h)}Z`;
      x += w;
    }
  }
  return d;
}

function rooftops(seed: number, base: number): string {
  const r = rng(seed);
  let x = -10;
  // Each house is its own closed shape (nonzero fill), so overlapping chimneys never punch holes.
  let d = `M0 ${H}V${base - 20}H${W}V${H}Z`;
  while (x < W + 10) {
    const w = 80 + r() * 90;
    const wall = base - 40 - r() * 70;
    const peak = wall - 30 - r() * 40;
    if (r() > 0.4) {
      const cx = x + w * (0.18 + r() * 0.12);
      d += `M${r1(cx)} ${base}V${r1(wall - (wall - peak) * 0.75)}h16V${base}Z`;
    }
    d += `M${r1(x)} ${base}V${r1(wall)}L${r1(x + w / 2)} ${r1(peak)}L${r1(x + w)} ${r1(wall)}V${base}Z`;
    x += w - 2;
  }
  return d;
}

function gear(cx: number, cy: number, rad: number, teeth: number): string {
  let d = '';
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? rad : rad * 0.84;
    const a2 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    d += `${i === 0 ? 'M' : 'L'}${r1(cx + Math.cos(a) * rr)} ${r1(cy + Math.sin(a) * rr)}L${r1(cx + Math.cos(a2) * rr)} ${r1(cy + Math.sin(a2) * rr)}`;
  }
  const hole = rad * 0.3;
  return `${d}Z M${cx + hole} ${cy}A${hole} ${hole} 0 1 0 ${cx - hole} ${cy}A${hole} ${hole} 0 1 0 ${cx + hole} ${cy}Z`;
}

function castle(base: number): string {
  const wallTop = base - 80;
  let d = `M0 ${H}V${wallTop}`;
  // Crenellated curtain wall.
  for (let x = 0; x < W; x += 40) d += `H${x + 20}V${wallTop - 16}H${x + 40}V${wallTop}`;
  d += `V${H}Z`;
  const towers = [
    [170, 170, 64, 'cone'],
    [500, 215, 84, 'crown'],
    [800, 260, 116, 'cone'],
    [1100, 215, 84, 'crown'],
    [1430, 170, 64, 'cone'],
  ] as const;
  for (const [cx, h, w, roof] of towers) {
    const top = base - h;
    const l = cx - w / 2;
    if (roof === 'cone') {
      const tip = top - w * 1.05;
      d += `M${l} ${base}V${top}H${l - 8}L${cx} ${tip}L${l + w + 8} ${top}H${l + w}V${base}Z`;
      d += `M${cx - 2} ${tip + 4}V${tip - 46}h4V${tip + 4}Z M${cx + 2} ${tip - 46}l40 11-40 11Z`;
    } else {
      d += `M${l} ${base}V${top}`;
      for (let i = 0; i < 4; i++) d += `h${w / 8}v-18h${w / 8}v18`;
      d += `V${base}Z`;
      d += `M${cx - 2} ${top - 18}V${top - 70}h4V${top - 18}Z M${cx + 2} ${top - 70}l34 10-34 10Z`;
    }
  }
  return d;
}

function islands(): { far: string; near: string } {
  return {
    far: 'M80 330 C140 300 260 300 320 330 L260 420 L200 470 L150 410 Z M1230 260 C1300 230 1440 236 1500 268 L1440 352 L1380 400 L1320 340 Z M1060 380 C1100 364 1170 366 1200 382 L1160 430 L1120 452 Z',
    near: 'M0 600 L0 520 C200 480 400 500 600 470 C800 440 1000 470 1200 455 C1400 440 1500 470 1600 460 L1600 600 Z',
  };
}

interface Scene {
  far: string;
  near: string;
  /** Even-odd is only needed where shapes are cut out of a wall (library windows). */
  farRule?: 'evenodd';
  /** Optional decorative layer drawn between far and near (moon, gears, lighthouse…). */
  extra?: { d: string; className: string }[];
}

const SCENES: Record<BackdropTheme, Scene> = {
  sky: islands(),
  arena: { far: crystals(11, 520, 16, 120, 300), near: crystals(12, 585, 22, 40, 120) },
  race: { far: skyline(21, 470, 80, 260, 50, 110), near: skyline(22, 560, 30, 120, 70, 150) },
  library: { far: arches(31, 470, 7, 300), near: shelves(32, 590, 2), farRule: 'evenodd' },
  sea: {
    far: `${hills(41, 430, 90, 5)} M1210 430v-150h26v150Z M1200 280h46l-23-30Z`,
    near: waves(540, 18, 160),
    extra: [{ d: waves(505, 12, 120), className: 'backdrop__swell' }],
  },
  noir: {
    far: skyline(51, 430, 120, 300, 70, 140),
    near: rooftops(52, 600),
    extra: [{ d: 'M1260 120a58 58 0 1 0 1 0Z', className: 'backdrop__moon' }],
  },
  escape: {
    far: `M720 600V170h160V600Z M700 170h200l-100-90Z ${hills(61, 470, 60, 6)}`,
    near: hills(62, 560, 40, 8),
    extra: [
      { d: gear(230, 230, 120, 12), className: 'backdrop__gear' },
      { d: gear(1380, 300, 90, 10), className: 'backdrop__gear backdrop__gear--rev' },
      { d: 'M800 255a50 50 0 1 0 1 0Z', className: 'backdrop__clock' },
    ],
  },
  forum: { far: columns(520, 9, 300), near: `M0 ${H}V575H${W}V${H}Z M80 575V555H${W - 80}V575Z` },
  city: { far: skyline(81, 480, 60, 200, 60, 120), near: `${hills(82, 575, 30, 14)}` },
  tournament: { far: castle(470), near: hills(92, 560, 36, 10) },
};

function BackdropImpl({ theme }: { theme: BackdropTheme }) {
  const scene = SCENES[theme];
  return (
    <div className={`backdrop backdrop--${theme}`} aria-hidden="true" data-backdrop={theme}>
      <div className="backdrop__nebula" />
      <div className="backdrop__stars" />
      <svg className="backdrop__scene" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
        <path className="backdrop__far" d={scene.far} fillRule={scene.farRule ?? 'nonzero'} />
        {scene.extra?.map((e) => (
          <path key={e.className + e.d.length} className={e.className} d={e.d} />
        ))}
        <path className="backdrop__near" d={scene.near} />
      </svg>
      <div className="backdrop__motes">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{ ['--i' as string]: i }} />
        ))}
      </div>
      <div className="backdrop__vignette" />
    </div>
  );
}

export const Backdrop = memo(BackdropImpl);
