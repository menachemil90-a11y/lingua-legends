/** Original illustrated escape-room scenes (SVG). Hotspot positions are percentages of the scene. */
import type { EscapeRoom, EscapePuzzle } from '@lingua/content';

type Theme = EscapeRoom['theme'];

export const HOTSPOTS: Record<Theme, Partial<Record<EscapePuzzle['object'], { x: number; y: number }>>> = {
  workshop: { note: { x: 46, y: 26 }, clock: { x: 16, y: 40 }, desk: { x: 44, y: 66 }, chest: { x: 70, y: 78 }, 'door-panel': { x: 88, y: 52 } },
  observatory: { logbook: { x: 30, y: 70 }, telescope: { x: 52, y: 38 }, desk: { x: 18, y: 64 }, 'door-panel': { x: 86, y: 50 } },
  station: { map: { x: 30, y: 26 }, radio: { x: 58, y: 70 }, note: { x: 84, y: 34 }, 'door-panel': { x: 86, y: 56 } },
  archive: { bookshelf: { x: 15, y: 38 }, map: { x: 45, y: 22 }, desk: { x: 47, y: 66 }, logbook: { x: 64, y: 60 }, chest: { x: 30, y: 80 }, 'door-panel': { x: 88, y: 52 } },
};

function Workshop() {
  return (
    <g>
      <defs>
        <linearGradient id="ws-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b2414" />
          <stop offset="1" stopColor="#1f1209" />
        </linearGradient>
        <linearGradient id="ws-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a2c16" />
          <stop offset="1" stopColor="#24140a" />
        </linearGradient>
        <radialGradient id="ws-lamp" cx="50%" cy="0%" r="70%">
          <stop offset="0" stopColor="#ffd28a" stopOpacity=".55" />
          <stop offset="1" stopColor="#ffd28a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1000" height="560" fill="url(#ws-wall)" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={i * 86} y="0" width="2" height="400" fill="#000" opacity=".25" />
      ))}
      <rect y="400" width="1000" height="160" fill="url(#ws-floor)" />
      {Array.from({ length: 10 }, (_, i) => (
        <line key={i} x1={i * 110} y1="400" x2={i * 110 - 60} y2="560" stroke="#000" strokeOpacity=".25" strokeWidth="2" />
      ))}
      <ellipse cx="460" cy="0" rx="420" ry="420" fill="url(#ws-lamp)" />
      {/* Grandfather clock */}
      <rect x="110" y="110" width="110" height="300" rx="10" fill="#5a3418" stroke="#2a1508" strokeWidth="4" />
      <circle cx="165" cy="175" r="40" fill="#f3e4c4" stroke="#c99a45" strokeWidth="6" />
      <line x1="165" y1="175" x2="165" y2="148" stroke="#2a1508" strokeWidth="4" />
      <line x1="165" y1="175" x2="186" y2="185" stroke="#2a1508" strokeWidth="3" />
      <rect x="140" y="240" width="50" height="130" rx="6" fill="#2a1508" opacity=".6" />
      <circle cx="165" cy="340" r="14" fill="#c99a45" />
      {/* Shelves with gears */}
      <rect x="290" y="150" width="300" height="10" fill="#6b3f1d" />
      <rect x="290" y="240" width="300" height="10" fill="#6b3f1d" />
      {[320, 380, 450, 520].map((x, i) => (
        <circle key={x} cx={x} cy={i % 2 ? 222 : 130} r={i % 2 ? 16 : 18} fill="none" stroke="#c99a45" strokeWidth="6" strokeDasharray="6 4" />
      ))}
      {/* Note pinned */}
      <rect x="430" y="100" width="70" height="60" fill="#f7efd6" transform="rotate(-4 465 130)" />
      <circle cx="463" cy="104" r="5" fill="#c0392b" />
      {/* Workbench */}
      <rect x="320" y="330" width="260" height="22" rx="4" fill="#7a4a22" />
      <rect x="335" y="352" width="16" height="80" fill="#5a3418" />
      <rect x="550" y="352" width="16" height="80" fill="#5a3418" />
      <rect x="380" y="306" width="90" height="24" rx="3" fill="#e8dcc0" opacity=".85" />
      {/* Chest */}
      <rect x="640" y="400" width="130" height="80" rx="8" fill="#6b3f1d" stroke="#c99a45" strokeWidth="4" />
      <rect x="640" y="400" width="130" height="26" rx="8" fill="#7a4a22" stroke="#c99a45" strokeWidth="4" />
      <rect x="695" y="420" width="20" height="24" rx="3" fill="#c99a45" />
      {/* Door */}
      <rect x="820" y="140" width="140" height="270" rx="6" fill="#3b2414" stroke="#c99a45" strokeWidth="5" />
      <rect x="838" y="160" width="104" height="230" rx="4" fill="#2a1508" />
    </g>
  );
}

function Observatory() {
  return (
    <g>
      <defs>
        <radialGradient id="ob-dome" cx="50%" cy="100%" r="100%">
          <stop offset="0" stopColor="#1b2b5e" />
          <stop offset="1" stopColor="#070d24" />
        </radialGradient>
      </defs>
      <rect width="1000" height="560" fill="url(#ob-dome)" />
      <path d="M0 420 Q500 -120 1000 420 Z" fill="#0c1636" />
      <path d="M440 0 L560 0 L540 330 L460 330 Z" fill="#030716" />
      {Array.from({ length: 30 }, (_, i) => (
        <circle key={i} cx={450 + ((i * 37) % 100)} cy={10 + ((i * 53) % 300)} r={i % 5 === 0 ? 1.8 : 1} fill="#fff" opacity=".9" />
      ))}
      <path d="M470 60 q40 -10 70 30" stroke="#7ff3ff" strokeWidth="3" fill="none" opacity=".8" />
      <circle cx="540" cy="90" r="6" fill="#e0fbff" />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={`M${i * 125} 420 Q500 ${-40 + i * 4} ${1000 - i * 125} 420`} stroke="#22356e" strokeWidth="2" fill="none" opacity=".5" />
      ))}
      <rect y="420" width="1000" height="140" fill="#0a1230" />
      {/* Telescope */}
      <rect x="455" y="330" width="90" height="90" rx="8" fill="#2a3a6e" />
      <g transform="rotate(-28 500 300)">
        <rect x="430" y="270" width="230" height="56" rx="20" fill="#9fb2d6" />
        <rect x="430" y="270" width="230" height="18" rx="9" fill="#d8e2f5" opacity=".6" />
        <rect x="640" y="262" width="30" height="72" rx="8" fill="#5c6f97" />
      </g>
      {/* Desk + logbook */}
      <rect x="120" y="360" width="260" height="20" rx="4" fill="#3a4a7e" />
      <rect x="135" y="380" width="14" height="70" fill="#22305e" />
      <rect x="350" y="380" width="14" height="70" fill="#22305e" />
      <rect x="250" y="336" width="80" height="24" rx="3" fill="#b26bff" />
      <rect x="150" y="320" width="60" height="40" rx="4" fill="#0a1636" stroke="#38e1ff" strokeWidth="2" />
      {/* Door */}
      <rect x="800" y="160" width="160" height="260" rx="10" fill="#1a2858" stroke="#38e1ff" strokeWidth="4" />
      <line x1="880" y1="170" x2="880" y2="410" stroke="#38e1ff" strokeWidth="2" opacity=".6" />
    </g>
  );
}

function Station() {
  return (
    <g>
      <rect width="1000" height="560" fill="#1b2340" />
      <rect y="0" width="1000" height="70" fill="#121831" />
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={60 + i * 160} y="18" width="90" height="34" rx="6" fill="#f5c451" opacity=".18" />
      ))}
      <rect y="410" width="1000" height="150" fill="#2a2f45" />
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x={i * 76} y="410" width="72" height="150" fill="none" stroke="#1b2340" strokeWidth="4" />
      ))}
      {/* Timetable board */}
      <rect x="150" y="90" width="320" height="170" rx="10" fill="#0a0f1f" stroke="#f5c451" strokeWidth="4" />
      {[120, 160, 200, 236].map((y, i) => (
        <g key={y}>
          <rect x="175" y={y} width="120" height="18" rx="3" fill={i === 0 ? '#f5c451' : '#38e1ff'} opacity={i === 0 ? 0.9 : 0.55} />
          <rect x="310" y={y} width="140" height="18" rx="3" fill="#38e1ff" opacity=".35" />
        </g>
      ))}
      {/* Bench + radio */}
      <rect x="470" y="370" width="260" height="18" rx="6" fill="#6b4a2a" />
      <rect x="480" y="388" width="12" height="40" fill="#3a2a18" />
      <rect x="708" y="388" width="12" height="40" fill="#3a2a18" />
      <rect x="560" y="330" width="80" height="40" rx="8" fill="#3a3f4f" stroke="#ff8a3d" strokeWidth="3" />
      <circle cx="580" cy="350" r="10" fill="#1d2130" stroke="#ff8a3d" strokeWidth="2" />
      <line x1="625" y1="330" x2="650" y2="290" stroke="#9aa3b5" strokeWidth="3" />
      {/* Emergency door */}
      <rect x="790" y="150" width="170" height="260" rx="6" fill="#4a5578" stroke="#36e0b0" strokeWidth="5" />
      <rect x="805" y="270" width="140" height="14" rx="7" fill="#c8d3ea" />
      <rect x="815" y="170" width="120" height="44" rx="6" fill="#0d7a5e" />
      <path d="M840 192 h40 m-12 -10 l12 10 -12 10" stroke="#fff" strokeWidth="4" fill="none" />
    </g>
  );
}

/** University archive after hours: tall shelves, a reading desk with a green lamp, a framed map. */
function Archive() {
  const spines = ['#7a2e2e', '#2e4f7a', '#6b5a2a', '#2f6b4f', '#5a2e6b', '#7a4a2e', '#3a5a6b'];
  return (
    <g>
      <defs>
        <linearGradient id="ar-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f2a3a" />
          <stop offset="1" stopColor="#121925" />
        </linearGradient>
        <radialGradient id="ar-lamp" cx="50%" cy="0%" r="80%">
          <stop offset="0" stopColor="#b7ffcf" stopOpacity=".45" />
          <stop offset="1" stopColor="#b7ffcf" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ar-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a3a22" />
          <stop offset="1" stopColor="#2e1d10" />
        </linearGradient>
      </defs>
      <rect width="1000" height="560" fill="url(#ar-wall)" />
      <rect y="420" width="1000" height="140" fill="#1a1410" />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={i * 130} y="420" width="126" height="140" fill="none" stroke="#2a2018" strokeWidth="3" />
      ))}
      {/* Tall bookshelf */}
      <rect x="40" y="70" width="230" height="350" rx="6" fill="url(#ar-wood)" stroke="#120c06" strokeWidth="4" />
      {[95, 175, 255, 335].map((y, row) => (
        <g key={y}>
          <rect x="52" y={y + 62} width="206" height="8" fill="#120c06" />
          {Array.from({ length: 11 }, (_, i) => (
            <rect key={i} x={56 + i * 18.5} y={y + (i % 3) * 4} width="15" height={62 - (i % 3) * 4} rx="2" fill={spines[(i + row * 2) % spines.length]} opacity=".9" />
          ))}
        </g>
      ))}
      {/* Framed map */}
      <rect x="360" y="60" width="210" height="140" rx="6" fill="#d9c79a" stroke="#6b4a2a" strokeWidth="8" />
      <path d="M380 150 C420 100 460 170 500 120 S550 90 555 130" stroke="#7a2e2e" strokeWidth="3" fill="none" strokeDasharray="8 6" />
      <circle cx="470" cy="140" r="7" fill="#7a2e2e" />
      {/* Reading desk with green lamp */}
      <ellipse cx="470" cy="300" rx="190" ry="120" fill="url(#ar-lamp)" />
      <rect x="320" y="330" width="320" height="22" rx="6" fill="url(#ar-wood)" />
      <rect x="340" y="352" width="16" height="70" fill="#2e1d10" />
      <rect x="604" y="352" width="16" height="70" fill="#2e1d10" />
      <ellipse cx="420" cy="328" rx="26" ry="6" fill="#c8a24a" />
      <rect x="416" y="282" width="8" height="46" fill="#c8a24a" />
      <path d="M380 284 Q420 246 460 284 Z" fill="#1f6b4f" stroke="#0d3a2a" strokeWidth="3" />
      <ellipse cx="420" cy="284" rx="40" ry="5" fill="#b7ffcf" opacity=".7" />
      <rect x="480" y="306" width="90" height="24" rx="3" fill="#efe6cf" stroke="#9a8a62" strokeWidth="2" />
      {/* Catalogue cabinet (locked drawer) */}
      <rect x="230" y="440" width="140" height="90" rx="6" fill="url(#ar-wood)" stroke="#120c06" strokeWidth="3" />
      {[452, 486].map((y) => (
        <g key={y}>
          <rect x="242" y={y} width="116" height="26" rx="3" fill="#3a2614" stroke="#120c06" strokeWidth="2" />
          <rect x="290" y={y + 10} width="20" height="6" rx="3" fill="#c8a24a" />
        </g>
      ))}
      {/* Door with keypad */}
      <rect x="800" y="140" width="160" height="280" rx="6" fill="#2a3448" stroke="#38e1ff" strokeWidth="5" />
      <rect x="900" y="250" width="40" height="56" rx="4" fill="#0a0f1f" stroke="#38e1ff" strokeWidth="2" />
      {[0, 1, 2].map((r) => [0, 1].map((c) => <circle key={`${r}${c}`} cx={912 + c * 16} cy={264 + r * 14} r="4" fill="#38e1ff" opacity=".7" />))}
    </g>
  );
}

export function RoomScene({ theme }: { theme: Theme }) {
  return (
    <svg viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid slice" className="room-scene__art" aria-hidden="true">
      {theme === 'workshop' ? <Workshop /> : theme === 'observatory' ? <Observatory /> : theme === 'archive' ? <Archive /> : <Station />}
    </svg>
  );
}
