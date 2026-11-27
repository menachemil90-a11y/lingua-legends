# Learning engine (`packages/learning`)

Every mode reports `LearningEvent`s and asks the same engine what to show next.

## Evidence from story modes
English Detective answers are recorded as `inference` evidence (secondary: reading). Real Life replies are recorded as
reading evidence with grammar/vocabulary as secondary skills — **never as speaking**, because no speech is captured. Escape
Room locks record reading evidence on the first attempt (hints mark the event). Each item id is namespaced
(`detective:…`, `real-life:…`, `escape:…`) so the scheduler can bring them back for review.

## Content model (`packages/shared/src/content/schema.ts`)
`ContentItem`: id, version, CEFR level, primary/secondary skills, difficulty 1–5, type (multiple-choice, cloze,
sentence-build, error-correction), category, prompt, optional context, options (with per-distractor feedback and
error category), tiles, accepted answers, grading rule (option / normalized-text / token-sequence), English + Hebrew
explanation, example, hint, common mistakes, tags (vocabulary, grammar, Bagrut), consumer modes, time limit, review status, passage id.
`ReadingPassage`: original passages with glossary. Validation: `pnpm content:validate`.

## LearningEvent
player, item (+version), mode, correct, host-measured response time, attempt, hint used, timestamp, error category,
level, difficulty, skills, knowledge-component tags, category, time limit.

## Knowledge components
Each item maps to tags: `v:<word>` and `g:<grammar point>` (fallback `i:<item id>`). Mastery and review schedules are
tracked per tag, not per item — so *"although"* returns in a **different item and mode** (e.g. missed in Word Battle →
reviewed as a sentence-building puzzle or a race question). Unit test: "brings a missed word back in a different context".

## Mastery
Per tag, `m ∈ [0,1]` starting at 0.3: correct → `m += 0.25·q·(1−m)` (q = 1, 0.6 on a second attempt, 0.5 with a hint);
wrong → `m *= 0.65`. A tag counts as mastered at `m ≥ 0.8` with ≥ 3 correct answers. Weak topics: ≥ 2 attempts and `m < 0.6`.

## Skill ability and CEFR estimates
Item difficulty on a logit scale: A1 = −2.5 … C2 = +2.5, ±0.25 per within-level difficulty step.
P(correct) = σ(1.7·(θ − b) + 1.1), calibrated so ability = difficulty → ~75 %. Elo-style update
θ += K·(y − P), K = max(0.12, 0.9 / (1 + 0.1·n)); secondary skills get 40 % weight.
Estimated level = round(θ + 2.5) clamped to A1–C2, shown **only** with ≥ 6 answers in that skill (or after placement),
with confidence low/medium/high by evidence count. Otherwise "Not yet assessed". Writing, speaking, listening,
pronunciation and fluency stay "Not yet assessed" until real evaluation exists — the engine never invents results.

## Review scheduling (replaceable)
`ReviewScheduler` interface; default `expanding-interval-v1` (SM-2-inspired):
- wrong → interval 10 min, ease −0.2 (min 1.3), reps reset;
- 1st correct → 1 day (8 h if slow or with a hint); 2nd → 3 days; then × ease (cap 180 days);
- fast correct → ease +0.1, slow → −0.05, hint → interval halved.
This is a common heuristic; it has **not** been validated for this product. FSRS or other schedulers can replace it without touching game code.

## Adaptive selection (`selectItems`)
1. Reserve ~35 % of a session for due review tags, choosing a *different* item than the last exposure.
2. Fill the rest with items whose predicted success is closest to 72 %, skipping the 40 most recent items, with light randomness.
3. Lightly interleave so reviews are spread through the session.
Bots adapt via `suggestBotTier(recentAccuracy)`; Sentence practice moves up a level after two consecutive successes.

## Placement test
12 items (vocabulary, grammar, reading × 4), per-skill staircase starting at the self-reported level (default B1),
high-gain ability update; result stored as starting estimates. Optional and skippable — play is never blocked.

## Mistake analysis
Distractors carry error categories (subject–verb agreement, tense, preposition, article, collocation, connector logic,
word order, false synonym, opposite meaning, inference, register, …). Counts feed the profile's "common mistake types".
Sentence-building uses known wrong orders plus a structural diagnosis of the first divergence.

## Privacy
Local learning history is bounded (300 events persisted). Cloud sync sends only learning events for signed-in users.
