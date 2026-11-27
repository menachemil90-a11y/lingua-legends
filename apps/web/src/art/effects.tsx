/**
 * Victory effects (cosmetic, earned in play — never sold). Purely decorative SVG behind the
 * result banner. Animations stop automatically with reduced motion (global CSS rule).
 */
export function VictoryEffect({ id, preview }: { id: string; preview?: boolean }) {
  const cls = `vfx ${preview ? 'vfx--preview' : ''}`;
  if (id === 'fx-aurora') {
    return (
      <svg className={`${cls} vfx--aurora`} viewBox="0 0 600 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true" data-testid="victory-effect">
        <defs>
          <linearGradient id="vfx-au-1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--c-good)" stopOpacity="0" />
            <stop offset=".5" stopColor="var(--c-good)" stopOpacity=".75" />
            <stop offset="1" stopColor="var(--c-cyan)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="vfx-au-2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--c-purple-2)" stopOpacity="0" />
            <stop offset=".5" stopColor="var(--c-purple-2)" stopOpacity=".6" />
            <stop offset="1" stopColor="var(--c-cyan-2)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="vfx__ribbon" d="M-40 150 C80 60 200 200 320 110 S520 40 640 120" stroke="url(#vfx-au-1)" strokeWidth="38" fill="none" strokeLinecap="round" />
        <path className="vfx__ribbon vfx__ribbon--2" d="M-40 90 C100 160 220 30 340 120 S540 180 640 70" stroke="url(#vfx-au-2)" strokeWidth="26" fill="none" strokeLinecap="round" />
        <path className="vfx__ribbon vfx__ribbon--3" d="M-40 190 C120 130 260 230 380 160 S560 110 640 170" stroke="url(#vfx-au-1)" strokeWidth="16" fill="none" strokeLinecap="round" opacity=".6" />
      </svg>
    );
  }
  // Default: Starburst — rays and sparks bursting from the centre.
  return (
    <svg className={`${cls} vfx--starburst`} viewBox="-150 -120 300 240" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-testid="victory-effect">
      <g className="vfx__rays">
        {Array.from({ length: 16 }, (_, i) => (
          <path key={i} d="M0 -26 L5 -118 L0 -124 L-5 -118 Z" fill={i % 2 ? 'var(--c-gold-2)' : 'var(--c-gold)'} opacity={i % 2 ? 0.45 : 0.75} transform={`rotate(${i * 22.5})`} />
        ))}
      </g>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return <circle key={i} className="vfx__spark" style={{ ['--i' as string]: i }} cx={Math.cos(a) * 90} cy={Math.sin(a) * 70} r={i % 3 === 0 ? 4 : 2.5} fill="var(--c-cyan-2)" />;
      })}
    </svg>
  );
}
