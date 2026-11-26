# Design system

Source of truth: `apps/web/src/styles/tokens.css` (tokens), `apps/web/src/design/index.tsx` (components),
`apps/web/src/styles/components.css` (component styles). Screens and games compose these — never hard-code values.

## Identity
Premium stylised fantasy-esports: deep navy universe, electric cyan energy, purple arcane magic, gold accents.
Display font **Cinzel** (logo, titles, big numbers); UI font **Rubik** (Hebrew + Latin). Original SVG heroes, vehicles,
rank emblems and icon set (`apps/web/src/art`).

## Tokens
| Group | Tokens |
| --- | --- |
| Surfaces | `--c-bg-0…3`, `--c-panel`, `--c-panel-strong`, `--c-line`, `--c-line-strong` |
| Accents | `--c-cyan(-2,-deep)`, `--c-purple(-2,-deep)`, `--c-gold(-2,-deep)` |
| Text | `--c-text`, `--c-text-dim`, `--c-text-mute`, `--c-text-on-gold` |
| Feedback | `--c-good`, `--c-bad`, `--c-warn` — always paired with an icon/shape |
| Gradients | `--g-gold`, `--g-cyan`, `--g-purple`, `--g-panel`, `--g-sky` |
| Type | `--font-ui`, `--font-display`, `--fs-xs … --fs-3xl`, weights |
| Space | `--s-1 … --s-12` (4 px grid), `--gutter` 16 px (24 px ≥ 720 px) |
| Radius | `--r-sm 8`, `--r-md 12`, `--r-lg 18`, `--r-xl 26`, `--r-pill` |
| Elevation | `--sh-1`, `--sh-2`, `--sh-glow-cyan`, `--sh-glow-gold`, `--sh-inset` |
| Motion | `--t-fast 120ms`, `--t-med 220ms`, `--t-slow 420ms`, `--ease-out`, `--ease-snap` |
| Layout | `--tap-min 48px`, `--page-max 1180px` |
High-contrast mode overrides panel/line/text tokens (`:root[data-contrast='high']`).

## Components
`Button` (primary gold, secondary cyan, arcane purple, ghost, danger; sm/lg; icon; `.btn--wrap`), giant `.btn-play`,
answer buttons (`.answer` with key badge; selected / correct ✓ / wrong ✗ + diagonal stripes / dim),
`Panel` (+gold, flush), `.tile` cards with art slot, `Chip` (gold/purple/good/bad/bot), `BotBadge`,
`ProgressBar`, `HealthBar` (lag bar, mid/low states), `TimerRing`, `Currency`, `Loading`/spinner, `StateMessage`
(empty/error states), `Dialog` (focus + Escape), `Toggle`, `Segmented`, `En`/`He` direction wrappers, `Stat`, toasts,
result banner (VICTORY/DEFEAT/DRAW). Game chrome: player tags, match clock, combo pips, abilities, countdown, VS intro,
visual sound cues, tile board, post-match panels.

## Rules
- Buttons: ≥ 48 px tall, readable in every state (disabled = desaturated, never invisible text).
- English learning content is always LTR (`<En>`, `.answer-grid`, tiles) even inside the RTL Hebrew UI.
- Game HUDs are LTR so "you" is always on the left, matching the arena.
- Feedback never relies on colour alone: ✓/✗ icons, stripes for wrong, text labels.
- Motion is short and never blocks input; `reducedMotion` and the OS setting disable decorative animation.
- Mobile first: works from 360 px, no horizontal overflow (e2e test), bottom navigation under 980 px.
- Each game may have its own environment (Skyforge arena, neon sky-highway, Sentence Citadel) but must use the shared components.
