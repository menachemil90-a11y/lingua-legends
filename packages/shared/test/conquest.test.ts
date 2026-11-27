import { describe, expect, it } from 'vitest';
import {
  answerQuestion,
  applyAction,
  botNextAction,
  CONQUEST,
  createConquest,
  currentPlayer,
  ownedBy,
  previewAttack,
  type ConquestState,
} from '../src/rules/conquest';
import { seededRandom } from '../src/random';

const two = () => createConquest([
  { id: 'p1', name: 'Ada', isBot: false },
  { id: 'p2', name: 'Bot', isBot: true },
]);

describe('English Conquest rules', () => {
  it('starts with capitals, income and a question phase', () => {
    const s = two();
    expect(ownedBy(s, 'p1')).toEqual(['a0']);
    expect(ownedBy(s, 'p2')).toEqual(['c3']);
    expect(s.phase).toBe('question');
    expect(currentPlayer(s).gold).toBe(CONQUEST.startGold + 3);
  });

  it('rewards correct answers with gold and focus', () => {
    const s = answerQuestion(two(), true);
    expect(currentPlayer(s).gold).toBe(CONQUEST.startGold + 3 + CONQUEST.correctGold);
    expect(currentPlayer(s).focus).toBe(1);
    expect(s.actionsLeft).toBe(CONQUEST.actionsPerTurn);
  });

  it('rejects invalid actions', () => {
    const s = answerQuestion(two(), false);
    expect(applyAction(s, { type: 'recruit', at: 'c3' })).toMatchObject({ ok: false });
    expect(applyAction(s, { type: 'attack', from: 'a0', to: 'c3', troops: 1, useFocus: false })).toMatchObject({ ok: false });
    expect(applyAction(s, { type: 'attack', from: 'a0', to: 'a1', troops: 3, useFocus: false })).toMatchObject({ ok: false });
  });

  it('resolves attacks deterministically and the preview matches the result', () => {
    let s = answerQuestion(two(), true);
    const r1 = applyAction(s, { type: 'recruit', at: 'a0' });
    if (!r1.ok) throw new Error(r1.error);
    s = r1.state;
    const pv = previewAttack(s, 'a0', 'a1', 3, true);
    expect(pv).toMatchObject({ attackPower: 5, defensePower: 2, success: true });
    const r2 = applyAction(s, { type: 'attack', from: 'a0', to: 'a1', troops: 3, useFocus: true });
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.state.territories.a1).toMatchObject({ owner: 'p1', troops: pv.occupy });
    expect(currentPlayer(r2.state).focus).toBe(0);
    const fail = previewAttack(r2.state, 'a0', 'b0', 0, false);
    expect(fail.success).toBe(false);
  });

  it('bot games always terminate with consistent state', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const rand = seededRandom(seed);
      let s: ConquestState = createConquest([
        { id: 'b1', name: 'A', isBot: true },
        { id: 'b2', name: 'B', isBot: true },
        { id: 'b3', name: 'C', isBot: true },
      ]);
      let guard = 0;
      while (s.phase !== 'ended' && guard++ < 2000) {
        if (s.phase === 'question') s = answerQuestion(s, rand() < 0.7);
        else {
          const r = applyAction(s, botNextAction(s, rand));
          if (!r.ok) throw new Error(r.error);
          s = r.state;
        }
        for (const t of Object.values(s.territories)) expect(t.troops).toBeGreaterThanOrEqual(1);
        for (const p of s.players) expect(p.gold).toBeGreaterThanOrEqual(0);
      }
      expect(s.phase).toBe('ended');
      expect(s.round).toBeLessThanOrEqual(CONQUEST.maxRounds);
    }
  });
});
