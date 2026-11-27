# HANDOFF — External services and exact setup steps

This file lists every external service Lingua Legends needs, what already works without it,
and the exact steps for the project owner (or another assistant such as ChatGPT) to connect it.
**No secret values belong in this file.** Put secrets only in the hosting provider's secret
settings or in a local `.env` that is never committed.

## Status legend

| Status | Meaning |
| --- | --- |
| ✅ Working locally | Implemented and tested in this repository without any external account |
| 🟡 Awaiting configuration | Code is written; it needs an account/credentials to run online. Not yet verified online |
| ⛔ Not implemented | Planned only |

## Current status at a glance

| Area | Status | Notes |
| --- | --- | --- |
| Offline game (Word Battle, Grammar Race with up to 3 bots, Sentence Master, Escape Room, English Conquest vs bots, English Detective, Real Life text conversations, Debate practice, listening lab, learning engine, Bagrut Academy, adventure) | ✅ | Runs fully in the browser; progress saved on the device. Bots are always labelled |
| Authoritative multiplayer server (rooms incl. 4-racer race rooms and 2–4 player English Conquest and co-op Escape Room rooms, queues, ranked MMR, friends, reconnection) | ✅ locally | Tested with integration tests + two real browsers. Not deployed |
| Friends' tournaments (online, 3–8 players) | ✅ locally | Server brackets, automatic rounds, walkovers, server rewards. Requires the new migration `20261127000000_tournament_achievement.sql` on Supabase (`supabase db push` applies it) |
| Cosmetics shown online | ✅ locally | Hero/vehicle allow-list comes from the shared catalog; titles/frames are shown to others only when the server can verify them |
| Server-computed rewards for online matches (XP, shards, match achievements; `GET /api/me/wallet`) | ✅ locally / 🟡 Supabase | Tested with the memory store. With `STORE=supabase` they are written to `wallets` and `user_achievements` (service role) — not yet verified against a live project |
| Database schema + RLS (`supabase/migrations`) | ✅ locally | Applied and tested on local PostgreSQL 16 with a Supabase-like auth stub. Not applied to a real Supabase project |
| Supabase Auth (registered accounts, magic-link email) | 🟡 | Client + server token verification implemented, never exercised against a live project |
| Server persistence in Supabase (`STORE=supabase`) | 🟡 | `apps/server/src/store/supabaseStore.ts` written against the migration; not verified online |
| Cloud sync of learning events | 🟡 | `apps/web/src/data/supabase.ts` (`pushLearningEvents`) |
| Frontend hosting | 🟡 | Static build in `apps/web/dist` |
| Multiplayer hosting | 🟡 | `apps/server` builds to `dist/index.js` (Node 20+) |
| AI writing feedback / conversation | ⛔ | Provider interfaces documented in `docs/ARCHITECTURE.md`; UI clearly says "not available" |
| Speech recognition / pronunciation | ⛔ | Not faked; COBE uses a timer + self-check. Browser text-to-speech (free, on-device) is used for listening tasks |
| Private ranked question pool | 🟡 | **Required before real ranked play.** The repository is public, so the committed pool is a public development sample. Production must load a private pool (section 11). Without it, the ranked queue is disabled automatically |
| Bagrut exam structure verification | 🟡 | The official 2025 booklet could not be downloaded from the development environment (host blocked). See section 7 |

---

## 1. Supabase (database, authentication, RLS)

1. **Why:** registered accounts, cloud progress across devices, durable ratings/match history/friends.
2. **Free option:** yes, the Supabase Free plan.
3. **Free-plan limits (verify on supabase.com/pricing, they change):** small database and storage quotas, limited monthly active users, and **projects pause after about a week of inactivity**. Enough for a prototype and a class pilot.
4. **Billing required:** no, for the Free plan. Do **not** enable add-ons or the Pro plan without the owner's approval.
5. **Dashboard actions:**
   1. Create a project at <https://supabase.com/dashboard> (region close to Israel, e.g. Frankfurt/`eu-central-1`).
   2. Save the database password in a password manager (never in the repository).
   3. **Authentication → Providers → Email:** enable *Email* with *Magic Link*. Keep "Confirm email" on.
   4. **Authentication → URL Configuration:** set *Site URL* to the production frontend URL and add `http://localhost:5173` to *Redirect URLs*.
   5. **Project Settings → API:** copy the *Project URL*, the *anon/publishable* key and the *service_role/secret* key.
   6. **Project Settings → JWT Keys:** note whether the project uses the new asymmetric signing keys (JWKS — preferred, nothing to copy) or the legacy JWT secret (copy it into `SUPABASE_JWT_SECRET` on the server only).
6. **Permissions needed:** project Owner or Admin (to run migrations and read API keys).
7. **Environment variables:**
   - Web (public, safe in the browser): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - Multiplayer server (secret, server only): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional `SUPABASE_JWT_SECRET`, and `STORE=supabase`
8. **SQL / commands** (from the repository root):
   ```bash
   # Option A — Supabase CLI (recommended)
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push              # applies supabase/migrations/*.sql
   pnpm content:export               # regenerates supabase/seed.sql (public items only)
   psql "<connection string from the dashboard>" -f supabase/seed.sql
   # Option B — Dashboard SQL editor: paste supabase/migrations/20261126000000_initial_schema.sql,
   # run it, then paste and run supabase/seed.sql.
   ```
9. **Configuration notes:**
   - Never put the service_role key in any `VITE_*` variable or in frontend hosting settings.
   - The ranked question pool is intentionally **not** in the seed; it stays inside the server bundle.
10. **Verification:**
    - Dashboard → Table Editor: every table shows "RLS enabled".
    - Locally, before pushing: `pnpm db:test` must print `ALL RLS TESTS PASSED`.
    - After deploying the web app with the two `VITE_` variables: Settings → Account shows an email field; signing in sends a magic link; after sign-in, play a practice session and confirm rows appear in `learning_events` for that user only.
    - Run `select * from rank_profiles` as an authenticated user from the browser console → inserts/updates must fail.
    - With the server on `STORE=supabase`, finish one online match: rows must appear in `wallets` (xp/shards) and, for the winner, `user_achievements` (`first-victory`); `GET /api/me/wallet` with that player's token must return the same numbers. A browser `update wallets ...` as an authenticated user must fail.
11. **What the owner/ChatGPT must do:** steps 5.1–5.6, run step 8, then put the variables into the hosting providers (sections 2 and 3).
12. **What Claude Code must do afterwards:** run the server with `STORE=supabase` against the project, verify `supabaseStore.ts` end-to-end (guest + registered matches, leaderboards, friends), add the missing registered-player profile creation trigger if needed, and update this file's status table to "Connected and verified online".

## 2. Multiplayer server hosting (Node + WebSockets)

1. **Why:** online matches must be decided by an authoritative server (answers, damage, winners, ratings).
2. **Free options (check current terms before choosing):**
   - **Render** free web service — supports WebSockets; sleeps after inactivity (first connection after sleep takes ~30–60 s).
   - **Koyeb** free instance — small, always-on tier (availability varies by region).
   - **Fly.io** — no longer has a general free tier; requires a card.
   - Any small VPS (e.g. Oracle Cloud Always Free) — free but more setup.
3. **Limits:** free instances are small (≈0.1–0.5 vCPU, 256–512 MB); fine for a few hundred concurrent players of this server. Sleeping instances break "instant" matchmaking.
4. **Billing:** none on Render/Koyeb free tiers. Do not upgrade without approval.
5. **Steps (Render example):**
   1. New → Web Service → connect the GitHub repository.
   2. Root directory: repository root. Runtime: Node 20+.
   3. Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @lingua/server build`
   4. Start command: `node apps/server/dist/index.js`
   5. Health check path: `/health`.
6. **Permissions:** access to the GitHub repository (read) and the hosting account.
7. **Environment variables:** `NODE_ENV=production`, `PORT` (often injected by the host), `SERVER_SECRET` (random, ≥ 32 characters — generate with `openssl rand -hex 32`), `ALLOWED_ORIGINS` (comma-separated, e.g. `https://lingua-legends.pages.dev`), optional `STORE=supabase` + `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (+ `SUPABASE_JWT_SECRET` for legacy keys). Leave `MAX_CONNECTIONS_PER_IP` and `GUEST_TOKENS_PER_MINUTE` at defaults.
8. **Commands:** none beyond the build/start commands above.
9. **Configuration:** with `STORE=memory` (default) all online data resets on every restart/deploy — acceptable only for testing. Use Supabase for anything real.
10. **Verification:** `curl https://<server>/health` → `{"ok":true,...}`. Then open the web app with the server URL configured, open the same private-room invite link in two browsers and play a round.
11. **Owner/ChatGPT:** create the service, set the variables, share the public URL (not secrets).
12. **Claude Code afterwards:** set `VITE_MULTIPLAYER_URL` for the web build, verify CORS/origins, run an online smoke test, update this file.

## 3. Frontend hosting (static PWA)

1. **Why:** public URL for the game.
2. **Free options:** Cloudflare Pages, Netlify, Vercel (hobby), GitHub Pages. All serve static files over HTTPS.
3. **Limits:** generous for static sites; check build-minute quotas.
4. **Billing:** none on free tiers.
5. **Steps (Cloudflare Pages example):** connect the repository → build command `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @lingua/web build` → output directory `apps/web/dist` → add a single-page-app fallback if the host needs one (all routes go to `index.html`).
6. **Permissions:** GitHub read access for the hosting app.
7. **Environment variables (build-time, public):** `VITE_MULTIPLAYER_URL` (e.g. `https://lingua-legends-server.onrender.com`), optional `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
8. **Commands:** see step 5.
9. **Configuration:** the service worker (`/sw.js`) only caches static assets; no API responses are cached.
10. **Verification:** open the URL on a phone, "Add to Home Screen", reload offline → the lobby loads and bot matches work.
11. **Owner/ChatGPT:** create the project and set variables.
12. **Claude Code afterwards:** add the production origin to the server's `ALLOWED_ORIGINS`, run Lighthouse/PWA checks.

## 4. Email delivery for sign-in (optional)

Supabase's built-in email sender is rate-limited and meant for development. For real users, configure a custom SMTP provider in **Authentication → SMTP Settings** (free tiers exist, e.g. Resend or Brevo; check current limits). Requires a verified sending domain (DNS records). Not required for guest play.

## 5. Domain / DNS (optional)

Only needed for a custom domain. Point a CNAME at the frontend host and (optionally) a subdomain at the multiplayer server. Remember to update `ALLOWED_ORIGINS` and the Supabase Site URL.

## 6. AI and speech providers (not connected — do not enable without approval)

- **Why:** essay feedback, conversation simulation, speaking feedback.
- **Free option:** generally no reliable free production tier; all major providers bill per use.
- **Billing:** required → **needs explicit approval from the project owner** before any key is created.
- **What exists now:** deterministic grading for all objective items; writing and speaking use self-check checklists; Real Life uses scripted, deterministic dialogues; listening uses the browser's built-in text-to-speech.
- **When approved:** keys go **only** to the multiplayer server (`AI_PROVIDER`, `AI_API_KEY`, `AI_MONTHLY_BUDGET_USD` — not yet read by the code), behind per-user rate limits and a monthly cost cap. Voice recordings must not be stored by default and require explicit consent. AI feedback must be labelled as advisory, never as an official grade.
- **Claude Code afterwards:** implement the `WritingEvaluationProvider` / `ConversationProvider` interfaces described in `docs/ARCHITECTURE.md` on the server, add moderation, budgets and tests.

## 7. Bagrut specification check (manual, no account needed)

The official booklet <https://meyda.education.gov.il/files/pop/0files/english/Chativa-Elyona/Bagrut/updates/5pointsbooklet2025.pdf> could **not** be fetched from the development environment (the host was blocked by the sandbox network). Until a person checks it:

- `packages/content/src/bagrut.ts` keeps `verification: 'unverified-draft'` and the UI shows a disclaimer.
- **Owner/ChatGPT:** download the booklet and send Claude Code (or write into `docs/BAGRUT.md`) the exact component list, timings, weights, word counts and literature requirements for the target exam year.
- **Claude Code afterwards:** update `BAGRUT_CURRICULUM`, mock-exam durations and task word counts, set `verification: 'verified'` with `verifiedAgainst` = booklet name/year, and re-run `pnpm content:validate`.

## 8. Content review (people, not a service)

All 228 public items, 120 ranked items and the Real Life dialogues are marked `reviewStatus: 'ai-drafted'`. Before a public release an English teacher should review answers, distractors, explanations and Hebrew translations, then update `reviewStatus` to `reviewed`/`approved`. `pnpm content:validate` checks structure but cannot judge pedagogy.

## 9. GitHub permissions

Claude Code pushes to its working branch only. Creating releases, enabling GitHub Pages or adding repository secrets requires the owner. No CI secrets are needed for the current test suite (it runs entirely offline).

## 10. Privacy and legal (people)

The game may be used by minors. Before public launch with accounts: a privacy policy, terms of use, parental-consent review where required, a data-retention policy for `learning_events`, and a process that runs `process_account_deletion` for rows in `account_deletion_requests`. This needs a qualified human/legal review.

## 11. Private ranked question pool (security — required for ranked play)

1. **Why:** ranked answer keys must never be publicly readable. This GitHub repository is **public**, so every item committed
   to it — including the 120 items in `apps/server/src/content/devRankedSample.ts` and anything in git history — is public.
   Those items are kept only as a *development sample* for local play and tests.
2. **What the server does now:** at startup it loads the ranked pool from, in order: `RANKED_POOL_FILE` (a private JSON
   file on the server host) → Supabase rows with `is_ranked_only = true` (when `STORE=supabase`) → the public sample
   (only outside production, or with `ALLOW_PUBLIC_RANKED_SAMPLE=true`). In production with no private pool, ranked
   queues answer `RANKED_UNAVAILABLE` and the app tells players that casual and private play still work.
   `GET /health` reports `ranked: { source, size }` (never content).
3. **The private pool:** a starter private pool (new items, not in the repository) was delivered to the owner as a file
   in the chat, named `ranked-pool.private.json`. Keep it out of GitHub. Teachers can extend it; new items must not
   repeat any public prompt (the validator checks this).
4. **Option A — file on the server host (simplest, free):**
   - Upload `ranked-pool.private.json` to the host as a *secret file* (Render: "Secret Files"; Koyeb/VPS: a file outside the repo).
   - Set `RANKED_POOL_FILE=/etc/secrets/ranked-pool.private.json` (use the path your host gives).
   - Check `GET /health` → `ranked.source` must be `private-file`.
5. **Option B — Supabase (when STORE=supabase):**
   - On a computer with the repository: `pnpm ranked:validate ranked-pool.private.json` then
     `pnpm ranked:export-sql ranked-pool.private.json ranked.private.sql`.
   - Paste `ranked.private.sql` into the Supabase SQL editor, run it, then delete the file.
   - RLS already hides `is_ranked_only` items from `anon`/`authenticated` (covered by `pnpm db:test`).
   - Check `GET /health` → `ranked.source` must be `supabase`.
6. **Never:** commit the private pool, paste it into an issue/PR, put it in a `VITE_*` variable or the frontend host,
   or set `ALLOW_PUBLIC_RANKED_SAMPLE=true` in production.
7. **Rotation:** if the private pool ever leaks, replace the items (new prompts), redeploy, and consider resetting the season.
