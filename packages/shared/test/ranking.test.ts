import { describe, expect, it } from 'vitest';
import { applyResult, newRatingState, rankFromRating, PLACEMENT_MATCHES, matchmakingWindow } from '../src/ranking';
import { levelFromXp, xpForLevel } from '../src/progression';
import { clientMessageSchema } from '../src/protocol';

describe('ranking', () => {
  it('maps ratings to tiers and divisions', () => {
    expect(rankFromRating(0).label).toBe('Bronze III');
    expect(rankFromRating(1000).label).toBe('Silver II');
    expect(rankFromRating(2050).label).toBe('Diamond I');
    expect(rankFromRating(2200).tier).toBe('master');
    expect(rankFromRating(2500).tier).toBe('legend');
  });

  it('is zero-sum for equal ratings and tracks placement', () => {
    const a = newRatingState();
    const { next, change } = applyResult(a, 1000, 1);
    expect(change.delta).toBe(32);
    expect(next.games).toBe(1);
    expect(change.placement).toEqual({ played: 1, total: PLACEMENT_MATCHES });
    const draw = applyResult(a, 1000, 0.5);
    expect(draw.change.delta).toBe(0);
  });

  it('widens the matchmaking window over time', () => {
    expect(matchmakingWindow(0, true)).toBeLessThan(matchmakingWindow(10_000, true));
    expect(matchmakingWindow(10_000_000, true)).toBe(600);
  });
});

describe('progression', () => {
  it('computes levels from XP', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(xpForLevel(5)).level).toBe(5);
  });
});

describe('protocol validation', () => {
  it('rejects malformed and oversized messages', () => {
    expect(clientMessageSchema.safeParse({ type: 'ANSWER_SUBMIT', msgId: 'short' }).success).toBe(false);
    expect(clientMessageSchema.safeParse({ type: 'HACK', msgId: 'abcdefgh123' }).success).toBe(false);
    expect(
      clientMessageSchema.safeParse({
        type: 'ANSWER_SUBMIT',
        msgId: 'abcdefgh123',
        matchId: 'm1',
        roundId: 'r1',
        answer: { kind: 'option', optionId: 'a' },
      }).success,
    ).toBe(true);
    // Clients cannot send a damage or score field that is respected — unknown keys are stripped.
    const parsed = clientMessageSchema.parse({
      type: 'ANSWER_SUBMIT',
      msgId: 'abcdefgh123',
      matchId: 'm1',
      roundId: 'r1',
      answer: { kind: 'option', optionId: 'a' },
      damage: 999,
    });
    expect('damage' in parsed).toBe(false);
  });
});
