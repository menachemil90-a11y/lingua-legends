import { describe, expect, it } from 'vitest';
import type { ContentItem } from '@lingua/shared';
import { buildMistakeReview } from '../src';
import { seededRandom } from '@lingua/shared';

const item = (id: string, level: ContentItem['level'], grammar: string[], vocabulary: string[] = []): ContentItem =>
  ({
    id,
    version: 1,
    level,
    tags: { grammar, vocabulary, bagrut: [] },
  }) as unknown as ContentItem;

const pool = [
  item('a', 'B1', ['present-perfect']),
  item('b', 'B1', ['present-perfect']),
  item('c', 'B2', ['present-perfect', 'since-for']),
  item('d', 'C2', ['present-perfect']),
  item('e', 'B1', ['articles']),
  item('f', 'A2', [], ['travel']),
];

describe('buildMistakeReview', () => {
  it('replays public items first and then adds similar items at a nearby level', () => {
    const out = buildMistakeReview(pool, [{ itemId: 'a', level: 'B1', tags: ['g:present-perfect', 'g:since-for'] }], { count: 3, random: seededRandom(1) });
    expect(out.map((i) => i.id)[0]).toBe('a');
    expect(out.map((i) => i.id)).toEqual(['a', 'c', 'b']);
    // C2 is more than one level away from B1, so it is never chosen.
    expect(out.map((i) => i.id)).not.toContain('d');
  });

  it('replaces server-only ranked items with public items sharing knowledge components', () => {
    const out = buildMistakeReview(pool, [{ itemId: 'rk-secret', level: 'A2', tags: ['v:travel'] }], { random: seededRandom(2) });
    expect(out.map((i) => i.id)).toEqual(['f']);
  });

  it('returns nothing when no public item matches', () => {
    expect(buildMistakeReview(pool, [{ itemId: 'zzz', level: 'A1', tags: ['g:unknown'] }])).toEqual([]);
  });
});
