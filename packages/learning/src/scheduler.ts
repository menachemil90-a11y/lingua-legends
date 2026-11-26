/**
 * Review scheduling. The algorithm is intentionally behind an interface so it can be
 * replaced (e.g. with FSRS) without touching game code.
 *
 * Default: an SM-2-inspired expanding-interval scheduler. It is a reasonable,
 * widely used heuristic — it has NOT been validated for this product, and we make no
 * claim that it is optimal.
 */
import type { ReviewState } from './types';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export interface ReviewOutcome {
  correct: boolean;
  /** Response time relative to the time limit (0..1+), if known. */
  speedRatio: number | null;
  hintUsed: boolean;
  itemId: string;
  mode: string;
}

export interface ReviewScheduler {
  readonly id: string;
  create(tag: string, now: number): ReviewState;
  update(state: ReviewState, outcome: ReviewOutcome, now: number): ReviewState;
}

export const expandingIntervalScheduler: ReviewScheduler = {
  id: 'expanding-interval-v1',
  create(tag, now) {
    return {
      tag,
      intervalMs: 0,
      ease: 2.3,
      dueAt: now,
      reps: 0,
      lapses: 0,
      lastSeenAt: now,
      lastItemId: '',
      lastMode: '',
      lastCorrect: false,
    };
  },
  update(prev, outcome, now) {
    const s: ReviewState = { ...prev, lastSeenAt: now, lastItemId: outcome.itemId, lastMode: outcome.mode, lastCorrect: outcome.correct };
    if (!outcome.correct) {
      // Lapse: bring it back soon, in a different context.
      s.reps = 0;
      s.lapses += 1;
      s.ease = Math.max(1.3, s.ease - 0.2);
      s.intervalMs = 10 * MINUTE;
      s.dueAt = now + s.intervalMs;
      return s;
    }
    const fast = outcome.speedRatio !== null && outcome.speedRatio < 0.4;
    const slow = outcome.speedRatio !== null && outcome.speedRatio > 0.85;
    s.reps += 1;
    if (s.reps === 1) s.intervalMs = slow || outcome.hintUsed ? 8 * HOUR : DAY;
    else if (s.reps === 2) s.intervalMs = 3 * DAY;
    else s.intervalMs = Math.round(s.intervalMs * s.ease);
    if (outcome.hintUsed) s.intervalMs = Math.round(s.intervalMs * 0.5);
    if (fast && !outcome.hintUsed) s.ease = Math.min(3.0, s.ease + 0.1);
    if (slow) s.ease = Math.max(1.3, s.ease - 0.05);
    s.intervalMs = Math.min(s.intervalMs, 180 * DAY);
    s.dueAt = now + s.intervalMs;
    return s;
  },
};
