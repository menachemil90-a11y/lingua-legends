/** Original rank emblems. Complexity grows with each tier (Bronze → Legend). */
import { RANK_TIERS, type RankTier } from '@lingua/shared';

const TIER_COLORS: Record<RankTier, [string, string, string]> = {
  bronze: ['#ffd2b0', '#d98a50', '#6a3415'],
  silver: ['#ffffff', '#b8c6df', '#56627d'],
  gold: ['#fff4c4', '#f5c451', '#8f5f10'],
  platinum: ['#eafffb', '#74e0d2', '#22717a'],
  diamond: ['#eef8ff', '#6fc6ff', '#3a3fd6'],
  master: ['#f6e6ff', '#b26bff', '#45179e'],
  legend: ['#fff7da', '#ff9f43', '#b3123f'],
};

export function emblemSvg(tier: RankTier, division: 1 | 2 | 3 | null, u: string): string {
  const id = u.replace(/[^a-zA-Z0-9]/g, '');
  const t = RANK_TIERS.indexOf(tier);
  const [hi, mid, lo] = TIER_COLORS[tier];
  const parts: string[] = [];
  if (t >= 6) {
    const rays = Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * 360;
      return `<path d="M80 80 L74 2 L86 2 Z" transform="rotate(${a} 80 80)" fill="url(#${id}-ray)"/>`;
    }).join('');
    parts.push(`<g opacity=".9">${rays}</g>`);
  }
  if (t >= 5) {
    const leaves = Array.from({ length: 7 }, (_, i) => {
      const a = 200 + i * 20;
      const r = 58;
      const x = 80 + Math.cos((a * Math.PI) / 180) * r;
      const y = 84 + Math.sin((a * Math.PI) / 180) * r * -1;
      const x2 = 160 - x;
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="9" ry="4" transform="rotate(${(a + 90).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${mid}" stroke="${lo}" stroke-width="1"/>
<ellipse cx="${x2.toFixed(1)}" cy="${y.toFixed(1)}" rx="9" ry="4" transform="rotate(${(-a - 90).toFixed(0)} ${x2.toFixed(1)} ${y.toFixed(1)})" fill="${mid}" stroke="${lo}" stroke-width="1"/>`;
    }).join('');
    parts.push(leaves);
  }
  if (t >= 1) {
    const big = t >= 3;
    const w = big
      ? 'M44 64 C24 52 10 54 2 44 C8 66 18 82 40 90 C24 92 14 96 8 104 C26 108 40 104 48 96 Z'
      : 'M46 70 C32 62 22 62 14 56 C18 72 28 82 44 88 Z';
    parts.push(`<path d="${w}" fill="url(#${id}-wing)" stroke="${lo}" stroke-width="1.5"/>`);
    parts.push(`<path d="${w}" transform="translate(160 0) scale(-1 1)" fill="url(#${id}-wing)" stroke="${lo}" stroke-width="1.5"/>`);
  }
  // Shield base
  parts.push(`<path d="M80 22 L124 36 L122 86 C120 112 102 130 80 140 C58 130 40 112 38 86 L36 36 Z" fill="url(#${id}-base)" stroke="${lo}" stroke-width="3"/>`);
  parts.push(`<path d="M80 30 L116 42 L114 86 C112 106 98 121 80 130 C62 121 48 106 46 86 L44 42 Z" fill="url(#${id}-inner)" stroke="${hi}" stroke-width="1.5" opacity=".95"/>`);
  parts.push(`<path d="M52 44 L80 34 L80 70 L48 76 Z" fill="#fff" opacity=".18"/>`);
  if (t >= 2) {
    const crown =
      t >= 5
        ? 'M50 30 L56 8 L66 22 L80 2 L94 22 L104 8 L110 30 Z'
        : 'M56 30 L60 12 L70 22 L80 8 L90 22 L100 12 L104 30 Z';
    parts.push(`<path d="${crown}" fill="url(#${id}-crown)" stroke="#6a4a0c" stroke-width="1.5"/>`);
    parts.push(`<circle cx="80" cy="${t >= 5 ? 6 : 12}" r="3.5" fill="#fff"/>`);
  }
  if (t >= 4) {
    parts.push(`<path d="M80 52 L100 70 L80 108 L60 70 Z" fill="url(#${id}-gem)" stroke="#fff" stroke-width="1.5"/>
<path d="M60 70 L100 70 M80 52 L72 70 L80 108 L88 70 Z" stroke="#fff" stroke-width="1" fill="none" opacity=".7"/>`);
  } else if (t === 3) {
    parts.push(`<path d="M80 58 L96 74 L80 98 L64 74 Z" fill="url(#${id}-gem)" stroke="#fff" stroke-width="1.5"/>
<path d="M64 74 L96 74 M80 58 L80 98" stroke="#fff" stroke-width="1" opacity=".6"/>`);
  } else {
    parts.push(`<path d="M62 70 L80 58 L98 70 M62 86 L80 74 L98 86" stroke="${hi}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  if (t >= 6) parts.push(`<circle cx="80" cy="80" r="10" fill="#fff" opacity=".6" filter="url(#${id}-blur)"/>`);
  if (division) {
    const n = 4 - division;
    const pips = Array.from({ length: n }, (_, i) => {
      const x = 80 + (i - (n - 1) / 2) * 16;
      return `<path d="M${x - 6} 146 L${x} 152 L${x + 6} 146" stroke="${hi}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    }).join('');
    parts.push(pips);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
<defs>
  <linearGradient id="${id}-base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".5" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
  <linearGradient id="${id}-inner" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lo}"/><stop offset="1" stop-color="#0a1230"/></linearGradient>
  <linearGradient id="${id}-wing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${mid}"/></linearGradient>
  <linearGradient id="${id}-crown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4c4"/><stop offset="1" stop-color="#d49a24"/></linearGradient>
  <linearGradient id="${id}-gem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="${hi}"/><stop offset="1" stop-color="${mid}"/></linearGradient>
  <linearGradient id="${id}-ray" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${hi}" stop-opacity="1"/><stop offset=".6" stop-color="${mid}" stop-opacity=".8"/><stop offset="1" stop-color="${mid}" stop-opacity="0"/></linearGradient>
  <filter id="${id}-blur"><feGaussianBlur stdDeviation="5"/></filter>
</defs>
${parts.join('\n')}
</svg>`;
}
