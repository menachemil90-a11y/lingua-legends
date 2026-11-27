# Architecture

## Stack and why
- **React 19 + Vite + TypeScript** (`apps/web`): a static SPA/PWA — no SSR needed, deploys to any free static host,
  simple Phaser integration. (Chosen over Next.js: no server rendering requirement, simpler hosting, smaller surface.)
- **Phaser 3.90** for the Word Battle arena and Grammar Race track, lazy-loaded only when a match starts.
- **Custom authoritative server on `ws` + `zod`** (`apps/server`) instead of Colyseus: the event contracts in the
  brief are explicit, so a thin, fully-typed gateway keeps every rule in shared, unit-tested code and runs on any Node host.
  The `MatchHost` abstraction could be wrapped in Colyseus rooms later if needed.
- **Supabase** (Auth, Postgres, RLS) for registered accounts and durable data — optional; the game runs without it.
- **zustand** for client state, persisted to `localStorage` through a never-throwing wrapper.

## Packages
| Package | Responsibility |
| --- | --- |
| `@lingua/shared` | CEFR model, `ContentItem` schema, deterministic grading, protocol (zod), rules, match hosts, bots, ranking, progression |
| `@lingua/learning` | Learning events, spaced repetition, mastery, skill estimates, adaptive selection, placement |
| `@lingua/content` | Public content bank, passages, Bagrut material, sets, adventure, story content, validator |
| `@lingua/web` | UI, art, audio, i18n, Phaser scenes, transports, local persistence |
| `@lingua/server` | HTTP API, WebSocket gateway, matchmaking, rooms, matches, friends, stores, ranked pool |

## One rules engine, two transports
```
            ┌──────────── packages/shared/src/hosts ───────────┐
            │ WordBattleHost · GrammarRaceHost · SentenceDuelHost │  (pure rules, injected Clock)
            └───────────────┬───────────────────────┬──────────┘
         offline (browser)  │                       │  online (server)
     createLocalMatch + BotController      MatchManager (ready check, ratings, persistence)
                    │                               │ ws
                    └──── MatchTransport ◄──────────┘ createOnlineMatch
                                   │
                         useMatch reducer → game screens
```
The UI consumes the same `ServerMessage` stream in both cases, so offline play exercises the real rules.

## Server authority
- Client → server: `HELLO, QUEUE_JOIN, QUEUE_LEAVE, ROOM_CREATE, ROOM_JOIN, ROOM_LEAVE, READY, ANSWER_SUBMIT, ABILITY_USE, REMATCH_REQUEST, MATCH_LEAVE, QUICK_CHAT, PING, FRIEND_*, INVITE_RESPOND, BLOCK, UNBLOCK, REPORT`.
- Server → client: `WELCOME, QUEUE_STATE, ROOM_STATE, MATCH_FOUND, READY_STATE, MATCH_START, ROUND_START, ANSWER_LOCKED, ATTEMPT_RESULT, ANSWER_RESULT, COMBAT_EVENT, PLAYER_STATE, MATCH_END, MATCH_CANCELLED, REMATCH_STATE, QUICK_CHAT, FRIENDS_STATE, INVITE, PONG, NOTICE, ERROR`.
- Every message is schema-validated (unknown fields stripped, 4 KB limit). Each carries a unique `msgId`; repeated ids are rejected (idempotency + replay protection). One answer per player per round; stale rounds rejected; membership checked on every match action.
- Time: deadlines and response times are measured on the server; clients estimate the offset via `PING/PONG` only for display.
- Answer keys: `ROUND_START` carries a `PublicQuestion` with freshly shuffled option ids; the correct answer and explanation arrive in `ANSWER_RESULT` after the round closes. Ranked rounds use a server-only pool. The repository is public, so production loads it privately (`RANKED_POOL_FILE` or Supabase rows with `is_ranked_only`, hidden by RLS) through `apps/server/src/content/rankedPool.ts`; the committed `devRankedSample.ts` is public and used only in development/tests. Without a private pool in production the ranked queue is disabled.
- Limits: token bucket per socket (30 burst, 12/s), quick chat 3 burst / 0.5 s⁻¹, per-IP connection cap, per-IP guest-token creation limit, HTTP limiter, origin allow-list for HTTP and WebSocket.
- Reconnection: the same token re-binds the player; the server re-sends `MATCH_FOUND`, `READY_STATE` and a host snapshot (`MATCH_START`, `PLAYER_STATE`, current `ROUND_START`). A newer session replaces an older one (`SESSION_REPLACED`). After a 30 s grace the absent player forfeits.
- Ratings, XP and rewards are computed in `MatchManager.finish` and persisted through the `ServerStore` interface.

## Identity
Guests receive a server-signed HS256 JWT with a random server-generated id (`g_…`), stored by the client. Registered
users sign in with Supabase (magic link) and send their Supabase access token; the server verifies it via the project JWKS
or the legacy JWT secret (`apps/server/src/auth.ts`).

## Persistence
`ServerStore` has two implementations: `MemoryStore` (dev; JSON snapshot in `DATA_DIR`) and `SupabaseStore`
(service-role key, server only). Client progress is local (`localStorage`); registered users can push learning
events to `learning_events` (RLS: own rows, `source='client'` only).

## Database (Supabase)
`supabase/migrations/20261126000000_initial_schema.sql` creates: profiles, player_accounts, skill_nodes, content_items,
content_versions, learning_events, skill_profiles, mastery, review_queue, seasons, rank_profiles, matches, match_players,
friend_requests, friends, blocked_users, reports, achievements, user_achievements, cosmetics, user_cosmetics, wallets,
account_deletion_requests — with indexes, FKs, check constraints, RLS on all tables, explicit `revoke` of client writes on
server-managed tables, and secure functions `equip_cosmetic`, `request_account_deletion`, `process_account_deletion` (admin only).
`pnpm db:test` verifies the policies on a local PostgreSQL with a Supabase-like `auth` stub.

## AI and speech provider interfaces (planned, not connected)
```ts
interface WritingEvaluationProvider { evaluate(input: { prompt: string; text: string; level: CefrLevel }): Promise<{ advisory: true; criteria: Record<string, string>; suggestions: string[] }> }
interface SpeakingEvaluationProvider { evaluate(audioRef: string, prompt: string): Promise<{ advisory: true; notes: string[] }> }
interface SpeechTranscriptionProvider { transcribe(audioRef: string, lang: 'en'): Promise<string> }
interface TextToSpeechProvider { speak(text: string, voice?: string): Promise<void> }   // browser speechSynthesis implementation in use
interface ConversationProvider { reply(history: { role: 'npc' | 'player'; text: string }[], scenarioId: string): Promise<string> }
```
They must run server-side with budgets, rate limits, moderation and consent; outputs are advisory, never grades.

## Client structure
`apps/web/src`: `design/` (components), `styles/` (tokens/base/components/screens/games), `art/` (SVG generators),
`audio/` (Web Audio synth), `i18n/` (en/he), `state/` (settings, player, nav), `net/` (connection, api, transports),
`data/` (Supabase), `games/` (screens + shared match UI), `phaser/` (scenes), `screens/`.
The service worker caches only same-origin static assets and the app shell; API/WS/authenticated responses are never cached.

## Scaling notes
One Node process handles matchmaking and matches in memory. To scale horizontally: sticky sessions per player,
a shared queue (Redis or Postgres) and match ownership per process. Not needed for the prototype.

## Mobile performance
- Only the lobby is in the initial bundle; every other screen is a lazy chunk (`React.lazy` + `Suspense` in `App.tsx`).
  Initial JavaScript went from 674 kB (205 kB gzip) to 273 kB (86 kB gzip) plus React (60 kB gzip). Phaser (332 kB gzip)
  loads only when a Word Battle / Grammar Race scene starts.
- When the browser is idle, the most likely next screens (Play, match, practice) are prefetched; ~8 s later every other
  chunk (including Phaser) is fetched once so the service worker caches it — skipped when the user enabled *Save data*.
  Verified: after the warm-up, Escape Room and a Word Battle match open with the network switched off.

