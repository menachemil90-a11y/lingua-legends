/**
 * Account progression (XP and levels). XP rewards are deterministic functions of
 * match statistics; on the server they are computed server-side only.
 * Losing still earns XP — effort and learning are rewarded.
 */
import type { PlayerMatchStats } from './protocol';

export function xpForLevel(level: number): number {
  // Total XP required to *reach* `level` (level 1 = 0 XP).
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 1; l < level; l++) total += 120 + (l - 1) * 40;
  return total;
}

export function levelFromXp(xp: number): { level: number; into: number; needed: number; progress: number } {
  let level = 1;
  while (xpForLevel(level + 1) <= xp && level < 200) level++;
  const base = xpForLevel(level);
  const needed = xpForLevel(level + 1) - base;
  const into = xp - base;
  return { level, into, needed, progress: needed > 0 ? into / needed : 1 };
}

export function matchXp(stats: PlayerMatchStats, result: 'win' | 'loss' | 'draw', completed: boolean): number {
  if (!completed) return Math.min(10, stats.correct * 2);
  const participation = 20;
  const correctness = stats.correct * 4;
  const outcome = result === 'win' ? 25 : result === 'draw' ? 15 : 8;
  const combo = Math.min(15, stats.bestCombo * 2);
  return participation + correctness + outcome + combo;
}

/** Cosmetic currency ("Shards"). Earned only by playing; cannot be bought. */
export function matchShards(stats: PlayerMatchStats, result: 'win' | 'loss' | 'draw', completed: boolean): number {
  if (!completed) return 0;
  return 5 + Math.min(20, stats.correct) + (result === 'win' ? 10 : result === 'draw' ? 5 : 2);
}
