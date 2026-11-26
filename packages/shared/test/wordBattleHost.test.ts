import { describe, expect, it } from 'vitest';
import { FakeClock, type MatchOutcome } from '../src/hosts/common';
import { WordBattleHost } from '../src/hosts/wordBattleHost';
import { computeDamage, WORD_BATTLE } from '../src/rules/wordBattle';
import { seededRandom } from '../src/random';
import { BotController, makeBotProfile } from '../src/bots';
import { fixedSource, mcItem, players, Recorder } from './fixtures';

function setup() {
  const clock = new FakeClock();
  const rec = new Recorder();
  let outcome: MatchOutcome | null = null;
  const host = new WordBattleHost({
    matchId: 'm1',
    players: players(),
    clock,
    questions: fixedSource([mcItem('q1')]),
    emit: rec.emit,
    random: seededRandom(7),
    onEnd: (o) => (outcome = o),
  });
  host.start();
  clock.advance(WORD_BATTLE.countdownMs);
  const correctOption = (roundId: string) => host.peekRound(roundId)!.key.correctOptionIds![0]!;
  const wrongOption = (roundId: string) =>
    host.peekRound(roundId)!.question.options!.find((o) => o.id !== correctOption(roundId))!.id;
  return { clock, rec, host, correctOption, wrongOption, getOutcome: () => outcome as MatchOutcome | null };
}

describe('computeDamage', () => {
  it('gives a modest speed bonus and prioritises accuracy', () => {
    expect(computeDamage(0, 12000, false).damage).toBe(14);
    expect(computeDamage(12000, 12000, false).damage).toBe(10);
    expect(computeDamage(6000, 12000, false).damage).toBe(12);
    expect(computeDamage(0, 12000, true).damage).toBe(25);
  });
});

describe('WordBattleHost', () => {
  it('never sends the answer key in ROUND_START', () => {
    const { rec } = setup();
    const round = rec.last('ROUND_START');
    const json = JSON.stringify(round);
    expect(json).not.toContain('acceptedAnswers');
    expect(json).not.toContain('explanation');
    expect(round.question.options).toHaveLength(4);
  });

  it('applies damage from a correct answer and rejects duplicates', () => {
    const { rec, host, correctOption, wrongOption, clock } = setup();
    const r = rec.last('ROUND_START');
    clock.advance(3000);
    expect(host.submitAnswer('p1', r.roundId, { kind: 'option', optionId: correctOption(r.roundId) }).ok).toBe(true);
    const dup = host.submitAnswer('p1', r.roundId, { kind: 'option', optionId: wrongOption(r.roundId) });
    expect(dup).toMatchObject({ ok: false, code: 'DUPLICATE' });
    host.submitAnswer('p2', r.roundId, { kind: 'option', optionId: wrongOption(r.roundId) });
    const state = rec.last('PLAYER_STATE');
    if (state.state.mode !== 'word-battle') throw new Error('mode');
    const p2 = state.state.players.find((p) => p.playerId === 'p2')!;
    // 3s into a 12s round: bonus round(4 * 0.75) = 3
    expect(p2.hp).toBe(100 - 13);
    const result = rec.last('ANSWER_RESULT', 'p2');
    expect(result.results.find((x) => x.playerId === 'p2')!.correct).toBe(false);
    expect(result.correctAnswer).toBe('goes');
  });

  it('rejects answers for a stale round and from non-players', () => {
    const { rec, host, correctOption } = setup();
    const r = rec.last('ROUND_START');
    expect(host.submitAnswer('intruder', r.roundId, { kind: 'option', optionId: 'a' })).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(host.submitAnswer('p1', 'm1-r99', { kind: 'option', optionId: correctOption(r.roundId) })).toMatchObject({ ok: false, code: 'STALE_ROUND' });
  });

  it('charges an ability after three consecutive correct answers and shield blocks', () => {
    const { rec, host, correctOption, wrongOption, clock } = setup();
    for (let i = 0; i < 3; i++) {
      const r = rec.last('ROUND_START');
      host.submitAnswer('p1', r.roundId, { kind: 'option', optionId: correctOption(r.roundId) });
      host.submitAnswer('p2', r.roundId, { kind: 'option', optionId: wrongOption(r.roundId) });
      clock.advance(WORD_BATTLE.resolveMs);
    }
    let st = rec.last('PLAYER_STATE');
    if (st.state.mode !== 'word-battle') throw new Error();
    expect(st.state.players.find((p) => p.playerId === 'p1')!.abilityCharged).toBe(true);
    expect(host.useAbility('p2', 'shield')).toMatchObject({ ok: false });
    expect(host.useAbility('p1', 'shield').ok).toBe(true);
    // p2 attacks into the shield
    const r = rec.last('ROUND_START');
    host.submitAnswer('p2', r.roundId, { kind: 'option', optionId: correctOption(r.roundId) });
    host.submitAnswer('p1', r.roundId, { kind: 'option', optionId: wrongOption(r.roundId) });
    const combat = rec.last('COMBAT_EVENT');
    expect(combat.events.some((e) => e.kind === 'blocked' && e.from === 'p2')).toBe(true);
    st = rec.last('PLAYER_STATE');
    if (st.state.mode !== 'word-battle') throw new Error();
    expect(st.state.players.find((p) => p.playerId === 'p1')!.hp).toBe(100);
  });

  it('ends by KO and reports the winner', () => {
    const { rec, host, correctOption, wrongOption, clock, getOutcome } = setup();
    for (let i = 0; i < 12 && !getOutcome(); i++) {
      const r = rec.last('ROUND_START');
      host.submitAnswer('p1', r.roundId, { kind: 'option', optionId: correctOption(r.roundId) });
      host.submitAnswer('p2', r.roundId, { kind: 'option', optionId: wrongOption(r.roundId) });
      clock.advance(WORD_BATTLE.resolveMs);
    }
    const o = getOutcome();
    expect(o?.reason).toBe('ko');
    expect(o?.winnerId).toBe('p1');
    expect(o?.stats.find((s) => s.playerId === 'p1')!.correct).toBeGreaterThanOrEqual(7);
  });

  it('ends by timeout as a draw when HP is equal', () => {
    const { clock, getOutcome } = setup();
    clock.advance(WORD_BATTLE.matchMs + 60_000);
    const o = getOutcome();
    expect(o?.reason).toBe('timeout');
    expect(o?.winnerId).toBeNull();
    expect(o?.outcomes.every((x) => x.result === 'draw')).toBe(true);
  });

  it('forfeits a player who stays disconnected past the grace period', () => {
    const { host, clock, getOutcome } = setup();
    host.setConnected('p2', false);
    clock.advance(WORD_BATTLE.disconnectGraceMs + 10);
    expect(getOutcome()?.reason).toBe('forfeit');
    expect(getOutcome()?.winnerId).toBe('p1');
  });

  it('keeps the match when a player reconnects within the grace period', () => {
    const { host, clock, getOutcome } = setup();
    host.setConnected('p2', false);
    clock.advance(5_000);
    host.setConnected('p2', true);
    const snap = host.snapshot('p2');
    expect(snap.some((m) => m.type === 'MATCH_START')).toBe(true);
    clock.advance(WORD_BATTLE.disconnectGraceMs);
    expect(getOutcome()?.reason).not.toBe('forfeit');
  });

  it('plays a full match against a bot without errors', () => {
    const clock = new FakeClock();
    const random = seededRandom(3);
    let outcome: MatchOutcome | null = null;
    let bot: BotController | null = null;
    const host = new WordBattleHost({
      matchId: 'm2',
      players: players(),
      clock,
      questions: fixedSource([mcItem('q1'), mcItem('q2')]),
      emit: (to, msg) => {
        if (to === null || to === 'p2') bot?.handle(msg);
      },
      random,
      onEnd: (o) => (outcome = o),
    });
    bot = new BotController(host, 'p2', makeBotProfile('veteran', 'A2'), clock, random);
    host.start();
    clock.advance(WORD_BATTLE.matchMs + 30_000);
    expect(outcome).not.toBeNull();
    const o = outcome as unknown as MatchOutcome;
    expect(o.stats.find((s) => s.playerId === 'p2')!.correct).toBeGreaterThan(0);
  });
});
