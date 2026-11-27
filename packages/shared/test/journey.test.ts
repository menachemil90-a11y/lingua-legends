import { describe, expect, it } from 'vitest';
import { COSMETICS } from '../src/catalog';
import { JOURNEY_MILESTONES, journeyProgress, reachedMilestones } from '../src/progression';

describe('learning journey', () => {
  it('reaches milestones only from real progress, and never loses them', () => {
    expect(reachedMilestones({ words: 0, grammar: 0, modes: 0, days: 0 })).toEqual([]);
    expect(reachedMilestones({ words: 60, grammar: 5, modes: 5, days: 7 }).sort()).toEqual(['days-7', 'explorer-5', 'grammar-5', 'words-25', 'words-50'].sort());
    const p = journeyProgress({ words: 30, grammar: 0, modes: 2, days: 1 });
    expect(p.find((x) => x.milestone.id === 'words-50')).toMatchObject({ value: 30, done: false });
    expect(p.find((x) => x.milestone.id === 'words-25')).toMatchObject({ value: 25, done: true });
  });

  it('every milestone except words-25 unlocks at least one cosmetic, and ids are unique', () => {
    const ids = JOURNEY_MILESTONES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      const rewards = COSMETICS.filter((c) => c.unlock.kind === 'achievement' && c.unlock.achievementId === id);
      if (id !== 'words-25') expect(rewards.length, id).toBeGreaterThan(0);
    }
  });
});
