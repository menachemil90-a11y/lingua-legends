# Roadmap

Status as of the first development session (2026-11-26).

## Phase 1 — Core foundation ✅
- [x] pnpm monorepo, strict TypeScript, ESLint, Vitest, Playwright
- [x] Original visual identity + design system (tokens, components, SVG art, icons, logo)
- [x] Main lobby (animated hero, PLAY, modes, rank, English estimate, momentum, bottom nav on mobile)
- [x] Hebrew (RTL) / English (LTR) localization with parity test; English content always LTR
- [x] Player profile, settings (audio, motion, contrast, visual cues, explanation language, immersion, data export/delete)
- [x] Optional adaptive placement test
- [x] Shared learning engine + local persistence

## Phase 2 — Playable games ✅
- [x] Word Battle (arena, abilities, KO/timeout/draw, bots)
- [x] Grammar Race (animated track, boosts, turbo, stalls, finish, bots)
- [x] Sentence Master (drag/tap/keyboard, multiple answers, practice + duel)
- [x] Post-match feedback, mistakes review, XP, achievements
- [x] Mastery tracking and spaced review across modes

## Phase 3 — Online infrastructure (local ✅, online 🟡)
- [x] Authoritative WebSocket server, contracts, validation, idempotency, rate limits
- [x] Guest auth; Supabase JWT verification (awaiting project)
- [x] Private rooms, codes, invite links, ready check, matchmaking (ranked/casual), rematch, reconnection
- [x] Elo ranking per mode × bracket × season, placement matches, leaderboards
- [x] Friends, friend codes, challenges, block, report, quick-chat
- [x] Supabase migrations + RLS (tested locally)
- [ ] Deploy server + frontend; connect Supabase; verify `SupabaseStore` online (HANDOFF.md)
- [ ] Cloud sync of mastery/review state for registered users (learning events already supported)
- [ ] Server-side XP/currency/achievement persistence in `wallets`/`user_achievements` for registered players

## Phase 4 — Bagrut Academy (starter ✅)
- [x] Module E, F, G, COBE, project planner, timed mock exams (original material)
- [ ] Verify structure against the official booklet (HANDOFF.md §7)
- [ ] Expand passages, literature units and mock exams; teacher review

## Phase 5 — Game universe expansion
- [x] Adventure map (5 regions, chapters, bosses, stars)
- [x] English Detective — first case (preview)
- [ ] More Detective cases + co-op investigations
- [ ] Escape Room (solo, co-op, timed)
- [ ] English Conquest (2–4 player strategy; original map and factions)
- [ ] 2v2 / 4-player online modes using the existing multi-player host abstraction

## Phase 6 — Advanced learning
- [x] Real Life — two scripted text scenarios (airport A2, job interview B2)
- [ ] More scenarios (hotel, restaurant, university, customer service, business meeting, shopping, tech workplace, travel)
- [ ] Debate Arena (private practice first; AI evaluation only after approval + moderation)
- [ ] Speech services (consent, no default storage) and pronunciation feedback
- [ ] Expanded C1/C2 curriculum

## Ongoing
- [ ] Teacher review of all content (`reviewStatus`), grow the bank substantially (quality over quantity)
- [ ] Tournaments, seasons rollover tooling
- [ ] Android packaging (TWA/Capacitor) from the PWA
- [ ] Analytics for `docs/METRICS.md` (privacy-preserving, opt-in where required)
