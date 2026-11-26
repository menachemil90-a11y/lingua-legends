/**
 * Competitive ranking. Completely independent from English proficiency:
 * ratings are tracked per (mode, bracket) and only reflect competitive results.
 * Outcomes are never manipulated; rating changes are a pure function of results.
 */
import type { Bracket } from './cefr';
import type { OnlineModeId } from './content/schema';

export const RANK_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'legend'] as const;
export type RankTier = (typeof RANK_TIERS)[number];

export const RANK_TIER_NAMES: Record<RankTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
  master: 'Master',
  legend: 'Legend',
};

export const START_RATING = 1000;
export const PLACEMENT_MATCHES = 5;
const DIVISION_SIZE = 100;
const BRONZE_FLOOR = 600;
const MASTER_MIN = 2100;
const LEGEND_MIN = 2400;

export interface RankInfo {
  tier: RankTier;
  /** 3 = III (lowest), 1 = I (highest). null for Master/Legend. */
  division: 1 | 2 | 3 | null;
  /** Progress through the current division, 0..1. */
  progress: number;
  /** Rating needed for the next division (null at Legend). */
  nextAt: number | null;
  label: string;
}

const DIVISION_TIERS: RankTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];

export function rankFromRating(rating: number): RankInfo {
  const r = Math.max(0, Math.round(rating));
  if (r >= LEGEND_MIN) {
    return { tier: 'legend', division: null, progress: 1, nextAt: null, label: 'Legend' };
  }
  if (r >= MASTER_MIN) {
    return {
      tier: 'master',
      division: null,
      progress: (r - MASTER_MIN) / (LEGEND_MIN - MASTER_MIN),
      nextAt: LEGEND_MIN,
      label: 'Master',
    };
  }
  // Bronze III covers everything below BRONZE_FLOOR + DIVISION_SIZE.
  const step = Math.max(0, Math.floor((r - BRONZE_FLOOR) / DIVISION_SIZE));
  const index = Math.min(step, DIVISION_TIERS.length * 3 - 1);
  const tier = DIVISION_TIERS[Math.floor(index / 3)]!;
  const division = (3 - (index % 3)) as 1 | 2 | 3;
  const start = index === 0 ? 0 : BRONZE_FLOOR + index * DIVISION_SIZE;
  const end = BRONZE_FLOOR + (index + 1) * DIVISION_SIZE;
  const progress = Math.max(0, Math.min(1, (r - start) / (end - start)));
  const roman = division === 3 ? 'III' : division === 2 ? 'II' : 'I';
  return { tier, division, progress, nextAt: end, label: `${RANK_TIER_NAMES[tier]} ${roman}` };
}

export interface RatingState {
  rating: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  /** Highest rating reached this season. */
  peak: number;
}

export function newRatingState(): RatingState {
  return { rating: START_RATING, games: 0, wins: 0, losses: 0, draws: 0, peak: START_RATING };
}

export function isPlacement(state: RatingState): boolean {
  return state.games < PLACEMENT_MATCHES;
}

export function kFactor(state: RatingState): number {
  if (isPlacement(state)) return 64;
  if (state.games < 30) return 40;
  return 28;
}

export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + Math.pow(10, (opponent - rating) / 400));
}

export type MatchScore = 1 | 0.5 | 0;

export interface RatingChange {
  before: number;
  after: number;
  delta: number;
  rankBefore: RankInfo;
  rankAfter: RankInfo;
  placement: { played: number; total: number } | null;
  promoted: boolean;
  demoted: boolean;
}

/** Applies an Elo update. Pure; the server persists the returned state. */
export function applyResult(
  state: RatingState,
  opponentRating: number,
  score: MatchScore,
): { next: RatingState; change: RatingChange } {
  const k = kFactor(state);
  const delta = Math.round(k * (score - expectedScore(state.rating, opponentRating)));
  const after = Math.max(0, state.rating + delta);
  const next: RatingState = {
    rating: after,
    games: state.games + 1,
    wins: state.wins + (score === 1 ? 1 : 0),
    losses: state.losses + (score === 0 ? 1 : 0),
    draws: state.draws + (score === 0.5 ? 1 : 0),
    peak: Math.max(state.peak, after),
  };
  const rankBefore = rankFromRating(state.rating);
  const rankAfter = rankFromRating(after);
  const order = (r: RankInfo) => RANK_TIERS.indexOf(r.tier) * 10 + (r.division ? 4 - r.division : 0);
  return {
    next,
    change: {
      before: state.rating,
      after,
      delta: after - state.rating,
      rankBefore,
      rankAfter,
      placement: next.games <= PLACEMENT_MATCHES ? { played: next.games, total: PLACEMENT_MATCHES } : null,
      promoted: order(rankAfter) > order(rankBefore),
      demoted: order(rankAfter) < order(rankBefore),
    },
  };
}

export function ratingKey(mode: OnlineModeId, bracket: Bracket): string {
  return `${mode}:${bracket}`;
}

export interface Season {
  id: string;
  name: string;
  theme: string;
  startsAt: string;
  endsAt: string;
}

/** Season configuration. Dates are configurable; ratings are stored per season id. */
export const SEASONS: Season[] = [
  {
    id: 's1',
    name: 'Season 1 — Awakening',
    theme: 'awakening',
    startsAt: '2026-09-01T00:00:00Z',
    endsAt: '2027-01-31T23:59:59Z',
  },
];

export function currentSeason(now: Date = new Date()): Season {
  const t = now.getTime();
  return (
    SEASONS.find((s) => Date.parse(s.startsAt) <= t && t <= Date.parse(s.endsAt)) ??
    SEASONS[SEASONS.length - 1]!
  );
}

/** Matchmaking search window in rating points, widening with wait time. */
export function matchmakingWindow(waitMs: number, ranked: boolean): number {
  const base = ranked ? 100 : 250;
  return Math.min(ranked ? 600 : 1500, base + Math.floor(waitMs / 1000) * (ranked ? 40 : 80));
}
