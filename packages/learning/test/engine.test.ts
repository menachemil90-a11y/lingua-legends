import { describe, expect, it } from 'vitest';
import { contentItemSchema, seededRandom, type ContentItem } from '@lingua/shared';
import {
  createLearnerProfile,
  dueReviews,
  estimateSkill,
  eventFromItem,
  recordEvent,
  selectItems,
  weakTopics,
} from '../src/engine';
import { DAY, expandingIntervalScheduler, MINUTE } from '../src/scheduler';
import { PlacementSession } from '../src/placement';

function item(id: string, level: ContentItem['level'], vocab: string[], skill: ContentItem['primarySkill'] = 'vocabulary', category: ContentItem['category'] = 'connector'): ContentItem {
  return contentItemSchema.parse({
    id,
    version: 1,
    level,
    primarySkill: skill,
    difficulty: 3,
    type: 'multiple-choice',
    category,
    prompt: `Prompt ${id}`,
    options: [
      { id: 'a', text: 'right' },
      { id: 'b', text: 'wrong' },
    ],
    acceptedAnswers: ['a'],
    grading: { mode: 'option' },
    explanation: { en: 'x', he: 'x' },
    tags: { vocabulary: vocab, grammar: [] },
    modes: ['practice'],
    reviewStatus: 'reviewed',
  });
}

let seq = 0;
function answer(profile: ReturnType<typeof createLearnerProfile>, it: ContentItem, correct: boolean, t: number, mode: 'word-battle' | 'sentence-master' = 'word-battle') {
  return recordEvent(profile, eventFromItem(it, { id: `e${++seq}`, playerId: 'p', mode, correct, responseMs: 4000, timestamp: t, timeLimitMs: 12000 }));
}

describe('scheduler', () => {
  it('expands intervals on repeated success and shrinks on failure', () => {
    const s0 = expandingIntervalScheduler.create('v:although', 0);
    const ok = (s: typeof s0, t: number) => expandingIntervalScheduler.update(s, { correct: true, speedRatio: 0.5, hintUsed: false, itemId: 'x', mode: 'm' }, t);
    const s1 = ok(s0, 0);
    const s2 = ok(s1, s1.dueAt);
    const s3 = ok(s2, s2.dueAt);
    expect(s1.intervalMs).toBe(DAY);
    expect(s2.intervalMs).toBe(3 * DAY);
    expect(s3.intervalMs).toBeGreaterThan(s2.intervalMs);
    const fail = expandingIntervalScheduler.update(s3, { correct: false, speedRatio: null, hintUsed: false, itemId: 'x', mode: 'm' }, s3.dueAt);
    expect(fail.intervalMs).toBe(10 * MINUTE);
    expect(fail.ease).toBeLessThan(s3.ease);
  });
});

describe('learning engine', () => {
  const a1 = item('although-1', 'B1', ['although']);
  const a2 = item('although-2', 'B1', ['although'], 'grammar', 'sentence-completion');
  const others = Array.from({ length: 20 }, (_, i) => item(`other-${i}`, 'B1', [`w${i}`]));
  const pool = [a1, a2, ...others];

  it('brings a missed word back in a different context', () => {
    let p = createLearnerProfile('p', 'B1');
    p = answer(p, a1, false, 0);
    expect(dueReviews(p, 5 * MINUTE)).toHaveLength(0);
    expect(dueReviews(p, 11 * MINUTE).map((r) => r.tag)).toContain('v:although');
    const picks = selectItems(pool, p, { count: 5, now: 11 * MINUTE, random: seededRandom(1), reviewShare: 0.4 });
    // The review uses the *other* item that tests "although".
    expect(picks.map((i) => i.id)).toContain('although-2');
  });

  it('tracks mastery and weak topics', () => {
    let p = createLearnerProfile('p', 'B1');
    p = answer(p, a1, false, 0);
    p = answer(p, a2, false, 1000);
    expect(weakTopics(p).map((m) => m.tag)).toContain('v:although');
    for (let i = 0; i < 5; i++) p = answer(p, i % 2 ? a1 : a2, true, 10_000 + i * DAY * 4);
    expect(p.mastery['v:although']!.mastery).toBeGreaterThan(0.6);
  });

  it('does not invent proficiency without evidence', () => {
    let p = createLearnerProfile('p');
    expect(estimateSkill(p, 'vocabulary').status).toBe('not-assessed');
    expect(estimateSkill(p, 'speaking').status).toBe('not-assessed');
    for (let i = 0; i < 8; i++) p = answer(p, others[i]!, true, i * 1000);
    const est = estimateSkill(p, 'vocabulary');
    expect(est.status).toBe('estimated');
    expect(estimateSkill(p, 'speaking').status).toBe('not-assessed');
  });

  it('avoids recently seen items when alternatives exist', () => {
    let p = createLearnerProfile('p', 'B1');
    for (let i = 0; i < 5; i++) p = answer(p, others[i]!, true, i);
    const picks = selectItems(others, p, { count: 5, now: 10, random: seededRandom(2), reviewShare: 0 });
    expect(picks.filter((x) => p.recentItems.includes(x.id))).toHaveLength(0);
  });
});

describe('placement', () => {
  it('moves up for a strong player and down for a weak one', () => {
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
    const pool: ContentItem[] = [];
    for (const lvl of levels)
      for (const skill of ['vocabulary', 'grammar', 'reading'] as const)
        for (let k = 0; k < 3; k++) pool.push(item(`${lvl}-${skill}-${k}`.toLowerCase(), lvl, [], skill));
    const strong = new PlacementSession(pool, { random: seededRandom(1) });
    while (!strong.isDone()) strong.answer(true);
    const weak = new PlacementSession(pool, { random: seededRandom(1) });
    while (!weak.isDone()) weak.answer(false);
    const s = strong.result().estimates.vocabulary!;
    const w = weak.result().estimates.vocabulary!;
    expect(levels.indexOf(s)).toBeGreaterThan(levels.indexOf(w));
    expect(strong.result().answered).toBe(12);
    const applied = strong.applyTo(createLearnerProfile('p'), 0);
    expect(estimateSkill(applied, 'grammar').status).toBe('estimated');
  });
});
