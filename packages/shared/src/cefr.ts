/**
 * CEFR levels, skills and competitive language brackets.
 *
 * Competitive rank and English proficiency are deliberately separate concepts:
 * a *bracket* only decides which language difficulty a match uses, while the
 * competitive rating (MMR) is tracked independently per mode + bracket.
 */

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const CEFR_LABELS: Record<CefrLevel, string> = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper Intermediate',
  C1: 'Advanced',
  C2: 'Proficient',
};

export function cefrIndex(level: CefrLevel): number {
  return CEFR_LEVELS.indexOf(level);
}

export function cefrFromIndex(index: number): CefrLevel {
  const clamped = Math.max(0, Math.min(CEFR_LEVELS.length - 1, Math.round(index)));
  return CEFR_LEVELS[clamped]!;
}

/** Skills tracked independently in the proficiency profile. */
export const SKILLS = [
  'vocabulary',
  'grammar',
  'reading',
  'writing',
  'listening',
  'speaking',
  'pronunciation',
  'fluency',
  'argumentation',
  'inference',
] as const;
export type Skill = (typeof SKILLS)[number];

/** Skills that can currently be measured with deterministic grading. */
export const DETERMINISTIC_SKILLS: readonly Skill[] = ['vocabulary', 'grammar', 'reading', 'inference'];

export const BRACKETS = ['foundation', 'core', 'advanced'] as const;
export type Bracket = (typeof BRACKETS)[number];

export const BRACKET_LEVELS: Record<Bracket, readonly CefrLevel[]> = {
  foundation: ['A1', 'A2'],
  core: ['B1', 'B2'],
  advanced: ['C1', 'C2'],
};

export function bracketForLevel(level: CefrLevel): Bracket {
  if (level === 'A1' || level === 'A2') return 'foundation';
  if (level === 'B1' || level === 'B2') return 'core';
  return 'advanced';
}

/**
 * Item difficulty on a logit-like scale used by the adaptive engine.
 * `difficulty` is the within-level difficulty (1 = easiest, 5 = hardest).
 */
export function itemDifficultyLogit(level: CefrLevel, difficulty: number): number {
  const base = -2.5 + cefrIndex(level);
  return base + (Math.max(1, Math.min(5, difficulty)) - 3) * 0.25;
}
