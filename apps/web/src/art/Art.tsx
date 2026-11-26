import { memo, useId, useMemo } from 'react';
import type { RankTier } from '@lingua/shared';
import { heroSvg } from './characters';
import { vehicleSvg } from './vehicles';
import { emblemSvg } from './emblems';

/** Renders trusted, code-generated SVG markup inline (never user input). */
function InlineSvg({ svg, className, label, style }: { svg: string; className?: string; label?: string; style?: React.CSSProperties }) {
  return (
    <span
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ display: 'inline-block', lineHeight: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: svg.replace('<svg ', '<svg style="width:100%;height:auto;display:block" ') }}
    />
  );
}

function useUid(prefix: string): string {
  return prefix + useId().replace(/[^a-zA-Z0-9]/g, '');
}

export const Hero = memo(function Hero({
  id,
  animated = false,
  flip = false,
  className,
  label,
  style,
}: {
  id: string;
  animated?: boolean;
  flip?: boolean;
  className?: string;
  label?: string;
  style?: React.CSSProperties;
}) {
  const u = useUid('h');
  const svg = useMemo(() => heroSvg(id, u, { animated, flip }), [id, u, animated, flip]);
  return <InlineSvg svg={svg} className={className} {...(label ? { label } : {})} {...(style ? { style } : {})} />;
});

export const Vehicle = memo(function Vehicle({ id, className, style }: { id: string; className?: string; style?: React.CSSProperties }) {
  const u = useUid('v');
  const svg = useMemo(() => vehicleSvg(id, u), [id, u]);
  return <InlineSvg svg={svg} {...(className ? { className } : {})} {...(style ? { style } : {})} />;
});

export const RankEmblem = memo(function RankEmblem({
  tier,
  division,
  size = 64,
  label,
}: {
  tier: RankTier;
  division: 1 | 2 | 3 | null;
  size?: number;
  label?: string;
}) {
  const u = useUid('e');
  const svg = useMemo(() => emblemSvg(tier, division, u), [tier, division, u]);
  return <InlineSvg svg={svg} style={{ width: size }} {...(label ? { label } : {})} />;
});

/** Game logo. Text uses the bundled Cinzel display font. */
export function Logo({ compact = false }: { compact?: boolean }) {
  const u = useUid('logo');
  return (
    <svg
      viewBox={compact ? '0 0 64 64' : '0 0 360 120'}
      role="img"
      aria-label="Lingua Legends"
      style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`${u}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6d0" />
          <stop offset=".45" stopColor="#f5c451" />
          <stop offset="1" stopColor="#a86c12" />
        </linearGradient>
        <linearGradient id={`${u}-c`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7ff3ff" />
          <stop offset="1" stopColor="#8b4dff" />
        </linearGradient>
        <filter id={`${u}-glow`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      {compact ? (
        <g>
          <path d="M32 4 L58 14 L56 36 C54 50 44 58 32 62 C20 58 10 50 8 36 L6 14 Z" fill={`url(#${u}-g)`} stroke="#6c4508" strokeWidth="2" />
          <path d="M22 18 L22 44 L34 44 M32 18 L32 40 L44 40" stroke="#1a1030" strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <ellipse cx="180" cy="74" rx="150" ry="26" fill={`url(#${u}-c)`} opacity=".35" filter={`url(#${u}-glow)`} />
          <text x="180" y="34" textAnchor="middle" fontFamily="Cinzel, serif" fontWeight="700" fontSize="24" letterSpacing="14" fill="#7ff3ff">
            LINGUA
          </text>
          <text x="182" y="94" textAnchor="middle" fontFamily="Cinzel, serif" fontWeight="900" fontSize="60" letterSpacing="4" fill="#5a3a06">
            LEGENDS
          </text>
          <text x="180" y="91" textAnchor="middle" fontFamily="Cinzel, serif" fontWeight="900" fontSize="60" letterSpacing="4" fill={`url(#${u}-g)`} stroke="#fff3c8" strokeWidth=".8">
            LEGENDS
          </text>
          <path d="M40 106 L150 106 L180 116 L210 106 L320 106" stroke={`url(#${u}-g)`} strokeWidth="2.5" fill="none" />
          <path d="M180 100 l6 6 -6 6 -6 -6z" fill="#7ff3ff" />
        </g>
      )}
    </svg>
  );
}
