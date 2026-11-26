/** Sentence Master duel scoring. Accuracy is worth far more than speed. */
import { clamp } from '../random';

export const SENTENCE_MASTER = {
  rounds: 5,
  attempts: 2,
  firstTryPoints: 100,
  secondTryPoints: 60,
  /** Modest speed bonus on top of the base points. */
  speedBonusMax: 25,
  countdownMs: 3_500,
  resolveMs: 3_200,
  disconnectGraceMs: 30_000,
} as const;

export type SentenceMasterConfig = typeof SENTENCE_MASTER;

export function sentencePoints(
  attemptNumber: number,
  responseMs: number,
  roundMs: number,
  cfg: SentenceMasterConfig = SENTENCE_MASTER,
): number {
  const base = attemptNumber <= 1 ? cfg.firstTryPoints : cfg.secondTryPoints;
  const bonus = Math.round(cfg.speedBonusMax * clamp(1 - responseMs / roundMs, 0, 1));
  return base + (attemptNumber <= 1 ? bonus : Math.round(bonus / 2));
}
