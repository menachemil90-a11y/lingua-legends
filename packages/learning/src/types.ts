import type { CefrLevel, ContentConsumer, ErrorCategory, Skill } from '@lingua/shared';

/** One answer to one content item, from any game mode. */
export interface LearningEvent {
  id: string;
  playerId: string;
  itemId: string;
  itemVersion?: number;
  mode: ContentConsumer;
  correct: boolean;
  /** Server- or host-measured response time; null if unanswered. */
  responseMs: number | null;
  /** 1 for the first attempt on the item in this context. */
  attempt: number;
  hintUsed: boolean;
  timestamp: number;
  errorCategory?: ErrorCategory;
  level: CefrLevel;
  difficulty?: number;
  primarySkill: Skill;
  secondarySkills: Skill[];
  /** Knowledge components ("v:although", "g:present-perfect"). */
  tags: string[];
  category: string;
  timeLimitMs?: number;
}

/** Spaced-repetition state for one knowledge component. */
export interface ReviewState {
  tag: string;
  intervalMs: number;
  ease: number;
  dueAt: number;
  reps: number;
  lapses: number;
  lastSeenAt: number;
  lastItemId: string;
  lastMode: string;
  lastCorrect: boolean;
}

export interface MasteryState {
  tag: string;
  /** 0..1 estimate of how reliably the player recalls/applies this component. */
  mastery: number;
  attempts: number;
  correct: number;
  lastSeenAt: number;
}

export interface SkillAbility {
  skill: Skill;
  /** Ability on the item-difficulty logit scale (see itemDifficultyLogit). */
  theta: number;
  n: number;
  correct: number;
}

export interface PlacementRecord {
  completedAt: number;
  itemsAnswered: number;
  estimates: Partial<Record<Skill, CefrLevel>>;
}

export interface LearnerProfile {
  version: 1;
  playerId: string;
  abilities: Partial<Record<Skill, SkillAbility>>;
  mastery: Record<string, MasteryState>;
  reviews: Record<string, ReviewState>;
  errors: Partial<Record<ErrorCategory, number>>;
  /** Most recent item ids, newest last (bounded). */
  recentItems: string[];
  /** Bounded local history of learning events, newest last. */
  history: LearningEvent[];
  placement: PlacementRecord | null;
  /** Level the player chose for themselves before any assessment. */
  selfReportedLevel: CefrLevel | null;
  totalEvents: number;
}

export type ProficiencyEstimate =
  | { status: 'not-assessed'; skill: Skill; n: number }
  | {
      status: 'estimated';
      skill: Skill;
      level: CefrLevel;
      confidence: 'low' | 'medium' | 'high';
      theta: number;
      n: number;
    };
