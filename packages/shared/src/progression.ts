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

/**
 * Learning Journey: permanent milestones tied to real learning and exploration.
 * Nothing expires and nothing is lost — there are no streaks to break. Each milestone is an
 * achievement id that unlocks a cosmetic in the catalog.
 */
export type JourneyMetric = 'words' | 'grammar' | 'modes' | 'days';
export interface JourneyMilestone {
  id: string;
  metric: JourneyMetric;
  target: number;
}
export const JOURNEY_MILESTONES: JourneyMilestone[] = [
  { id: 'words-25', metric: 'words', target: 25 },
  { id: 'words-50', metric: 'words', target: 50 },
  { id: 'words-100', metric: 'words', target: 100 },
  { id: 'grammar-5', metric: 'grammar', target: 5 },
  { id: 'grammar-15', metric: 'grammar', target: 15 },
  { id: 'explorer-5', metric: 'modes', target: 5 },
  { id: 'explorer-8', metric: 'modes', target: 8 },
  { id: 'days-7', metric: 'days', target: 7 },
  { id: 'days-30', metric: 'days', target: 30 },
];

export function journeyProgress(metrics: Record<JourneyMetric, number>): { milestone: JourneyMilestone; value: number; done: boolean }[] {
  return JOURNEY_MILESTONES.map((m) => ({ milestone: m, value: Math.min(metrics[m.metric], m.target), done: metrics[m.metric] >= m.target }));
}

export function reachedMilestones(metrics: Record<JourneyMetric, number>): string[] {
  return JOURNEY_MILESTONES.filter((m) => metrics[m.metric] >= m.target).map((m) => m.id);
}

