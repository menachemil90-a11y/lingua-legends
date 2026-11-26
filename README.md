# Lingua Legends

A competitive, premium-feeling English-learning game for teenagers and adults — Hebrew and English UI,
CEFR A1–C2, Israeli 5-unit Bagrut preparation, and real authoritative multiplayer.

> Working title; branding lives in `apps/web/src/i18n` and `apps/web/src/art`. Independent project —
> **not** an official Ministry of Education product. Proficiency levels are estimates, not certifications.

## What works today

| Feature | Status |
| --- | --- |
| **Word Battle** — 1v1 arena (Phaser): HP, damage with modest speed bonus, 3-combo abilities (Shield / Surge / Focus), KO/timeout/draw rules | ✅ vs labelled bots offline, ✅ online (private rooms, casual & ranked queues) |
| **Grammar Race** — animated hover-racing (Phaser): boosts, turbo streaks, stalls, finish line, positions | ✅ offline vs bots, ✅ online (2–4 racers supported by the host) |
| **Sentence Master** — tile building with drag & drop, tap, and full keyboard control; multiple valid answers; structural feedback | ✅ untimed practice, ✅ duel vs bot, ✅ online duel |
| Lobby, onboarding, mode picker, profile, settings, customization, leaderboards, friends | ✅ |
| Shared learning engine — spaced repetition, mastery per knowledge component, Elo-style skill estimates, adaptive selection, placement test | ✅ |
| Post-match screen — result, accuracy, XP, rank change, mistakes with English/Hebrew explanations | ✅ |
| Bagrut Academy — Module E/F/G, COBE speaking practice (timers + TTS listening), project planner, timed mock exams | ✅ (exam structure = unverified draft, see `docs/BAGRUT.md`) |
| Adventure map — 5 regions, chapters, bosses, stars | ✅ |
| Real Life (scripted conversations), English Detective (one case) | ✅ preview |
| Escape Room, English Conquest, Debate Arena | ⛔ planned (shown as "in development") |
| Authoritative WebSocket server — auth, rooms, queues, ready check, reconnection, rematch, Elo ranking, friends, block/report, rate limits, replay protection | ✅ locally (not deployed) |
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
| `pnpm content:validate` | Validates the public content bank and the server-only ranked pool |
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
sent before a round ends. Ranked matches draw questions from a server-only pool that is not in the client bundle.
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
- Content volume is a prototype minimum (180 public + 54 ranked items) and must grow before release.

## Licenses

All art (SVG characters, vehicles, emblems, backgrounds), music and sound effects are original and generated in code.
Fonts: Rubik and Cinzel via Fontsource (SIL Open Font License 1.1). Libraries: see `pnpm-lock.yaml` (MIT/Apache/ISC).
