/** Original icon set: 24×24 grid, 2px strokes with selective fills. */
import type { SVGProps } from 'react';

const P: Record<string, string> = {
  play: 'M8 5.5v13l10-6.5z',
  trophy: 'M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v4M8 20h8M9.5 17h5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 19c1.2-3 3.6-4.5 6.5-4.5s5.3 1.5 6.5 4.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5c1.7.6 2.9 2 3.5 4.5',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.6a7 7 0 0 1-2 1.2L14.7 21h-4l-.4-2.3a7 7 0 0 1-2-1.2l-1.9.6-2-3.4 1.6-1.2a7 7 0 0 1 0-2.4L4.4 9.9l2-3.4 1.9.6a7 7 0 0 1 2-1.2L10.7 3h4l.4 2.3a7 7 0 0 1 2 1.2l1.9-.6 2 3.4-1.6 1.2a7 7 0 0 1 0 2.4z',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  book: 'M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2zM4 20a2 2 0 0 0 2 2h13v-4M8 7h7M8 10.5h5',
  sword: 'M14.5 4H20v5.5L10 19.5 4.5 14zM7 17l-3 3M5.5 12.5l6 6',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z',
  bolt: 'M13 2L5 13.5h6L10 22l8-11.5h-6z',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  crown: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5zM5 19h14',
  lock: 'M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 15v2.5',
  check: 'M4.5 12.5l5 5 10-11',
  x: 'M6 6l12 12M18 6L6 18',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.5 2',
  back: 'M15 5l-7 7 7 7',
  forward: 'M9 5l7 7-7 7',
  refresh: 'M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4',
  home: 'M3.5 11L12 4l8.5 7M6 9.5V20h4.5v-5h3v5H18V9.5',
  share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 3.9M15.4 6.6l-6.8 3.9',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  volume: 'M4 9.5h4l5-4v13l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  mute: 'M4 9.5h4l5-4v13l-5-4H4zM17 9.5l5 5M22 9.5l-5 5',
  flag: 'M5 21V4M5 4h12l-2.5 4L17 12H5',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  brain: 'M9 4.5A3 3 0 0 0 4.5 7a3 3 0 0 0-1 5 3.5 3.5 0 0 0 3 5.5A3 3 0 0 0 12 19V5.5A3 3 0 0 0 9 4.5zM15 4.5A3 3 0 0 1 19.5 7a3 3 0 0 1 1 5 3.5 3.5 0 0 1-3 5.5A3 3 0 0 1 12 19',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 12h.01',
  car: 'M3 15.5l2-5.5c.4-1 1.3-1.5 2.3-1.5h8.6c1 0 1.9.5 2.3 1.5l2 5.5v3h-2.5M5.5 18.5H3v-3M8 18.5h8M6.5 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM3 13.5h18',
  puzzle: 'M5 8h3a2 2 0 1 1 4 0h3v3a2 2 0 1 1 0 4v3h-3a2 2 0 1 0-4 0H5v-3a2 2 0 1 0 0-4z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6',
  pen: 'M4 20l1-4.5L16 4.5 19.5 8 8.5 19zM14 7l3 3',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  gem: 'M7 4h10l4 5-9 11L3 9zM3 9h18M9.5 4L8 9l4 11 4-11-1.5-5',
  search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM16 16l5 5',
  door: 'M6 21V4h12v17M3 21h18M14.5 12.5h.01',
  castle: 'M4 21V9h3V6h2v3h2V6h2v3h2V6h2v3h3v12h-6v-5a2 2 0 0 0-4 0v5z',
  chat: 'M4 5h16v11H9l-5 4z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01',
  alert: 'M12 3.5L22 20H2zM12 10v4.5M12 17.5h.01',
  plus: 'M12 5v14M5 12h14',
  link: 'M10 14a4 4 0 0 0 5.7 0l3.3-3.3a4 4 0 0 0-5.7-5.7L12 6.3M14 10a4 4 0 0 0-5.7 0L5 13.3A4 4 0 0 0 10.7 19L12 17.7',
  wifiOff: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4.5-2.4M19 12.5a10 10 0 0 0-2.3-1.6M2 8.5a15 15 0 0 1 5-3M22 8.5A15 15 0 0 0 11 4.6M12 20h.01',
  ear: 'M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0M10 9a2 2 0 0 1 4 0',
  scroll: 'M7 4h11a2 2 0 0 1 0 4h-1v11a2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h1zM7 17V4M10 9h5M10 12.5h5',
  hourglass: 'M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9',
  dice: 'M4 4h16v16H4zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  // Scene icons (Real Life places, Detective cases, Debate motions).
  plane: 'M21 15.5l-8-4.5V5.5a1.5 1.5 0 0 0-3 0V11l-8 4.5V17l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-4.5l8 2.5z',
  bed: 'M3 18V5M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5M7 12.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
  cup: 'M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 9.5h1.5a2.5 2.5 0 0 1 0 5H16M8 2.5v3M11.5 2.5v3M4 21h14',
  cutlery: 'M7 3v7a2 2 0 0 0 2 2v9M11 3v7a2 2 0 0 1-2 2M9 3v6M17 21V3c-2 1.5-3 4-3 7v3h3',
  bag: 'M5 8h14l-1 13H6zM9 8V6.5a3 3 0 0 1 6 0V8',
  phone: 'M7 2.5h10v19H7zM10.5 18.5h3',
  cap: 'M2 9l10-4.5L22 9l-10 4.5zM6 11v5c1.5 1.5 3.5 2.2 6 2.2s4.5-.7 6-2.2v-5M22 9v6',
  laptop: 'M5 5h14v10H5zM2.5 19h19l-1.5-4H4z',
  flask: 'M9 3h6M10 3v6l-5 9.5A2 2 0 0 0 6.8 21h10.4a2 2 0 0 0 1.8-2.5L14 9V3M7.5 15h9',
  cake: 'M4 21h16M5 21v-7h14v7M5 17c2 1.5 4-1.5 7 0s5-1.5 7 0M12 14v-3M12 8.5a1 1 0 0 0 0-2.5c-.8 1-.8 1.8 0 2.5z',
  shirt: 'M8 3l-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z',
  paw: 'M12 21c-3 0-5-1.6-5-3.6S9.4 13 12 13s5 2.4 5 4.4-2 3.6-5 3.6zM5.5 13.5a1.8 2.2 0 1 1 0-4.4 1.8 2.2 0 0 1 0 4.4zM18.5 13.5a1.8 2.2 0 1 1 0-4.4 1.8 2.2 0 0 1 0 4.4zM9 9a1.8 2.2 0 1 1 0-4.4A1.8 2.2 0 0 1 9 9zM15 9a1.8 2.2 0 1 1 0-4.4A1.8 2.2 0 0 1 15 9z',
  rocket: 'M12 2.5c3 2 4.5 5.5 4.5 9.5l-2 4h-5l-2-4c0-4 1.5-7.5 4.5-9.5zM9.5 16L7 18.5V21l3-1.5M14.5 16l2.5 2.5V21l-3-1.5M12 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
  ballot: 'M4 12h16v9H4zM8 12V4h8v8M10 8l1.5 1.5L14.5 6',
};

const FILLED = new Set(['play', 'bolt', 'star', 'heart', 'shield', 'gem', 'crown']);

export type IconName = keyof typeof P;

export function Icon({ name, filled, ...rest }: { name: IconName; filled?: boolean } & SVGProps<SVGSVGElement>) {
  const fill = filled ?? FILLED.has(name);
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      focusable="false"
      fill={fill ? 'currentColor' : 'none'}
      fillOpacity={fill ? 0.22 : undefined}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d={P[name]} />
    </svg>
  );
}

/** Shard currency icon (multi-colour). */
export function ShardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="shard-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9fbff" />
          <stop offset=".5" stopColor="#38e1ff" />
          <stop offset="1" stopColor="#5a2bd6" />
        </linearGradient>
      </defs>
      <path d="M12 1.5l6 7.5-6 13.5L6 9z" fill="url(#shard-g)" stroke="#e9fdff" strokeWidth="1" />
      <path d="M12 1.5L9.2 9H14.8z" fill="#fff" opacity=".55" />
    </svg>
  );
}
