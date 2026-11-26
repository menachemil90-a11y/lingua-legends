# Test results — 2026-11-26 (development session 1)

All commands were executed in the development container (Node 22, pnpm 10, PostgreSQL 16, Chromium via Playwright 1.63).

| Check | Command | Result |
| --- | --- | --- |
| Lint | `pnpm lint` | ✅ 0 problems |
| Type checking | `pnpm typecheck` | ✅ all 5 packages |
| Unit + integration tests | `pnpm test` | ✅ 7 files, 42 tests |
| Content validation | `pnpm content:validate` | ✅ 180 public items (A1 21, A2 20, B1 20, B2 20, C1 15, C2 10 general; 22 sentence; 32 race; 20 reading; 10 sets; 15 open tasks) + 54 server-only ranked items |
| Production build | `pnpm build` | ✅ web (`apps/web/dist`) + server (`apps/server/dist/index.js`, starts and serves `/health`) |
| Database migrations + RLS | `pnpm db:test` | ✅ "ALL RLS TESTS PASSED"; seed of 180 public items applied |
| End-to-end (browser + real server) | `pnpm test:e2e` | ✅ 6/6 (desktop + Pixel 7 mobile) |

## What the automated tests cover
- **Rules/hosts** (`packages/shared/test`): damage formula, hidden answer keys in `ROUND_START`, duplicate/stale/unauthorised answers, ability charge after 3 correct, shield blocking, KO, timeout draw, disconnect forfeit, reconnect within grace, full bot match; race physics (careful player beats fast guesser), race positions, duplicate race answers; sentence grading with multiple valid orders and diagnostics; sentence duel scoring with second attempts; ranking tiers/Elo/placement; protocol validation strips client-sent `damage`.
- **Learning engine**: scheduler interval growth/shrink, a missed word returns in a *different* item, mastery and weak topics, no proficiency without evidence, recency avoidance, placement moves up/down.
- **Content**: schema/references/duplicates/Hebrew presence/tile consistency; every option item grades itself correctly; every sentence accepts all listed answers; enough items per bracket for each game.
- **i18n**: Hebrew has every English key with matching placeholders.
- **Server integration (real WebSocket clients)**: guest tokens, invalid tokens, origin allow-list, HELLO required; private room → ready → round; answer keys hidden; intruder rejected (`NOT_IN_MATCH`); replayed `msgId` and second answer rejected (`DUPLICATE`); server-computed damage; opponent's answer text not leaked; forfeit; disconnect + reconnect with snapshot; room closed when full; rematch → new private match; ranked queue → server-only ranked items, ±32 MMR, placement 1/5, leaderboard + `/api/me/ratings`; ready-check timeout cancels; friend request/accept/challenge/invite → match; block removes friendship and blocks room join; report; malformed message; rate limiting.
- **RLS (PostgreSQL)**: users cannot write ratings, wallets, achievements, match results, cosmetics or friendships; cannot forge learning events for others or as `server`; cannot read ranked items/answer keys or others' matches/events; cannot equip unowned cosmetics; anon read limits; service role can write; account deletion cascades.
- **E2E (Playwright)**: Hebrew RTL lobby and switch to English LTR; Word Battle vs bot with LTR answers and feedback; Sentence Master practice built entirely with the keyboard; **two independent browser contexts play a private online match through the authoritative server** (same server question, both get feedback, no bot); mobile lobby has no horizontal overflow and PLAY is in view.

## Manual visual QA (screenshots, desktop 1366–1440 px and Pixel 7)
Lobby, onboarding, Word Battle (intro, round, reveal, abilities, full match to post-match), Grammar Race, Sentence Master duel (mobile),
Play, Practice, Profile, Settings, Placement, Bagrut hub + task, Adventure. Issues found and fixed during QA: HUD sides swapped in RTL,
answer grid flowing right-to-left in Hebrew, arena canvas off-centre, PLAY clipped at 900 px height, avatar crop, mobile tile ordering,
StrictMode disposing the match transport (dev only), unstable zustand selector causing a render loop on Bagrut tasks,
clipped task buttons, double-mirrored adventure map in RTL, overflowing long nicknames.

## Not tested (requires external services)
Supabase Auth/magic links, `SupabaseStore` against a live project, deployed hosting, real mobile devices (only emulated), AI/speech (not implemented).
