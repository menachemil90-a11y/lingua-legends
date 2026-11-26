/**
 * Shared learning engine: every game mode reports LearningEvents here, and every
 * game mode asks here which items to present next.
 */
import {
  cefrFromIndex,
  cefrIndex,
  DETERMINISTIC_SKILLS,
  itemDifficultyLogit,
  SKILLS,
  type CefrLevel,
  type ContentItem,
  type ErrorCategory,
  type RandomFn,
  type Skill,
} from '@lingua/shared';
import { expandingIntervalScheduler, type ReviewScheduler } from './scheduler';
import type { LearnerProfile, LearningEvent, MasteryState, ProficiencyEstimate, SkillAbility } from './types';

export const HISTORY_LIMIT = 600;
export const RECENT_LIMIT = 80;
/** Minimum answered items in a skill before an estimate is shown. */
export const MIN_EVIDENCE = 6;

export function createLearnerProfile(playerId: string, selfReportedLevel: CefrLevel | null = null): LearnerProfile {
  return {
    version: 1,
    playerId,
    abilities: {},
    mastery: {},
    reviews: {},
    errors: {},
    recentItems: [],
    history: [],
    placement: null,
    selfReportedLevel,
    totalEvents: 0,
  };
}

/** Knowledge components an item exercises. */
export function knowledgeTags(item: Pick<ContentItem, 'id' | 'tags'>): string[] {
  const tags = [...item.tags.vocabulary.map((t) => `v:${t}`), ...item.tags.grammar.map((t) => `g:${t}`)];
  return tags.length > 0 ? tags : [`i:${item.id}`];
}

/** Probability of success; calibrated so ability == difficulty gives ~75%. */
export function successProbability(theta: number, difficulty: number): number {
  return 1 / (1 + Math.exp(-(1.7 * (theta - difficulty) + 1.1)));
}

export function priorTheta(profile: LearnerProfile): number {
  const lvl = profile.selfReportedLevel ?? 'A2';
  return -2.5 + cefrIndex(lvl);
}

export function abilityOf(profile: LearnerProfile, skill: Skill): SkillAbility {
  return profile.abilities[skill] ?? { skill, theta: priorTheta(profile), n: 0, correct: 0 };
}

function updateAbility(a: SkillAbility, correct: boolean, b: number, weight: number): SkillAbility {
  const p = successProbability(a.theta, b);
  const k = Math.max(0.12, 0.9 / (1 + a.n * 0.1)) * weight;
  return { ...a, theta: a.theta + k * ((correct ? 1 : 0) - p), n: a.n + 1, correct: a.correct + (correct ? 1 : 0) };
}

function updateMastery(m: MasteryState | undefined, tag: string, ev: LearningEvent): MasteryState {
  const cur = m ?? { tag, mastery: 0.3, attempts: 0, correct: 0, lastSeenAt: ev.timestamp };
  const quality = ev.hintUsed ? 0.5 : ev.attempt > 1 ? 0.6 : 1;
  const mastery = ev.correct ? cur.mastery + 0.25 * quality * (1 - cur.mastery) : cur.mastery * 0.65;
  return {
    tag,
    mastery: Math.max(0, Math.min(1, mastery)),
    attempts: cur.attempts + 1,
    correct: cur.correct + (ev.correct ? 1 : 0),
    lastSeenAt: ev.timestamp,
  };
}

/** Applies one learning event. Returns a new profile object (inputs are not mutated). */
export function recordEvent(
  profile: LearnerProfile,
  ev: LearningEvent,
  scheduler: ReviewScheduler = expandingIntervalScheduler,
): LearnerProfile {
  const next: LearnerProfile = {
    ...profile,
    abilities: { ...profile.abilities },
    mastery: { ...profile.mastery },
    reviews: { ...profile.reviews },
    errors: { ...profile.errors },
  };
  const b = itemDifficultyLogit(ev.level, ev.difficulty ?? 3);
  next.abilities[ev.primarySkill] = updateAbility(abilityOf(profile, ev.primarySkill), ev.correct, b, 1);
  for (const s of ev.secondarySkills) {
    if (s !== ev.primarySkill) next.abilities[s] = updateAbility(abilityOf(profile, s), ev.correct, b, 0.4);
  }
  const speedRatio = ev.responseMs !== null && ev.timeLimitMs ? ev.responseMs / ev.timeLimitMs : null;
  for (const tag of ev.tags) {
    next.mastery[tag] = updateMastery(profile.mastery[tag], tag, ev);
    const prev = profile.reviews[tag] ?? scheduler.create(tag, ev.timestamp);
    next.reviews[tag] = scheduler.update(prev, { correct: ev.correct, speedRatio, hintUsed: ev.hintUsed, itemId: ev.itemId, mode: ev.mode }, ev.timestamp);
  }
  if (!ev.correct && ev.errorCategory) {
    next.errors[ev.errorCategory] = (next.errors[ev.errorCategory] ?? 0) + 1;
  }
  next.recentItems = [...profile.recentItems.filter((id) => id !== ev.itemId), ev.itemId].slice(-RECENT_LIMIT);
  next.history = [...profile.history, ev].slice(-HISTORY_LIMIT);
  next.totalEvents = profile.totalEvents + 1;
  return next;
}

export function eventFromItem(
  item: ContentItem,
  data: {
    id: string;
    playerId: string;
    mode: LearningEvent['mode'];
    correct: boolean;
    responseMs: number | null;
    timestamp: number;
    attempt?: number;
    hintUsed?: boolean;
    errorCategory?: ErrorCategory;
    timeLimitMs?: number;
  },
): LearningEvent {
  return {
    id: data.id,
    playerId: data.playerId,
    itemId: item.id,
    itemVersion: item.version,
    mode: data.mode,
    correct: data.correct,
    responseMs: data.responseMs,
    attempt: data.attempt ?? 1,
    hintUsed: data.hintUsed ?? false,
    timestamp: data.timestamp,
    ...(data.errorCategory ? { errorCategory: data.errorCategory } : {}),
    level: item.level,
    difficulty: item.difficulty,
    primarySkill: item.primarySkill,
    secondarySkills: item.secondarySkills,
    tags: knowledgeTags(item),
    category: item.category,
    ...(data.timeLimitMs ? { timeLimitMs: data.timeLimitMs } : {}),
  };
}

// ---------------------------------------------------------------------------
// Proficiency estimates (never invented: "not assessed" until enough evidence)
// ---------------------------------------------------------------------------

export function estimateSkill(profile: LearnerProfile, skill: Skill): ProficiencyEstimate {
  const a = profile.abilities[skill];
  const placementLevel = profile.placement?.estimates[skill];
  const n = a?.n ?? 0;
  if (!a || (n < MIN_EVIDENCE && !placementLevel)) return { status: 'not-assessed', skill, n };
  const level = cefrFromIndex(a.theta + 2.5);
  const confidence = n < 12 ? 'low' : n < 30 ? 'medium' : 'high';
  return { status: 'estimated', skill, level, confidence, theta: a.theta, n };
}

export function estimateAll(profile: LearnerProfile): ProficiencyEstimate[] {
  return SKILLS.map((s) => estimateSkill(profile, s));
}

/** Overall estimate from the deterministic skills that have evidence. */
export function overallEstimate(profile: LearnerProfile): ProficiencyEstimate | null {
  const ests = DETERMINISTIC_SKILLS.map((s) => estimateSkill(profile, s)).filter(
    (e): e is Extract<ProficiencyEstimate, { status: 'estimated' }> => e.status === 'estimated',
  );
  if (ests.length === 0) return null;
  const totalN = ests.reduce((acc, e) => acc + e.n, 0);
  const theta = ests.reduce((acc, e) => acc + e.theta * e.n, 0) / totalN;
  return {
    status: 'estimated',
    skill: 'vocabulary',
    level: cefrFromIndex(theta + 2.5),
    confidence: totalN < 15 ? 'low' : totalN < 50 ? 'medium' : 'high',
    theta,
    n: totalN,
  };
}

/** The level to serve content at, when the player hasn't chosen one explicitly. */
export function recommendedLevel(profile: LearnerProfile, skill: Skill = 'vocabulary'): CefrLevel {
  const est = estimateSkill(profile, skill);
  if (est.status === 'estimated') return est.level;
  const overall = overallEstimate(profile);
  if (overall?.status === 'estimated') return overall.level;
  return profile.selfReportedLevel ?? 'A2';
}

// ---------------------------------------------------------------------------
// Reviews, weak topics and mastery summaries
// ---------------------------------------------------------------------------

export function dueReviews(profile: LearnerProfile, now: number) {
  return Object.values(profile.reviews)
    .filter((r) => r.dueAt <= now && r.lapses + r.reps > 0)
    .sort((a, b) => (a.lastCorrect === b.lastCorrect ? a.dueAt - b.dueAt : a.lastCorrect ? 1 : -1));
}

export function upcomingReviews(profile: LearnerProfile, now: number, limit = 10) {
  return Object.values(profile.reviews)
    .filter((r) => r.dueAt > now)
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, limit);
}

export function isMastered(m: MasteryState | undefined): boolean {
  return !!m && m.mastery >= 0.8 && m.correct >= 3;
}

export function masteredTags(profile: LearnerProfile, prefix: 'v:' | 'g:'): string[] {
  return Object.values(profile.mastery)
    .filter((m) => m.tag.startsWith(prefix) && isMastered(m))
    .map((m) => m.tag.slice(prefix.length));
}

export function weakTopics(profile: LearnerProfile, limit = 6): MasteryState[] {
  return Object.values(profile.mastery)
    .filter((m) => m.attempts >= 2 && m.mastery < 0.6)
    .sort((a, b) => (1 - b.mastery) * Math.log(b.attempts + 1) - (1 - a.mastery) * Math.log(a.attempts + 1))
    .slice(0, limit);
}

export function topErrors(profile: LearnerProfile, limit = 5): { category: ErrorCategory; count: number }[] {
  return (Object.entries(profile.errors) as [ErrorCategory, number][])
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Adaptive item selection
// ---------------------------------------------------------------------------

export interface SelectOptions {
  count: number;
  now: number;
  random: RandomFn;
  /** Restrict to these levels (e.g. a match bracket). Defaults to recommended level ±1. */
  levels?: readonly CefrLevel[];
  /** Fraction of items reserved for due reviews (spaced retrieval). */
  reviewShare?: number;
  /** Target probability of success for fresh items. */
  targetSuccess?: number;
  /** Mode that will present the items (used to vary review contexts). */
  mode?: string;
}

/**
 * Picks items for a session:
 *  1. Due review components are re-tested with a *different* item when possible
 *     (different context / mode than the last exposure).
 *  2. Fresh items are chosen near the target success probability.
 *  3. Recently seen items are avoided.
 */
export function selectItems(pool: readonly ContentItem[], profile: LearnerProfile, opts: SelectOptions): ContentItem[] {
  const target = opts.targetSuccess ?? 0.72;
  const levels = opts.levels ?? defaultLevels(profile);
  const candidates = pool.filter((i) => levels.includes(i.level));
  const base = candidates.length > 0 ? candidates : pool.slice();
  const recent = new Set(profile.recentItems.slice(-40));
  const chosen: ContentItem[] = [];
  const used = new Set<string>();

  const nReview = Math.round(opts.count * (opts.reviewShare ?? 0.35));
  const due = dueReviews(profile, opts.now);
  for (const review of due) {
    if (chosen.length >= nReview) break;
    const options = base.filter((i) => !used.has(i.id) && knowledgeTags(i).includes(review.tag));
    if (options.length === 0) continue;
    // Prefer a different item and a different mode/category than last time.
    options.sort((a, b) => contextScore(b, review) - contextScore(a, review) || opts.random() - 0.5);
    const pick = options[0]!;
    chosen.push(pick);
    used.add(pick.id);
  }

  const scored = base
    .filter((i) => !used.has(i.id))
    .map((i) => {
      const theta = abilityOf(profile, i.primarySkill).theta;
      const p = successProbability(theta, itemDifficultyLogit(i.level, i.difficulty));
      const penalty = recent.has(i.id) ? 1 : 0;
      return { i, score: Math.abs(p - target) + penalty + opts.random() * 0.18 };
    })
    .sort((a, b) => a.score - b.score);
  for (const { i } of scored) {
    if (chosen.length >= opts.count) break;
    chosen.push(i);
    used.add(i.id);
  }
  return interleave(chosen, opts.random);
}

function contextScore(item: ContentItem, review: { lastItemId: string }): number {
  return (item.id !== review.lastItemId ? 2 : 0) + (item.type === 'sentence-build' ? 0.2 : 0);
}

function defaultLevels(profile: LearnerProfile): CefrLevel[] {
  const idx = cefrIndex(recommendedLevel(profile));
  return [cefrFromIndex(idx - 1), cefrFromIndex(idx), cefrFromIndex(idx + 1)].filter((v, i, a) => a.indexOf(v) === i);
}

function interleave<T>(items: T[], random: RandomFn): T[] {
  // Light shuffle that keeps the list roughly ordered by suitability.
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    if (random() < 0.5) {
      const j = Math.max(0, i - 1 - Math.floor(random() * 3));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
  }
  return out;
}
