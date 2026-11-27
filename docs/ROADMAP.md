# Roadmap

Status as of development session 2 (2026-11-27).

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
- [x] Server-side XP/shards/achievement persistence for online matches (`MemoryStore` tested; `SupabaseStore` → `wallets`/`user_achievements`, not verified online) + `GET /api/me/wallet`
- [x] Private Grammar Race rooms for up to 4 racers (`ROOM_START` lets the host start with 2+)

## Phase 4 — Bagrut Academy (starter ✅)
- [x] Module E, F, G, COBE, project planner, timed mock exams (original material)
- [ ] Verify structure against the official booklet (HANDOFF.md §7)
- [ ] Expand passages, literature units and mock exams; teacher review

## Phase 5 — Game universe expansion
- [x] Adventure map (5 regions, chapters, bosses, stars)
- [x] English Detective — three cases (A2, B1, B2), shuffled options, learning events + progress
- [ ] More Detective cases + co-op investigations
- [x] Escape Room — solo, relaxed or timed, 3 rooms
- [x] Escape Room co-op online — `EscapeCoopHost`, 2–4 players, shared locks/hints/attempts, team timer (1.5× the solo time), brute-force limit
- [x] English Conquest vs 1–3 bots (original 12-island map, 4 factions, pure tested rules)
- [x] English Conquest online — authoritative `ConquestHost`, private rooms for 2–4 players, turn timers, absent-player skips, leavers' islands turn neutral
- [ ] 2v2 / 4-player online modes using the existing multi-player host abstraction

## Phase 6 — Advanced learning
- [x] Real Life — eight scripted text scenarios (airport A2, hotel A2, shop return A2, restaurant B1, support call B1, job interview B2, university office hours B2, tech stand-up C1)
- [ ] More scenarios (business meeting, medical appointment, travel problems) and teacher review of all dialogue
- [x] Debate Arena private practice with a rule-based writing check (4 topics)
- [ ] Debate Arena AI evaluation (only after approval + moderation)
- [x] Listening lab with on-device text-to-speech (12 items)
- [x] Post-match “Practise my mistakes” sessions
- [ ] Speech services (consent, no default storage) and pronunciation feedback
- [ ] Expanded C1/C2 curriculum

## Ongoing
- [x] Ranked pool expanded from 54 to 120 server-only items, with a test that it never overlaps the public bank
- [ ] Teacher review of all content (`reviewStatus`), grow the bank substantially (quality over quantity)
- [x] Tournaments: offline Champion's Cup vs bots; friends' knockout brackets online (3–8 players)
- [ ] Public scheduled tournaments, seasons rollover tooling
- [ ] Android packaging (TWA/Capacitor) from the PWA
- [ ] Analytics for `docs/METRICS.md` (privacy-preserving, opt-in where required)
