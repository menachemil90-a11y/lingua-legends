# CLAUDE.md — permanent project instructions

## Communication
- Talk to the project owner in **Hebrew**. Write code, comments and docs in English.
- Never claim something works unless it was run/tested. Distinguish: working locally / awaiting configuration / verified online / not implemented.
- Keep `HANDOFF.md`, `docs/ROADMAP.md` and the README status table current after every work session.

## Priorities
1. Quality of the three core games (Word Battle, Grammar Race, Sentence Master) over adding unfinished modes.
2. Real authoritative multiplayer (never fake online opponents; bots are always labelled as bots).
3. Genuine learning: shared learning engine, explanations in English and Hebrew, spaced review.
4. Premium, original visual identity — no copied assets, names, or exact interfaces from existing games.

## Security rules (non-negotiable)
- The server decides correctness, damage, scores, winners, ratings, XP, currency and rewards. Clients send intents only.
- Never send answer keys before a round ends. `ROUND_START` carries `PublicQuestion` only.
- The repository is PUBLIC. Ranked answer keys must never be committed: production loads a private pool (`RANKED_POOL_FILE` or Supabase `is_ranked_only`, see `apps/server/src/content/rankedPool.ts`). `devRankedSample.ts` is a public sample for dev/tests only. Keep private pools in `private/` (gitignored) and check them with `pnpm ranked:validate`. Never import server code from `apps/web` or `packages/*` (ESLint enforces this).
- Validate every client message with the zod schemas in `packages/shared/src/protocol.ts`; keep idempotency (`msgId`), rate limits and membership checks.
- Never trust client timestamps; response times are measured by the host.
- RLS on every Supabase table; clients must not be able to write ratings, matches, rewards, currency, achievements or friendships. Run `pnpm db:test` after any migration change.
- No secrets in the repository, `HANDOFF.md`, or `VITE_*` variables. The service-role key is server-only.
- Do not activate paid services or AI/speech providers without explicit owner approval.

## Child-safety and wellbeing
- No free-text chat between players (quick-chat whitelist only), no voice chat, no location, no real names required.
- No gambling, loot boxes, pay-to-win, punitive streaks, energy systems, fake scarcity or shame notifications.
- Players can stop after any match; Momentum celebrates practice without deleting progress.

## Design rules
- Use the tokens in `apps/web/src/styles/tokens.css` and components in `apps/web/src/design` — no ad-hoc colours, shadows or durations.
- English learning content must always render LTR (`<En>` component / `.en` class), including inside the Hebrew RTL UI.
- Feedback must never rely on colour alone (icons + patterns).
- Respect `reducedMotion`, `highContrast` and `visualCues` settings; keep animations short and non-blocking.
- Every new UI string goes into `apps/web/src/i18n/en.ts` **and** `he.ts` (the i18n test enforces parity).
- Test layouts at 360px width and desktop; no horizontal overflow.

## Coding conventions
- TypeScript strict mode, ESM, pnpm workspaces. Shared logic belongs in `packages/*`, not in the web app.
- Game rules are pure/deterministic and unit-tested with `FakeClock`.
- Content is added through the helpers in `packages/content/src/helpers.ts` and must pass `pnpm content:validate`.
  Mark new content `reviewStatus: 'ai-drafted'` until a teacher reviews it.
- Zustand selectors must return stable references (no `?? []` inline — use module constants).
- Before finishing: `pnpm lint && pnpm typecheck && pnpm test && pnpm content:validate && pnpm build`, plus `pnpm test:e2e` and `pnpm db:test` when relevant.
