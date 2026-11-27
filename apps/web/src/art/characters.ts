/**
 * Original hero art, generated as SVG so it stays crisp at any size and can be
 * rasterised into Phaser textures. Each hero has a distinct silhouette.
 * `u` is a unique id prefix so several heroes can share one page.
 */
import { CHARACTERS, type CharacterDef } from '@lingua/shared';
import { shade } from './color';

export const HERO_VIEWBOX = { w: 240, h: 300 };

export interface HeroOptions {
  /** Animate internal parts (lobby). Off for rasterised textures. */
  animated?: boolean;
  /** Mirror horizontally (opponent side). */
  flip?: boolean;
}

function styleBlock(u: string, animated: boolean): string {
  if (!animated) return '';
  return `<style>
  .${u}-float{animation:${u}-float 3.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
  .${u}-spin{animation:${u}-spin 9s linear infinite;transform-box:fill-box;transform-origin:center}
  .${u}-pulse{animation:${u}-pulse 2.4s ease-in-out infinite}
  .${u}-sway{animation:${u}-sway 4.5s ease-in-out infinite;transform-box:fill-box;transform-origin:top center}
  .${u}-mote{animation:${u}-mote 4s ease-in-out infinite}
  @keyframes ${u}-float{50%{transform:translateY(-7px)}}
  @keyframes ${u}-spin{to{transform:rotate(360deg)}}
  @keyframes ${u}-pulse{50%{opacity:.45}}
  @keyframes ${u}-sway{50%{transform:skewX(2.5deg) scaleX(1.02)}}
  @keyframes ${u}-mote{0%{transform:translateY(8px);opacity:0}40%{opacity:1}100%{transform:translateY(-26px);opacity:0}}
  @media (prefers-reduced-motion: reduce){[class^="${u}-"]{animation:none!important}}
</style>`;
}

function wrap(u: string, body: string, defs: string, opts: HeroOptions): string {
  const t = opts.flip ? `transform="translate(${HERO_VIEWBOX.w} 0) scale(-1 1)"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${HERO_VIEWBOX.w} ${HERO_VIEWBOX.h}" width="${HERO_VIEWBOX.w}" height="${HERO_VIEWBOX.h}">
${styleBlock(u, !!opts.animated)}
<defs>
  <filter id="${u}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
  <filter id="${u}-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>
  <radialGradient id="${u}-shadow"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  ${defs}
</defs>
<g ${t}>
<ellipse cx="120" cy="284" rx="74" ry="12" fill="url(#${u}-shadow)"/>
${body}
</g>
</svg>`;
}

function motes(u: string, color: string): string {
  const pts = [
    [44, 120, 0],
    [196, 96, 1.1],
    [60, 220, 2.2],
    [186, 210, 0.6],
    [30, 170, 1.7],
  ];
  return pts
    .map(
      ([x, y, d]) =>
        `<path class="${u}-mote" style="animation-delay:${d}s" d="M${x} ${y! - 4}l3 4-3 4-3-4z" fill="${color}" opacity=".9"/>`,
    )
    .join('');
}

function vexa(u: string, c: CharacterDef['palette'], o: HeroOptions): string {
  const hood1 = shade(c.primary, 0.28);
  const hood2 = shade(c.primary, -0.25);
  const defs = `
  <linearGradient id="${u}-coat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c.primary, 0.22)}"/><stop offset="1" stop-color="${shade(c.primary, -0.35)}"/></linearGradient>
  <linearGradient id="${u}-rim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="${c.glow}" stop-opacity=".28"/></linearGradient>
  <linearGradient id="${u}-hood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hood1}"/><stop offset="1" stop-color="${hood2}"/></linearGradient>
  <linearGradient id="${u}-blade" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${c.accent}"/><stop offset=".6" stop-color="${c.glow}"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
  <radialGradient id="${u}-eye"><stop offset="0" stop-color="${c.glow}" stop-opacity=".95"/><stop offset="1" stop-color="${c.accent}" stop-opacity="0"/></radialGradient>
  <linearGradient id="${u}-cape" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c.secondary, 0.25)}"/><stop offset="1" stop-color="${shade(c.accent, -0.55)}"/></linearGradient>`;
  const body = `
<g class="${u}-sway">
  <path d="M78 128 C60 172 54 222 42 264 L120 254 L198 264 C186 222 180 172 162 128 Z" fill="url(#${u}-cape)"/>
  <path d="M78 128 C60 172 54 222 42 264" stroke="${c.accent}" stroke-width="2.5" fill="none" opacity=".7"/>
  <path d="M162 128 C180 172 186 222 198 264" stroke="${c.accent}" stroke-width="2.5" fill="none" opacity=".7"/>
</g>
<path d="M110 198 L104 266 L119 268 L120 200Z" fill="#0b1430"/>
<path d="M130 198 L136 266 L121 268 L120 200Z" fill="#0d1838"/>
<path d="M98 262 L95 279 Q108 286 121 280 L119 262Z" fill="#0a122b"/>
<path d="M142 262 L145 279 Q132 286 119 280 L121 262Z" fill="#0c1633"/>
<path d="M96 276 Q108 281 120 277" stroke="${c.accent}" stroke-width="2" fill="none"/>
<path d="M144 276 Q132 281 120 277" stroke="${c.accent}" stroke-width="2" fill="none"/>
<path d="M88 126 C82 160 74 210 66 254 C86 262 102 263 115 257 L120 198 L125 257 C138 263 154 262 174 254 C166 210 158 160 152 126 Z" fill="url(#${u}-coat)"/>
<path d="M88 126 C82 160 74 210 66 254 C86 262 102 263 115 257 L120 198 L125 257 C138 263 154 262 174 254 C166 210 158 160 152 126 Z" fill="url(#${u}-rim)"/>
<path d="M66 254 C86 262 102 263 115 257 M125 257 C138 263 154 262 174 254" stroke="${c.accent}" stroke-width="3" fill="none"/>
<path d="M120 132 L120 196" stroke="${c.accent}" stroke-width="2.5" opacity=".85"/>
<path d="M100 150 l6 6 -6 6 -6 -6z M140 150 l6 6 -6 6 -6 -6z" fill="${c.accent}" opacity=".55"/>
<path d="M86 178 Q120 189 154 178 L156 191 Q120 202 84 191 Z" fill="${shade(c.secondary, -0.3)}" stroke="${c.accent}" stroke-width="1.2"/>
<path d="M120 182 l7 7 -7 7 -7 -7z" fill="${c.glow}"/>
<circle cx="120" cy="189" r="9" fill="url(#${u}-eye)" class="${u}-pulse"/>
<path d="M80 130 Q120 106 160 130 L170 158 Q120 174 70 158 Z" fill="url(#${u}-hood)"/>
<path d="M70 158 Q120 174 170 158" stroke="${c.accent}" stroke-width="2.5" fill="none"/>
<path d="M84 136 C66 146 56 160 48 176 L61 185 C70 171 80 161 94 152 Z" fill="url(#${u}-coat)"/>
<circle cx="52" cy="183" r="7.5" fill="#0b1636"/>
<g class="${u}-spin">
  <circle cx="40" cy="172" r="22" fill="none" stroke="${c.accent}" stroke-width="2" stroke-dasharray="5 6" opacity=".9"/>
  <circle cx="40" cy="172" r="14" fill="none" stroke="${c.glow}" stroke-width="1.2" opacity=".7"/>
  <path d="M40 150 v6 M62 172 h-6 M40 194 v-6 M18 172 h6" stroke="${c.glow}" stroke-width="2"/>
</g>
<circle cx="40" cy="172" r="12" fill="url(#${u}-eye)" class="${u}-pulse"/>
<path d="M156 136 C172 150 178 168 180 186 L168 191 C166 173 160 161 148 151 Z" fill="url(#${u}-coat)"/>
<circle cx="174" cy="192" r="7.5" fill="#0b1636"/>
<g class="${u}-float">
  <g transform="translate(182 196) rotate(16)">
    <path d="M0 -8 L9 -34 L5 -124 L0 -142 L-5 -124 L-9 -34 Z" fill="${c.accent}" filter="url(#${u}-blur)" opacity=".8"/>
    <path d="M0 -8 L9 -34 L5 -124 L0 -142 L-5 -124 L-9 -34 Z" fill="url(#${u}-blade)"/>
    <path d="M0 -14 L0 -132" stroke="#fff" stroke-width="1.4" opacity=".8"/>
    <rect x="-15" y="-9" width="30" height="7" rx="3.5" fill="${c.glow}"/>
    <rect x="-3.5" y="-3" width="7" height="18" rx="2" fill="#0b1636"/>
    <circle cx="0" cy="18" r="4.5" fill="${c.accent}"/>
  </g>
</g>
<path d="M84 104 C82 70 96 44 120 28 C144 44 158 70 156 104 C150 124 136 135 120 137 C104 135 90 124 84 104 Z" fill="url(#${u}-hood)"/>
<path d="M120 28 C128 24 136 26 140 32" stroke="${hood1}" stroke-width="5" stroke-linecap="round" fill="none"/>
<path d="M96 98 C96 78 106 65 120 63 C134 65 144 78 144 98 C142 115 132 125 120 127 C108 125 98 115 96 98 Z" fill="#040a1c"/>
<path d="M96 98 C96 78 106 65 120 63 C134 65 144 78 144 98" stroke="${c.accent}" stroke-width="2.5" fill="none"/>
<ellipse cx="120" cy="96" rx="24" ry="9" fill="url(#${u}-eye)" class="${u}-pulse"/>
<path d="M102 92 L116 96 L104 100 Z" fill="#e8feff"/>
<path d="M138 92 L124 96 L136 100 Z" fill="#e8feff"/>
<path d="M110 114 Q120 119 130 114" stroke="${c.accent}" stroke-width="1.5" fill="none" opacity=".45"/>
${motes(u, c.glow)}`;
  return wrap(u, body, defs, o);
}

function kael(u: string, c: CharacterDef['palette'], o: HeroOptions): string {
  const steel1 = '#9fb2d6';
  const steel2 = '#3a4a6e';
  const defs = `
  <linearGradient id="${u}-steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${steel1}"/><stop offset=".55" stop-color="#5c6f97"/><stop offset="1" stop-color="${steel2}"/></linearGradient>
  <linearGradient id="${u}-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c2"/><stop offset=".45" stop-color="${c.accent}"/><stop offset="1" stop-color="#9a6a14"/></linearGradient>
  <linearGradient id="${u}-cloth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c.primary, 0.15)}"/><stop offset="1" stop-color="${shade(c.secondary, -0.2)}"/></linearGradient>
  <linearGradient id="${u}-shield" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(c.primary, 0.35)}"/><stop offset="1" stop-color="${shade(c.secondary, -0.1)}"/></linearGradient>
  <radialGradient id="${u}-visor"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".4" stop-color="${c.glow}" stop-opacity=".9"/><stop offset="1" stop-color="${c.accent}" stop-opacity="0"/></radialGradient>`;
  const body = `
<g class="${u}-sway">
  <path d="M82 126 C68 176 62 224 54 266 L186 266 C178 224 172 176 158 126 Z" fill="url(#${u}-cloth)"/>
  <path d="M54 266 L186 266" stroke="url(#${u}-gold)" stroke-width="4"/>
</g>
<path d="M98 210 L94 268 L116 268 L118 212Z" fill="url(#${u}-steel)"/>
<path d="M142 210 L146 268 L124 268 L122 212Z" fill="url(#${u}-steel)"/>
<path d="M90 262 L88 280 L120 280 L118 262Z" fill="${steel2}"/>
<path d="M150 262 L152 280 L120 280 L122 262Z" fill="#2d3a58"/>
<path d="M92 236 L118 236 M122 236 L148 236" stroke="url(#${u}-gold)" stroke-width="3"/>
<path d="M86 130 Q120 116 154 130 L160 206 Q120 222 80 206 Z" fill="url(#${u}-steel)"/>
<path d="M86 130 Q120 116 154 130 L160 206 Q120 222 80 206 Z" fill="none" stroke="#1c2640" stroke-width="2"/>
<path d="M120 128 L120 210" stroke="${steel1}" stroke-width="2" opacity=".6"/>
<path d="M104 160 Q120 150 136 160 L130 182 Q120 188 110 182 Z" fill="url(#${u}-gold)"/>
<circle cx="120" cy="168" r="6" fill="${c.glow}" class="${u}-pulse"/>
<path d="M80 206 Q120 222 160 206 L162 220 Q120 236 78 220 Z" fill="#20293f" stroke="url(#${u}-gold)" stroke-width="2"/>
<path d="M156 140 C176 150 186 170 188 194 L174 198 C170 178 164 166 150 156 Z" fill="url(#${u}-steel)"/>
<circle cx="182" cy="200" r="9" fill="#2a3550"/>
<g transform="translate(184 200) rotate(-24)">
  <rect x="-4" y="-104" width="8" height="98" rx="3" fill="url(#${u}-steel)"/>
  <path d="M0 -112 L6 -100 L-6 -100 Z" fill="${steel1}"/>
  <path d="M0 -96 L0 -14" stroke="${c.glow}" stroke-width="2" class="${u}-pulse"/>
  <rect x="-16" y="-8" width="32" height="7" rx="3" fill="url(#${u}-gold)"/>
  <rect x="-3.5" y="-2" width="7" height="18" rx="2" fill="#3a2a10"/>
  <circle cx="0" cy="19" r="5" fill="url(#${u}-gold)"/>
</g>
<path d="M70 118 Q92 104 110 124 L104 148 Q84 152 64 144 Z" fill="url(#${u}-gold)"/>
<path d="M170 118 Q148 104 130 124 L136 148 Q156 152 176 144 Z" fill="url(#${u}-gold)"/>
<path d="M68 128 Q88 118 104 134" stroke="#7a5210" stroke-width="2" fill="none"/>
<path d="M172 128 Q152 118 136 134" stroke="#7a5210" stroke-width="2" fill="none"/>
<path d="M90 98 C88 64 102 44 120 42 C138 44 152 64 150 98 C150 116 138 128 120 130 C102 128 90 116 90 98 Z" fill="url(#${u}-steel)"/>
<path d="M120 42 C122 26 134 14 150 12 C142 22 140 32 134 46" fill="${shade(c.accent, -0.1)}"/>
<path d="M120 42 L120 128" stroke="${steel1}" stroke-width="2" opacity=".5"/>
<path d="M96 92 Q120 84 144 92 L142 102 Q120 96 98 102 Z" fill="#070c1c"/>
<ellipse cx="120" cy="96" rx="22" ry="7" fill="url(#${u}-visor)" class="${u}-pulse"/>
<path d="M104 112 h32 M106 118 h28" stroke="#1c2640" stroke-width="2.5"/>
<path d="M90 98 C88 64 102 44 120 42 C138 44 152 64 150 98" stroke="url(#${u}-gold)" stroke-width="3" fill="none"/>
<g>
  <path d="M22 140 L96 140 L96 192 Q96 238 59 262 Q22 238 22 192 Z" fill="url(#${u}-shield)"/>
  <path d="M22 140 L96 140 L96 192 Q96 238 59 262 Q22 238 22 192 Z" fill="none" stroke="url(#${u}-gold)" stroke-width="5"/>
  <path d="M30 148 L88 148 L88 192 Q88 230 59 250 Q30 230 30 192 Z" fill="none" stroke="${c.accent}" stroke-width="1.2" opacity=".5"/>
  <circle cx="59" cy="190" r="22" fill="none" stroke="url(#${u}-gold)" stroke-width="3"/>
  <path d="M59 172 L64 186 L78 190 L64 194 L59 208 L54 194 L40 190 L54 186 Z" fill="${c.glow}" class="${u}-pulse"/>
  <path d="M36 152 Q40 146 50 146" stroke="#fff" stroke-width="2" opacity=".5" fill="none"/>
</g>
${motes(u, c.glow)}`;
  return wrap(u, body, defs, o);
}

function nyra(u: string, c: CharacterDef['palette'], o: HeroOptions): string {
  const skin = '#e9b892';
  const skinShade = '#c98d6a';
  const hair = '#1b1236';
  const defs = `
  <linearGradient id="${u}-jacket" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c.primary, 0.3)}"/><stop offset="1" stop-color="${shade(c.primary, -0.3)}"/></linearGradient>
  <linearGradient id="${u}-scarf" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c.accent}"/><stop offset="1" stop-color="${shade(c.accent, -0.4)}"/></linearGradient>
  <linearGradient id="${u}-bow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="${c.glow}"/><stop offset="1" stop-color="${c.accent}"/></linearGradient>
  <radialGradient id="${u}-spark"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="${c.glow}"/><stop offset="1" stop-color="${c.accent}" stop-opacity="0"/></radialGradient>
  <linearGradient id="${u}-skin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${skin}"/><stop offset="1" stop-color="${skinShade}"/></linearGradient>`;
  const body = `
<g class="${u}-sway">
  <path d="M126 70 C150 74 176 92 196 128 C182 120 168 116 154 118 C164 104 150 90 130 86 Z" fill="${hair}"/>
  <path d="M100 132 C78 140 58 150 36 146 C48 158 66 162 82 158 C72 170 58 178 44 182 C66 186 88 176 104 160 Z" fill="url(#${u}-scarf)"/>
</g>
<path d="M104 196 L96 262 L112 264 L118 200Z" fill="#1a1030"/>
<path d="M136 196 L146 262 L130 264 L122 200Z" fill="#20143c"/>
<path d="M92 256 L88 280 L116 280 L114 256Z" fill="#2a1a4a"/>
<path d="M150 256 L154 280 L126 280 L128 256Z" fill="#311f56"/>
<path d="M90 268 h24 M128 268 h24" stroke="${c.accent}" stroke-width="2.5"/>
<path d="M96 186 Q120 198 144 186 L148 206 Q120 216 92 206 Z" fill="#160c2c"/>
<path d="M92 130 Q120 118 148 130 L152 192 Q120 204 88 192 Z" fill="url(#${u}-jacket)"/>
<path d="M120 132 L112 192 M120 132 L128 192" stroke="${c.glow}" stroke-width="1.6" opacity=".6"/>
<path d="M94 176 Q120 186 146 176" stroke="${c.accent}" stroke-width="3" fill="none"/>
<path d="M92 132 C74 142 62 152 54 162 L64 172 C72 164 84 156 98 150 Z" fill="url(#${u}-jacket)"/>
<circle cx="58" cy="168" r="7" fill="url(#${u}-skin)"/>
<path d="M146 134 C162 148 168 160 168 176 L156 178 C154 166 148 158 138 152 Z" fill="url(#${u}-jacket)"/>
<circle cx="162" cy="178" r="7" fill="url(#${u}-skin)"/>
<g class="${u}-float">
  <path d="M54 72 C20 120 20 216 54 262" stroke="${c.accent}" stroke-width="12" fill="none" filter="url(#${u}-blur)" opacity=".7"/>
  <path d="M54 72 C20 120 20 216 54 262" stroke="url(#${u}-bow)" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M54 72 C42 92 40 104 46 112 M54 262 C42 242 40 230 46 222" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/>
  <path d="M54 72 L64 168 L54 262" stroke="${c.glow}" stroke-width="1.5" fill="none" opacity=".9"/>
  <path d="M64 168 L172 168" stroke="${c.glow}" stroke-width="3" class="${u}-pulse"/>
  <path d="M172 168 l-12 -7 4 7 -4 7z" fill="#fff"/>
  <path d="M90 168 l-6 -6 M100 168 l-6 6 M112 168 l-6 -6" stroke="${c.glow}" stroke-width="1.5"/>
  <circle cx="172" cy="168" r="12" fill="url(#${u}-spark)" class="${u}-pulse"/>
</g>
<path d="M110 118 L110 130 Q120 136 130 130 L130 118Z" fill="${skinShade}"/>
<path d="M94 86 C94 64 106 52 120 52 C134 52 146 64 146 86 C146 106 134 120 120 120 C106 120 94 106 94 86 Z" fill="url(#${u}-skin)"/>
<path d="M92 88 C88 58 104 44 122 44 C142 44 152 60 150 82 C140 70 128 66 116 64 C108 72 100 78 92 88 Z" fill="${hair}"/>
<path d="M116 64 C124 70 132 72 146 74" stroke="#3a2a66" stroke-width="2" fill="none"/>
<path d="M104 90 Q109 86 114 90" stroke="#2a1a3a" stroke-width="2.5" fill="none"/>
<path d="M126 90 Q131 86 136 90" stroke="#2a1a3a" stroke-width="2.5" fill="none"/>
<ellipse cx="109" cy="95" rx="3.6" ry="4.2" fill="${c.accent}"/>
<ellipse cx="131" cy="95" rx="3.6" ry="4.2" fill="${c.accent}"/>
<circle cx="110" cy="94" r="1.2" fill="#fff"/>
<circle cx="132" cy="94" r="1.2" fill="#fff"/>
<path d="M114 108 Q120 111 126 108" stroke="#8a4a3a" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M98 100 l6 2 M142 100 l-6 2" stroke="${c.accent}" stroke-width="2" opacity=".8"/>
${motes(u, c.glow)}`;
  return wrap(u, body, defs, o);
}

function torque(u: string, c: CharacterDef['palette'], o: HeroOptions): string {
  const defs = `
  <linearGradient id="${u}-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(c.primary, 0.45)}"/><stop offset=".5" stop-color="${shade(c.primary, 0.05)}"/><stop offset="1" stop-color="${shade(c.secondary, -0.2)}"/></linearGradient>
  <linearGradient id="${u}-plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c.accent, 0.25)}"/><stop offset="1" stop-color="${shade(c.accent, -0.35)}"/></linearGradient>
  <radialGradient id="${u}-core"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="${c.glow}"/><stop offset=".8" stop-color="${c.accent}"/><stop offset="1" stop-color="${c.accent}" stop-opacity="0"/></radialGradient>
  <radialGradient id="${u}-lens"><stop offset="0" stop-color="#e6fbff"/><stop offset=".5" stop-color="#38e1ff"/><stop offset="1" stop-color="#0b4f7a"/></radialGradient>`;
  const gear = (cx: number, cy: number, r: number) => {
    const teeth = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      return `<rect x="${(x - 4).toFixed(1)}" y="${(y - 4).toFixed(1)}" width="8" height="8" rx="2" transform="rotate(${((a * 180) / Math.PI).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    }).join('');
    return `<g class="${u}-spin" fill="url(#${u}-plate)">${teeth}<circle cx="${cx}" cy="${cy}" r="${r}" /><circle cx="${cx}" cy="${cy}" r="${r * 0.42}" fill="#1d2130"/></g>`;
  };
  const body = `
<path d="M84 232 L78 270 L112 270 L112 232Z" fill="url(#${u}-metal)"/>
<path d="M156 232 L162 270 L128 270 L128 232Z" fill="url(#${u}-metal)"/>
<rect x="70" y="264" width="48" height="16" rx="7" fill="#232838"/>
<rect x="122" y="264" width="48" height="16" rx="7" fill="#232838"/>
<path d="M76 272 h36 M128 272 h36" stroke="${c.accent}" stroke-width="2" stroke-dasharray="4 4"/>
<path d="M70 132 Q120 112 170 132 L176 218 Q120 248 64 218 Z" fill="url(#${u}-metal)"/>
<path d="M70 132 Q120 112 170 132 L176 218 Q120 248 64 218 Z" fill="none" stroke="#141826" stroke-width="3"/>
<path d="M86 210 Q120 228 154 210" stroke="url(#${u}-plate)" stroke-width="6" fill="none"/>
<circle cx="120" cy="176" r="34" fill="#141826"/>
<circle cx="120" cy="176" r="30" fill="url(#${u}-core)" class="${u}-pulse"/>
${gear(120, 176, 15)}
<path d="M64 140 C44 150 34 170 34 196 L54 202 C56 182 62 168 76 158 Z" fill="url(#${u}-metal)"/>
<rect x="18" y="196" width="46" height="34" rx="10" fill="url(#${u}-plate)"/>
<circle cx="30" cy="213" r="7" fill="#141826"/>
<circle cx="30" cy="213" r="4" fill="${c.glow}" class="${u}-pulse"/>
<path d="M176 140 C196 150 204 170 204 196 L186 202 C184 182 178 168 164 158 Z" fill="url(#${u}-metal)"/>
<path d="M180 196 h30 l6 16 -6 16 h-30 z" fill="url(#${u}-plate)"/>
<path d="M188 204 v16 M196 204 v16 M204 204 v16" stroke="#3a1a08" stroke-width="2.5"/>
${gear(64, 132, 16)}
${gear(176, 132, 16)}
<path d="M84 74 C84 50 100 36 120 36 C140 36 156 50 156 74 L156 108 Q120 124 84 108 Z" fill="url(#${u}-metal)"/>
<path d="M84 74 C84 50 100 36 120 36 C140 36 156 50 156 74" stroke="url(#${u}-plate)" stroke-width="4" fill="none"/>
<rect x="92" y="70" width="56" height="26" rx="13" fill="#0a0e1a"/>
<circle cx="120" cy="83" r="11" fill="url(#${u}-lens)" class="${u}-pulse"/>
<circle cx="116" cy="79" r="3" fill="#fff"/>
<path d="M98 104 h44" stroke="#141826" stroke-width="3"/>
<path d="M120 36 L120 20" stroke="#3a3f4f" stroke-width="4"/>
<circle cx="120" cy="16" r="6" fill="${c.glow}" class="${u}-pulse"/>
${motes(u, c.glow)}`;
  return wrap(u, body, defs, o);
}

/** Liora — Tide Sage: flowing robes with a wave hem, crescent staff, orbiting water orb. */
function liora(u: string, c: CharacterDef['palette'], o: HeroOptions): string {
  const defs = `
  <linearGradient id="${u}-robe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c.primary, 0.25)}"/><stop offset="1" stop-color="${shade(c.primary, -0.4)}"/></linearGradient>
  <linearGradient id="${u}-sash" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.accent}"/><stop offset="1" stop-color="${shade(c.accent, -0.35)}"/></linearGradient>
  <linearGradient id="${u}-hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c.secondary, 0.35)}"/><stop offset="1" stop-color="${shade(c.secondary, -0.2)}"/></linearGradient>
  <radialGradient id="${u}-orb"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".45" stop-color="${c.glow}" stop-opacity=".9"/><stop offset="1" stop-color="${c.accent}" stop-opacity=".1"/></radialGradient>
  <linearGradient id="${u}-staff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c.glow, -0.1)}"/><stop offset="1" stop-color="${shade(c.secondary, 0.1)}"/></linearGradient>`;
  const body = `
<g class="${u}-sway">
  <path d="M84 124 C70 170 60 220 50 268 Q85 276 120 270 Q155 276 190 268 C180 220 170 170 156 124 Z" fill="url(#${u}-robe)"/>
  <path d="M50 268 Q62 258 74 268 T98 268 T122 268 T146 268 T170 268 T190 268" stroke="${c.accent}" stroke-width="3" fill="none" opacity=".85"/>
  <path d="M60 248 Q72 240 84 248 T108 248 T132 248 T156 248 T180 248" stroke="${c.glow}" stroke-width="1.6" fill="none" opacity=".5"/>
</g>
<path d="M96 132 Q120 146 144 132 L140 200 Q120 210 100 200 Z" fill="${shade(c.primary, 0.12)}"/>
<path d="M92 176 Q120 190 148 176 L146 190 Q120 204 94 190 Z" fill="url(#${u}-sash)"/>
<path d="M120 186 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0" fill="${c.glow}" class="${u}-pulse"/>
<path d="M92 136 C76 150 66 168 60 186 L72 192 C78 176 88 162 100 152 Z" fill="url(#${u}-robe)"/>
<circle cx="64" cy="192" r="7" fill="${shade(c.glow, -0.25)}"/>
<g class="${u}-spin">
  <circle cx="52" cy="196" r="20" fill="none" stroke="${c.accent}" stroke-width="1.6" stroke-dasharray="3 5" opacity=".9"/>
</g>
<circle cx="52" cy="196" r="11" fill="url(#${u}-orb)" class="${u}-pulse"/>
<path d="M148 136 C164 150 172 166 176 182 L164 188 C160 174 154 162 142 152 Z" fill="url(#${u}-robe)"/>
<circle cx="170" cy="188" r="7" fill="${shade(c.glow, -0.25)}"/>
<g class="${u}-float">
  <rect x="173" y="70" width="6" height="200" rx="3" fill="url(#${u}-staff)"/>
  <path d="M176 70 C156 62 152 36 168 22 C162 40 170 54 188 56 C184 64 180 68 176 70 Z" fill="${c.accent}" stroke="${c.glow}" stroke-width="1.5"/>
  <circle cx="176" cy="54" r="7" fill="url(#${u}-orb)" class="${u}-pulse"/>
</g>
<path d="M88 112 C84 76 98 50 120 44 C142 50 156 76 152 112 C156 140 150 160 144 170 L138 120 L102 120 L96 170 C90 160 84 140 88 112 Z" fill="url(#${u}-hair)"/>
<path d="M100 92 C100 74 108 64 120 62 C132 64 140 74 140 92 C140 108 132 120 120 122 C108 120 100 108 100 92 Z" fill="${shade('#c99b7a', -0.05)}"/>
<path d="M98 80 C104 62 118 56 132 60 C124 64 114 70 108 84 Z" fill="url(#${u}-hair)"/>
<path d="M102 74 Q120 66 138 74" stroke="${c.glow}" stroke-width="2.2" fill="none"/>
<path d="M120 64 l5 7 -5 7 -5 -7z" fill="${c.accent}" class="${u}-pulse"/>
<path d="M108 94 q4 -3 8 0 M124 94 q4 -3 8 0" stroke="#1b2a3a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<path d="M114 108 Q120 112 126 108" stroke="#7a3f36" stroke-width="1.8" fill="none" stroke-linecap="round"/>
${motes(u, c.glow)}`;
  return wrap(u, body, defs, o);
}

/** Brann — Ember Cartographer: explorer's coat, goggles, scarf, a glowing map and a compass. */
function brann(u: string, c: CharacterDef['palette'], o: HeroOptions): string {
  const defs = `
  <linearGradient id="${u}-coat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c.primary, 0.2)}"/><stop offset="1" stop-color="${shade(c.primary, -0.38)}"/></linearGradient>
  <linearGradient id="${u}-scarf" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c.accent}"/><stop offset="1" stop-color="${shade(c.accent, -0.3)}"/></linearGradient>
  <linearGradient id="${u}-map" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3e2bd"/><stop offset="1" stop-color="#d2b98a"/></linearGradient>
  <radialGradient id="${u}-glow"><stop offset="0" stop-color="${c.glow}" stop-opacity=".9"/><stop offset="1" stop-color="${c.accent}" stop-opacity="0"/></radialGradient>`;
  const body = `
<path d="M86 128 C76 176 70 224 64 262 L112 264 L120 206 L128 264 L176 262 C170 224 164 176 154 128 Z" fill="url(#${u}-coat)"/>
<path d="M120 140 L120 204" stroke="${shade(c.secondary, 0.2)}" stroke-width="3"/>
<path d="M88 196 L152 196 L150 208 L90 208 Z" fill="${shade(c.secondary, 0.15)}"/>
<rect x="94" y="200" width="16" height="14" rx="3" fill="${shade(c.primary, -0.1)}" stroke="${c.accent}" stroke-width="1.4"/>
<rect x="130" y="200" width="16" height="14" rx="3" fill="${shade(c.primary, -0.1)}" stroke="${c.accent}" stroke-width="1.4"/>
<rect x="114" y="198" width="12" height="12" rx="2" fill="${c.accent}"/>
<path d="M98 262 L96 282 Q108 288 118 282 L116 262 Z" fill="${shade(c.secondary, 0.1)}"/>
<path d="M142 262 L144 282 Q132 288 122 282 L124 262 Z" fill="${shade(c.secondary, 0.05)}"/>
<g class="${u}-sway">
  <path d="M96 128 Q120 140 144 128 L140 146 Q120 156 100 146 Z" fill="url(#${u}-scarf)"/>
  <path d="M138 140 C160 146 176 158 190 176 C176 172 164 168 150 160 Z" fill="url(#${u}-scarf)" opacity=".9"/>
</g>
<path d="M90 140 C74 152 64 170 58 188 L70 194 C76 178 86 164 98 156 Z" fill="url(#${u}-coat)"/>
<g class="${u}-float">
  <g transform="translate(40 190) rotate(-12)">
    <rect x="-26" y="-20" width="52" height="40" rx="3" fill="url(#${u}-map)" stroke="#8a6a3a" stroke-width="2"/>
    <path d="M-18 8 C-8 -8 4 10 16 -6" stroke="${c.accent}" stroke-width="2.4" fill="none" stroke-dasharray="4 3"/>
    <path d="M16 -6 l4 -4 m-4 4 l4 4" stroke="#7a2e2e" stroke-width="2"/>
    <circle cx="-18" cy="8" r="3" fill="#2f6b4f"/>
  </g>
  <circle cx="40" cy="190" r="34" fill="url(#${u}-glow)" opacity=".45" class="${u}-pulse"/>
</g>
<path d="M150 140 C166 152 174 168 178 184 L166 190 C162 176 156 164 144 154 Z" fill="url(#${u}-coat)"/>
<g transform="translate(176 194)">
  <circle r="13" fill="#d9c79a" stroke="#6b4a2a" stroke-width="3"/>
  <g class="${u}-spin"><path d="M0 -9 L3 0 L0 9 L-3 0 Z" fill="${c.accent}"/></g>
  <circle r="2" fill="#2a160c"/>
</g>
<path d="M96 94 C96 70 106 56 120 54 C134 56 144 70 144 94 C144 112 134 124 120 126 C106 124 96 112 96 94 Z" fill="${shade('#b07a55', 0.02)}"/>
<path d="M92 82 C94 56 108 44 122 44 C138 44 150 56 150 80 C140 70 128 66 116 68 C106 70 98 74 92 82 Z" fill="${shade(c.secondary, 0.3)}"/>
<rect x="96" y="70" width="48" height="12" rx="6" fill="#2a160c"/>
<circle cx="108" cy="76" r="8" fill="${shade(c.glow, -0.15)}" stroke="#6b4a2a" stroke-width="2.5"/>
<circle cx="132" cy="76" r="8" fill="${shade(c.glow, -0.15)}" stroke="#6b4a2a" stroke-width="2.5"/>
<circle cx="106" cy="74" r="2.5" fill="#ffffff" opacity=".8"/>
<circle cx="130" cy="74" r="2.5" fill="#ffffff" opacity=".8"/>
<path d="M108 98 q4 -3 8 0 M124 98 q4 -3 8 0" stroke="#2a160c" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<path d="M112 112 Q120 117 128 112" stroke="#6b2e1e" stroke-width="2" fill="none" stroke-linecap="round"/>
${motes(u, c.glow)}`;
  return wrap(u, body, defs, o);
}

const BUILDERS: Record<string, (u: string, c: CharacterDef['palette'], o: HeroOptions) => string> = {
  vexa,
  kael,
  nyra,
  torque,
  liora,
  brann,
};

export function heroSvg(characterId: string, u: string, opts: HeroOptions = {}): string {
  const def = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0]!;
  const build = BUILDERS[def.id] ?? vexa;
  return build(u.replace(/[^a-zA-Z0-9]/g, ''), def.palette, opts);
}
