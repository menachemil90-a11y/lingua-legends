# Lingua Legends

A competitive, premium-feeling English-learning game for teenagers and adults — Hebrew and English UI,
CEFR A1–C2, Israeli 5-unit Bagrut preparation, and real authoritative multiplayer.

> Working title; branding lives in `apps/web/src/i18n` and `apps/web/src/art`. Independent project —
> **not** an official Ministry of Education product. Proficiency levels are estimates, not certifications.

## What works today

| Feature | Status |
| --- | --- |
| **Word Battle** — 1v1 arena (Phaser): HP, damage with modest speed bonus, 3-combo abilities (Shield / Surge / Focus), four pre-match **tactics** balanced by simulation, KO/timeout/draw rules | ✅ vs labelled bots offline, ✅ online (private rooms, casual & ranked queues) |
| **Grammar Race** — animated hover-racing (Phaser): boosts, turbo streaks, stalls, finish line, positions | ✅ offline vs 1–3 labelled bots (2–4 racers), ✅ online 1v1 queues + private rooms for up to 4 racers (host can start with 2+) |
| **Sentence Master** — tile building with drag & drop, tap, and full keyboard control; multiple valid answers; structural feedback | ✅ untimed practice, ✅ duel vs bot, ✅ online duel |
| Lobby, onboarding, mode picker, profile (with the Learning Journey: milestones from real mastery, no streaks), settings, customization (frames, titles, characters, vehicles, arenas, effects), leaderboards, friends | ✅ |
| Shared learning engine — spaced repetition, mastery per knowledge component, Elo-style skill estimates, adaptive selection, placement test | ✅ |
| Post-match screen — result, accuracy, XP, rank change, mistakes with English/Hebrew explanations, **“Practise my mistakes”** session (exact public items, or similar public items for server-only ranked questions) | ✅ |
| Bagrut Academy — Module E/F/G, COBE speaking practice (timers + TTS listening), project planner, timed mock exams | ✅ (exam structure = unverified draft, see `docs/BAGRUT.md`) |
| Adventure map — 5 regions, chapters, bosses, stars | ✅ |
| **Escape Room** — 4 original illustrated rooms (A2/B1/B2/C1), choice/text/order puzzles, hints, relaxed or timed | ✅ solo, ✅ online co-op for 2–4 friends (server checks every answer; unranked) |
| **English Conquest** — 12-island strategy map, 4 factions, answer questions for gold, recruit/fortify/attack/move | ✅ vs 1–3 labelled bots, ✅ online private rooms for 2–4 friends (authoritative server host, unranked) |
| **Debate Arena** — 10 motions B1–C2; opening → the other side's prepared argument → rebuttal → their prepared closing → your closing; transparent 8-point checklist (not a grade, not AI), key vocabulary with Hebrew, debate history | ✅ private practice (AI feedback ⛔ needs approval; live debates between players are intentionally not offered — no free text between players) |
| Listening lab — 12 listening items using free on-device browser text-to-speech; transcript hidden until answered | ✅ (falls back to reading when TTS is unavailable, and is then not counted as listening evidence) |
| **Real Life** — 8 branching text conversations A2–C1 (airport, hotel, shop return, restaurant, support call, job interview, university office hours, tech stand-up) | ✅ text mode (speech recognition not enabled) |
| **English Detective** — 4 cases (A2, B1, B2, C1): read evidence, answer shuffled questions, name who is responsible | ✅ |
| **Tournaments** — offline Champion's Cup (3 knockout rounds vs labelled bots of rising strength) and friends' knockouts online (3–8 players, byes, automatic rounds, explainable tie-breaks, walkovers, server rewards) | ✅ cup offline, ✅ online locally (unranked) |
| Authoritative WebSocket server — auth, rooms, queues, ready check, reconnection, rematch, Elo ranking, friends, block/report, rate limits, replay protection, **server-computed XP/shards/achievements persisted per player** (`/api/me/wallet`) | ✅ locally (not deployed) |
| Supabase schema + RLS | ✅ tested on local PostgreSQL; 🟡 not yet applied to a real project |
| Registered accounts / cloud sync / AI / speech | 🟡 / ⛔ — see `HANDOFF.md` |

## Quick start

Requirements: Node 20.19+ (22 recommended) and pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm dev            # web on http://localhost:5173 + multiplayer server on http://localhost:2567
# or separately:
pnpm dev:web
pnpm dev:server
```

Open <http://localhost:5173>. Everything offline works without the server; online modes need `pnpm dev:server`.
To try multiplayer locally, open the game in two different browsers (or one normal + one private window),
create a private room in one and open the invite link in the other.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm lint` | ESLint (TypeScript + React hooks rules; blocks client imports of server-only code) |
| `pnpm typecheck` | `tsc` in every package |
| `pnpm test` | Vitest: rules/hosts, learning engine, content, i18n, server integration tests with real WebSocket clients |
| `pnpm test:e2e` | Playwright: real browser + real server, including two independent browsers playing online |
| `pnpm content:validate` | Validates the public content bank and the public ranked development sample |
| `pnpm ranked:validate <file>` / `ranked:export-sql` | Validate a PRIVATE ranked pool / export it for Supabase (never commit it — see HANDOFF §11) |
| `pnpm content:export` | Regenerates `supabase/seed.sql` (public items only) |
| `pnpm db:test` | Applies migrations to a throw-away local PostgreSQL and runs the RLS test suite |
| `pnpm build` | Production builds (`apps/web/dist`, `apps/server/dist`) |
| `pnpm check` | lint + typecheck + test + content validation + build |

## Repository layout

```
apps/web          React 19 + Vite client, Phaser scenes, PWA (manifest + service worker)
apps/server       Authoritative multiplayer server (ws + zod), HTTP API, stores, ranked pool
packages/shared   Protocol contracts, content schema, grading, game rules, match hosts, bots, ranking
packages/learning Spaced repetition, mastery, skill estimates, adaptive selection, placement
packages/content  Original content bank, reading passages, Bagrut material, sets, adventure map, validator
supabase          SQL migrations, seed, local RLS tests
docs              Design, architecture, learning engine, Bagrut, roadmap, metrics
```

## Architecture in one paragraph

All game rules live in `packages/shared` as *hosts* (`WordBattleHost`, `GrammarRaceHost`, `SentenceDuelHost`).
The same host code runs **on the server** for online matches and **in the browser** for offline bot practice,
behind one `MatchTransport` interface, so the UI only ever renders server-style events. Clients send intents
(`ANSWER_SUBMIT`, `ABILITY_USE`…); hosts decide correctness, damage, scores and winners, and answer keys are never
sent before a round ends. Ranked matches draw questions from a server-only pool that is never in the client bundle; because this
repository is public, production loads that pool from a private file or Supabase (HANDOFF §11) and refuses ranked play without one.
Details: `docs/ARCHITECTURE.md`.

## Deployment

Free-tier-friendly: static frontend (Cloudflare Pages / Netlify / Vercel / GitHub Pages) + a Node host with
WebSockets (Render / Koyeb / any VPS) + Supabase Free. Exact steps and environment variables: **`HANDOFF.md`**.

## Current limitations

- Online play is verified locally only; nothing is deployed yet.
- With the default `STORE=memory`, online data (ratings, friends) lives in the server process (+ a dev JSON snapshot).
- The exam structure in Bagrut Academy is a configurable draft pending verification against the official booklet.
- All content is original but AI-drafted (`reviewStatus: 'ai-drafted'`) and must be reviewed by a teacher.
- No AI writing feedback, no speech recognition (clearly labelled in the UI).
- Content volume is still small (228 public items; a 120-item public ranked *development sample*; a 99-item private ranked pool delivered outside the repository) and must grow before release.
- Online English Conquest and co-op Escape Room are private-room only and unranked.
- Offline (vs bot) rewards are stored on the device only; only online-match rewards are server-verified.

## Licenses

All art (SVG characters, vehicles, emblems, backgrounds), music and sound effects are original and generated in code.
Fonts: Rubik and Cinzel via Fontsource (SIL Open Font License 1.1). Libraries: see `pnpm-lock.yaml` (MIT/Apache/ISC).
