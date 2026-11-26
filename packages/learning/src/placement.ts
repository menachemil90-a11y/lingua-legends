/**
 * Short adaptive placement test (default 12 items: 4 vocabulary, 4 grammar, 4 reading).
 * Uses a per-skill staircase and a high-gain ability update. Results are estimates
 * only — never presented as certification — and the test is optional.
 */
import { cefrFromIndex, cefrIndex, itemDifficultyLogit, type CefrLevel, type ContentItem, type RandomFn, type Skill } from '@lingua/shared';
import { successProbability } from './engine';
import type { LearnerProfile } from './types';

export const PLACEMENT_SKILLS: Skill[] = ['vocabulary', 'grammar', 'reading'];

interface Track {
  skill: Skill;
  levelIdx: number;
  theta: number;
  answered: number;
  correct: number;
}

export class PlacementSession {
  private readonly pool: ContentItem[];
  private readonly tracks: Track[];
  private readonly order: Skill[];
  private readonly used = new Set<string>();
  private cursor = 0;
  private currentItem: ContentItem | null = null;
  private readonly random: RandomFn;

  constructor(pool: readonly ContentItem[], opts: { random: RandomFn; startLevel?: CefrLevel; perSkill?: number }) {
    this.pool = pool.filter((i) => i.grading.mode === 'option');
    this.random = opts.random;
    const start = cefrIndex(opts.startLevel ?? 'B1');
    this.tracks = PLACEMENT_SKILLS.map((skill) => ({ skill, levelIdx: start, theta: -2.5 + start, answered: 0, correct: 0 }));
    const per = opts.perSkill ?? 4;
    this.order = [];
    for (let i = 0; i < per; i++) this.order.push(...PLACEMENT_SKILLS);
    this.advance();
  }

  get total(): number {
    return this.order.length;
  }
  get answered(): number {
    return this.cursor;
  }
  current(): ContentItem | null {
    return this.currentItem;
  }
  isDone(): boolean {
    return this.currentItem === null;
  }

  private advance(): void {
    while (this.cursor < this.order.length) {
      const skill = this.order[this.cursor]!;
      const track = this.tracks.find((t) => t.skill === skill)!;
      const item = this.findItem(skill, track.levelIdx);
      if (item) {
        this.currentItem = item;
        this.used.add(item.id);
        return;
      }
      this.cursor++;
    }
    this.currentItem = null;
  }

  private findItem(skill: Skill, levelIdx: number): ContentItem | null {
    for (const delta of [0, -1, 1, -2, 2, -3, 3]) {
      const level = cefrFromIndex(levelIdx + delta);
      if (cefrIndex(level) !== levelIdx + delta) continue;
      const options = this.pool.filter(
        (i) => !this.used.has(i.id) && i.level === level && (i.primarySkill === skill || (skill === 'reading' && i.primarySkill === 'inference')),
      );
      const preferred = options.filter((i) => i.modes.includes('placement'));
      const list = preferred.length > 0 ? preferred : options;
      if (list.length > 0) return list[Math.floor(this.random() * list.length)]!;
    }
    return null;
  }

  answer(correct: boolean): void {
    const item = this.currentItem;
    if (!item) return;
    const skill = this.order[this.cursor]!;
    const track = this.tracks.find((t) => t.skill === skill)!;
    const b = itemDifficultyLogit(item.level, item.difficulty);
    const p = successProbability(track.theta, b);
    track.theta += 0.9 * ((correct ? 1 : 0) - p);
    track.answered++;
    if (correct) track.correct++;
    track.levelIdx = Math.max(0, Math.min(5, track.levelIdx + (correct ? 1 : -1)));
    this.cursor++;
    this.advance();
  }

  result(): { estimates: Partial<Record<Skill, CefrLevel>>; thetas: Partial<Record<Skill, number>>; answered: number } {
    const estimates: Partial<Record<Skill, CefrLevel>> = {};
    const thetas: Partial<Record<Skill, number>> = {};
    for (const t of this.tracks) {
      if (t.answered === 0) continue;
      thetas[t.skill] = t.theta;
      estimates[t.skill] = cefrFromIndex(t.theta + 2.5);
    }
    return { estimates, thetas, answered: this.cursor };
  }

  /** Writes the placement estimates into the learner profile. */
  applyTo(profile: LearnerProfile, now: number): LearnerProfile {
    const { estimates, thetas, answered } = this.result();
    const abilities = { ...profile.abilities };
    for (const t of this.tracks) {
      if (t.answered === 0) continue;
      const prev = abilities[t.skill];
      abilities[t.skill] = {
        skill: t.skill,
        theta: thetas[t.skill]!,
        n: (prev?.n ?? 0) + t.answered,
        correct: (prev?.correct ?? 0) + t.correct,
      };
    }
    return { ...profile, abilities, placement: { completedAt: now, itemsAnswered: answered, estimates } };
  }
}
