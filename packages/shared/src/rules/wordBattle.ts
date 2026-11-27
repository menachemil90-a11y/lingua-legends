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
  cfg: { baseDamage: number; speedBonusMax: number; surgeMultiplier: number } = WORD_BATTLE,
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
 * - Timeout: the higher share of HP left wins (callers pass hp / maxHp); equal is a draw.
 */
export function decideBattle(hpA: number, hpB: number): { a: BattleResult; b: BattleResult } {
  if (hpA === hpB) return { a: 'draw', b: 'draw' };
  return hpA > hpB ? { a: 'win', b: 'loss' } : { a: 'loss', b: 'win' };
}

/**
 * Tactics: a pre-match choice that trades strengths, shown openly to both players.
 * Values were chosen with a bot-vs-bot parameter search and are guarded by a balance simulation
 * (packages/shared/test/tactics.test.ts). Measured win rates vs Balanced with 160 matches per level
 * (rookie / adept / champion): Guardian 48 / 47 / 39 %, Striker 49 / 57 / 53 %, Scholar 57 / 55 / 49 %.
 */
export const TACTIC_IDS = ['balanced', 'guardian', 'striker', 'scholar'] as const;
export type TacticId = (typeof TACTIC_IDS)[number];

export interface TacticDef {
  maxHp: number;
  /** Added to the base damage of every correct answer. */
  damageDelta: number;
  /** Consecutive correct answers needed to charge an ability. */
  comboForCharge: number;
  /** Extra HP restored by Focus. */
  focusHealDelta: number;
  /** Starts the match with a Shield already up. */
  startShield: boolean;
  /** HP lost after answering wrong (not for running out of time). */
  wrongSelfDamage: number;
}

export const TACTICS: Record<TacticId, TacticDef> = {
  balanced: { maxHp: 100, damageDelta: 0, comboForCharge: 3, focusHealDelta: 0, startShield: false, wrongSelfDamage: 0 },
  guardian: { maxHp: 100, damageDelta: -2, comboForCharge: 3, focusHealDelta: 0, startShield: true, wrongSelfDamage: 0 },
  striker: { maxHp: 100, damageDelta: 1, comboForCharge: 3, focusHealDelta: 0, startShield: false, wrongSelfDamage: 2 },
  scholar: { maxHp: 90, damageDelta: 0, comboForCharge: 2, focusHealDelta: 0, startShield: false, wrongSelfDamage: 0 },
};

