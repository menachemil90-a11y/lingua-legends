/**
 * Word Battle rules — pure functions shared by the authoritative server and the
 * offline practice host. See docs/GAME_DESIGN.md for the balance rationale.
 */
import { clamp } from '../random';

export const WORD_BATTLE = {
  maxHp: 100,
  /** Match clock. When it expires, the round in progress is the final round. */
  matchMs: 150_000,
  countdownMs: 3_500,
  /** Pause between rounds so attack animations and feedback can play. */
  resolveMs: 2_400,
  baseDamage: 10,
  /** Modest speed bonus: at most +4 on top of 10 (accuracy matters more than speed). */
  speedBonusMax: 4,
  comboForCharge: 3,
  surgeMultiplier: 1.8,
  focusHeal: 12,
  disconnectGraceMs: 30_000,
} as const;

export type WordBattleConfig = typeof WORD_BATTLE;

export interface DamageResult {
  damage: number;
  speedBonus: number;
}

/**
 * Damage for a correct answer. `responseMs` is measured by the host (server
 * receipt time), never by the client.
 */
export function computeDamage(
  responseMs: number,
  roundMs: number,
  surge: boolean,
  cfg: Pick<WordBattleConfig, 'baseDamage' | 'speedBonusMax' | 'surgeMultiplier'> = WORD_BATTLE,
): DamageResult {
  const fractionLeft = clamp(1 - responseMs / roundMs, 0, 1);
  const speedBonus = Math.round(cfg.speedBonusMax * fractionLeft);
  const raw = cfg.baseDamage + speedBonus;
  return { damage: surge ? Math.round(raw * cfg.surgeMultiplier) : raw, speedBonus };
}

export type BattleResult = 'win' | 'loss' | 'draw';

/**
 * Decides the result when the match ends.
 * - KO: a player at 0 HP loses; both at 0 in the same round is a draw.
 * - Timeout: higher HP wins; equal HP is a draw.
 */
export function decideBattle(hpA: number, hpB: number): { a: BattleResult; b: BattleResult } {
  if (hpA === hpB) return { a: 'draw', b: 'draw' };
  return hpA > hpB ? { a: 'win', b: 'loss' } : { a: 'loss', b: 'win' };
}
