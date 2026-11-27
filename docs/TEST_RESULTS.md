# Test results — 2026-11-27 (development session 2)

All commands were executed in the development container (Node 22, pnpm 10, PostgreSQL 16, Chromium via Playwright 1.63).

| Check | Command | Result |
| --- | --- | --- |
| Lint | `pnpm lint` | ✅ 0 problems |
| Type checking | `pnpm typecheck` | ✅ all 5 packages |
| Unit + integration tests | `pnpm test` | ✅ 10 files, 54 tests |
| Content validation | `pnpm content:validate` | ✅ 216 public items (A1 25, A2 24, B1 24, B2 24, C1 19, C2 14 general; 22 sentence; 32 race; 20 reading; 12 listening; 10 sets; 15 open tasks; 3 escape rooms) + 54 server-only ranked items |
| Production build | `pnpm build` | ✅ web (`apps/web/dist`) + server (`apps/server/dist/index.js`) |
| Database migrations + RLS | `pnpm db:test` | ✅ "ALL RLS TESTS PASSED"; seed of 216 public items applied |
| End-to-end (browser + real server) | `pnpm test:e2e` | ✅ 9/9 (desktop + Pixel 7 mobile) |

## What the automated tests cover
- **Rules/hosts** (`packages/shared/test`): damage formula, hidden answer keys in `ROUND_START`, duplicate/stale/unauthorised answers, ability charge after 3 correct, shield blocking, KO, timeout draw, disconnect forfeit, reconnect within grace, full bot match; race physics (careful player beats fast guesser), race positions, duplicate race answers; sentence grading with multiple valid orders and diagnostics; sentence duel scoring with second attempts; ranking tiers/Elo/placement; protocol validation strips client-sent `damage`.
- **English Conquest rules**: setup (capitals, income, question phase), gold + focus from correct answers, invalid actions rejected, deterministic attacks whose preview matches the result, full bot-vs-bot games always terminate with a consistent state. (Victory conditions are exercised by those full games but not asserted individually.)
- **Learning engine**: scheduler interval growth/shrink, a missed word returns in a *different* item, mastery and weak topics, no proficiency without evidence, recency avoidance, placement moves up/down; rule-based writing check (stance, reasons, concession, common errors); **mistake review** replays public items first, replaces server-only ranked items with public items sharing knowledge components, and never picks items more than one level away.
- **Content**: schema/references/duplicates/Hebrew presence/tile consistency; listening scripts; escape-room puzzles; every option item grades itself correctly; every sentence accepts all listed answers; enough items per bracket for each game.
- **i18n**: Hebrew has every English key with matching placeholders.
- **Server integration (real WebSocket clients)**: guest tokens, invalid tokens, origin allow-list, HELLO required; private room → ready → round; answer keys hidden; intruder rejected (`NOT_IN_MATCH`); replayed `msgId` and second answer rejected (`DUPLICATE`); server-computed damage; opponent's answer text not leaked; forfeit; **server-computed XP/shards/achievements stored and returned by `/api/me/wallet`, no shards for the forfeiting player**; disconnect + reconnect with snapshot; room closed when full; 3-racer Grammar Race room started by the host (`ROOM_START`); rematch → new private match; ranked queue → server-only ranked items, ±32 MMR, placement 1/5, leaderboard + `/api/me/ratings`; ready-check timeout cancels; friend request/accept/challenge/invite → match; block removes friendship and blocks room join; report; malformed message; rate limiting.
- **RLS (PostgreSQL)**: users cannot write ratings, wallets, achievements, match results, cosmetics or friendships; cannot forge learning events for others or as `server`; cannot read ranked items/answer keys or others' matches/events; cannot equip unowned cosmetics; anon read limits; service role can write; account deletion cascades.
- **E2E (Playwright)**: Hebrew RTL lobby and switch to English LTR; Word Battle vs bot with LTR answers and feedback; Sentence Master practice built entirely with the keyboard; **two independent browser contexts play a private online match through the authoritative server**; Escape Room puzzle solved and lock opened; English Conquest starts vs bots with the 12-island map; listening lab session starts; mobile lobby has no horizontal overflow and PLAY is in view.

## Manual visual QA (screenshots, desktop 1366–1440 px and Pixel 7 / 360 px)
Session 1: lobby, onboarding, Word Battle, Grammar Race, Sentence Master duel (mobile), Play, Practice, Profile, Settings, Placement, Bagrut, Adventure.
Session 2: 4-racer Grammar Race, race rooms, Escape Room (list, room, puzzles, escape dialog), English Conquest (setup, map, question, bot turns),
Debate Arena (topics, workspace, report), listening lab. Issues found and fixed: overlapping cars with 4 racers (scaled by lane count),
RTL "2 vs 2" attack preview jumbled (isolated with `<bdi dir="ltr">`), focus outline drawn around the SVG map, too-passive Conquest bots.

## Not tested (requires external services)
Supabase Auth/magic links, `SupabaseStore` against a live project (including `wallets`/`user_achievements` writes), deployed hosting,
real mobile devices (only emulated), AI/speech recognition (not implemented). Browser text-to-speech depends on the voices installed on the device.
