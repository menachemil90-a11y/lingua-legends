# Test results — 2026-11-27 (development session 2)

All commands were executed in the development container (Node 22, pnpm 10, PostgreSQL 16, Chromium via Playwright 1.63).

| Check | Command | Result |
| --- | --- | --- |
| Lint | `pnpm lint` | ✅ 0 problems |
| Type checking | `pnpm typecheck` | ✅ all 5 packages |
| Unit + integration tests | `pnpm test` | ✅ 11 files, 64 tests |
| Content validation | `pnpm content:validate` | ✅ 216 public items (A1 25, A2 24, B1 24, B2 24, C1 19, C2 14 general; 22 sentence; 32 race; 20 reading; 12 listening; 10 sets; 15 open tasks; 3 escape rooms) + 54 server-only ranked items |
| Production build | `pnpm build` | ✅ web (`apps/web/dist`) + server (`apps/server/dist/index.js`) |
| Database migrations + RLS | `pnpm db:test` | ✅ "ALL RLS TESTS PASSED"; seed of 216 public items applied |
| End-to-end (browser + real server) | `pnpm test:e2e` | ✅ 11/11 (desktop 1366 px + mobile 360 px) |

## What the automated tests cover
- **Rules/hosts** (`packages/shared/test`): damage formula, hidden answer keys in `ROUND_START`, duplicate/stale/unauthorised answers, ability charge after 3 correct, shield blocking, KO, timeout draw, disconnect forfeit, reconnect within grace, full bot match; race physics (careful player beats fast guesser), race positions, duplicate race answers; sentence grading with multiple valid orders and diagnostics; sentence duel scoring with second attempts; ranking tiers/Elo/placement; protocol validation strips client-sent `damage`.
- **English Conquest rules**: setup (capitals, income, question phase), gold + focus from correct answers, invalid actions rejected, deterministic attacks whose preview matches the result, full bot-vs-bot games always terminate with a consistent state. (Victory conditions are exercised by those full games but not asserted individually.)
- **ConquestHost** (FakeClock): question sent only to the active player without the key; answers/actions from other players rejected; correct answer → gold + focus; illegal actions rejected by the rules; question and action-phase timeouts; disconnected player skipped; leaver's islands turn neutral while the game continues; last player standing wins by forfeit; a full 2-player game with real attacks reaches a decision; protocol rejects malformed conquest intents and conquest in matchmaking queues.
- **Learning engine**: scheduler interval growth/shrink, a missed word returns in a *different* item, mastery and weak topics, no proficiency without evidence, recency avoidance, placement moves up/down; rule-based writing check (stance, reasons, concession, common errors); **mistake review** replays public items first, replaces server-only ranked items with public items sharing knowledge components, and never picks items more than one level away.
- **Content**: schema/references/duplicates/Hebrew presence/tile consistency; listening scripts; escape-room puzzles; Real Life dialogue graphs (unique ids, Hebrew feedback on every choice, a best reply on every node, every path reaches an end); every option item grades itself correctly; every sentence accepts all listed answers; enough items per bracket for each game.
- **i18n**: Hebrew has every English key with matching placeholders; numeric ranges in Hebrew are wrapped in directional isolates so they are not displayed reversed.
- **Server integration (real WebSocket clients)**: guest tokens, invalid tokens, origin allow-list, HELLO required; private room → ready → round; answer keys hidden; intruder rejected (`NOT_IN_MATCH`); replayed `msgId` and second answer rejected (`DUPLICATE`); server-computed damage; opponent's answer text not leaked; forfeit; **server-computed XP/shards/achievements stored and returned by `/api/me/wallet`, no shards for the forfeiting player**; disconnect + reconnect with snapshot; room closed when full; 3-racer Grammar Race room started by the host (`ROOM_START`); **3-player English Conquest room**: queue rejects conquest, only the active player gets the question, forged answers/illegal actions rejected, turn passes, leavers eliminated, last player wins, unranked; rematch → new private match; ranked queue → server-only ranked items, ±32 MMR, placement 1/5, leaderboard + `/api/me/ratings`; ready-check timeout cancels; friend request/accept/challenge/invite → match; block removes friendship and blocks room join; report; malformed message; rate limiting.
- **RLS (PostgreSQL)**: users cannot write ratings, wallets, achievements, match results, cosmetics or friendships; cannot forge learning events for others or as `server`; cannot read ranked items/answer keys or others' matches/events; cannot equip unowned cosmetics; anon read limits; service role can write; account deletion cascades.
- **E2E (Playwright)**: Hebrew RTL lobby and switch to English LTR; Word Battle vs bot with LTR answers and feedback; Sentence Master practice built entirely with the keyboard; **two independent browser contexts play a private online match through the authoritative server**; Escape Room puzzle solved and lock opened; Real Life list → scenario → reply with feedback (regression test); English Conquest starts vs bots with the 12-island map; **two browsers play English Conquest online** (only one gets the question, the turn passes to the other); listening lab session starts; at 360 px no element of the lobby or the Play screen sticks out of the screen (checked per element, because `body` hides horizontal overflow) and PLAY is in view. This check was verified to fail on the previous CSS.

## Manual visual QA (screenshots, desktop 1366–1440 px and Pixel 7 / 360 px)
Session 1: lobby, onboarding, Word Battle, Grammar Race, Sentence Master duel (mobile), Play, Practice, Profile, Settings, Placement, Bagrut, Adventure.
Session 2: 4-racer Grammar Race, race rooms, Escape Room (list, room, puzzles, escape dialog), English Conquest (setup, map, question, bot turns),
Debate Arena (topics, workspace, report), listening lab, post-match "Practise my mistakes" (Pixel 7), online English Conquest
(desktop host + Pixel 7 guest: setup, ready check, question, waiting view, action phase). Issues found and fixed: overlapping cars with 4 racers (scaled by lane count),
RTL "2 vs 2" attack preview jumbled (isolated with `<bdi dir="ltr">`), focus outline drawn around the SVG map, too-passive Conquest bots, a close button on question dialogs that could not be skipped
(dialogs now support `dismissible={false}`), empty Conquest log at game start (placeholder added), and a **crash when opening a Real Life scenario from the list**
(the same component instance kept the list's empty state; every route is now keyed so screens never reuse stale state).

## Systematic screen sweep (session 2)
A scripted crawl (`scratchpad`, not committed) opened 25 flows — lobby, profile, leaderboard, customize, settings, friends, play,
placement, practice, listening, adventure (+ a chapter match), Bagrut (+ a task), all 8 modes including both Detective cases,
two Escape rooms, Debate and **every Real Life scenario played to the end** — at 360 px (touch) and 1366 px, recording page errors
and elements outside the screen. Final result: no page errors and no overflow on either size. Bugs it found and fixed:
the Real Life crash, Customize unreachable on phones (now in Profile), Play screen and race progress bar wider than 360 px
(a `<select>` sized to its longest option, a grid without a shrinkable column, cars at the start line), reversed number ranges in
Hebrew ("140–60 words", "4–1" players), and English puzzle titles rendered RTL.

## Not tested (requires external services)
Supabase Auth/magic links, `SupabaseStore` against a live project (including `wallets`/`user_achievements` writes), deployed hosting,
real mobile devices (only emulated), AI/speech recognition (not implemented). Browser text-to-speech depends on the voices installed on the device.
