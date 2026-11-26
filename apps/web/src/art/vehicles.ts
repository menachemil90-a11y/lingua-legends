/** Original hover-racer art (side view, facing right). */
import { VEHICLES, type VehicleDef } from '@lingua/shared';
import { shade } from './color';

export const VEHICLE_VIEWBOX = { w: 260, h: 110 };

const BODIES: Record<string, { body: string; canopy: string; fin: string; skirt: string }> = {
  comet: {
    body: 'M18 62 C22 46 46 38 80 36 L150 32 C182 30 214 40 242 58 C246 63 243 69 236 70 L30 76 C21 76 15 70 18 62 Z',
    canopy: 'M104 35 C120 18 160 16 186 33 L184 40 L106 42 Z',
    fin: 'M22 48 L10 24 L36 28 L48 44 Z',
    skirt: 'M30 72 L236 66 L226 82 L42 85 Z',
  },
  viper: {
    body: 'M16 60 C22 46 50 40 86 38 L160 30 C196 30 226 44 250 60 C252 64 248 68 240 68 L28 76 C19 76 13 68 16 60 Z',
    canopy: 'M116 34 C134 18 168 18 190 32 L188 38 L118 40 Z',
    fin: 'M20 46 L4 16 L26 22 L44 42 Z M40 44 L30 22 L50 28 L58 42 Z',
    skirt: 'M28 72 L242 64 L230 80 L40 84 Z',
  },
  aurum: {
    body: 'M20 64 C22 44 52 34 90 32 L156 30 C190 30 222 42 238 60 C242 66 238 72 230 72 L32 78 C22 78 18 72 20 64 Z',
    canopy: 'M98 32 C114 14 156 12 180 30 L178 38 L100 40 Z',
    fin: 'M24 48 L16 30 L40 32 L50 46 Z',
    skirt: 'M32 74 L232 68 L222 86 L44 88 Z',
  },
  ember: {
    body: 'M16 64 C18 44 44 34 76 34 L148 34 C184 34 214 42 236 56 C244 62 242 70 232 72 L28 78 C18 78 14 72 16 64 Z',
    canopy: 'M100 34 C114 20 148 18 172 32 L170 40 L102 42 Z',
    fin: 'M18 50 L6 30 L34 34 L44 48 Z',
    skirt: 'M26 74 L232 68 L224 86 L38 88 Z',
  },
};

export function vehicleSvg(vehicleId: string, u: string): string {
  const v: VehicleDef = VEHICLES.find((x) => x.id === vehicleId) ?? VEHICLES[0]!;
  const b = BODIES[v.id] ?? BODIES.comet!;
  const id = u.replace(/[^a-zA-Z0-9]/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VEHICLE_VIEWBOX.w} ${VEHICLE_VIEWBOX.h}" width="${VEHICLE_VIEWBOX.w}" height="${VEHICLE_VIEWBOX.h}">
<defs>
  <linearGradient id="${id}-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(v.body, 0.45)}"/><stop offset=".45" stop-color="${v.body}"/><stop offset="1" stop-color="${shade(v.body, -0.45)}"/></linearGradient>
  <linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bff7ff"/><stop offset=".35" stop-color="#2a5fa8"/><stop offset="1" stop-color="#07122e"/></linearGradient>
  <radialGradient id="${id}-glow"><stop offset="0" stop-color="${v.flame}" stop-opacity=".9"/><stop offset="1" stop-color="${v.flame}" stop-opacity="0"/></radialGradient>
  <filter id="${id}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
</defs>
<ellipse cx="130" cy="96" rx="104" ry="9" fill="${v.flame}" opacity=".55" filter="url(#${id}-blur)"/>
<ellipse cx="72" cy="88" rx="22" ry="5" fill="url(#${id}-glow)"/>
<ellipse cx="190" cy="86" rx="22" ry="5" fill="url(#${id}-glow)"/>
<path d="${b.fin}" fill="${shade(v.body, -0.2)}" stroke="${shade(v.body, 0.5)}" stroke-width="1.2"/>
<path d="${b.skirt}" fill="${v.trim}"/>
<path d="${b.body}" fill="url(#${id}-body)"/>
<path d="${b.body}" fill="none" stroke="${shade(v.body, 0.6)}" stroke-width="1.5" opacity=".7"/>
<path d="M40 52 C90 42 160 40 228 54" stroke="#fff" stroke-width="3" fill="none" opacity=".55"/>
<path d="M60 66 L220 62" stroke="${v.trim}" stroke-width="5" opacity=".7"/>
<path d="M62 66 L218 62" stroke="${v.flame}" stroke-width="2" opacity=".9"/>
<path d="${b.canopy}" fill="url(#${id}-glass)" stroke="${shade(v.body, 0.6)}" stroke-width="1.5"/>
<path d="M118 34 C130 26 146 24 160 26" stroke="#fff" stroke-width="2.5" fill="none" opacity=".8"/>
<rect x="8" y="54" width="16" height="16" rx="5" fill="#0a1020" stroke="${shade(v.body, 0.4)}" stroke-width="1.5"/>
<circle cx="16" cy="62" r="5" fill="${v.flame}"/>
<path d="M228 58 l10 4 -10 3z" fill="#fff8d0"/>
</svg>`;
}

/** Thruster flame (points left), animated by scaling in the scene. */
export function flameSvg(color: string, u: string): string {
  const id = u.replace(/[^a-zA-Z0-9]/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 60" width="140" height="60">
<defs>
  <linearGradient id="${id}-f1" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="${color}" stop-opacity="1"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>
  <linearGradient id="${id}-f2" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <filter id="${id}-b"><feGaussianBlur stdDeviation="3"/></filter>
</defs>
<path d="M140 30 C110 8 50 10 0 30 C50 50 110 52 140 30 Z" fill="url(#${id}-f1)" filter="url(#${id}-b)"/>
<path d="M140 30 C118 18 80 20 40 30 C80 40 118 42 140 30 Z" fill="url(#${id}-f2)"/>
</svg>`;
}
