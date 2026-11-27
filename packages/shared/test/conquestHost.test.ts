import { describe, expect, it } from 'vitest';
import { FakeClock, type MatchOutcome } from '../src/hosts/common';
import { CONQUEST_ONLINE, ConquestHost } from '../src/hosts/conquestHost';
import { CONQUEST, CONQUEST_MAP, currentPlayer, previewAttack } from '../src/rules/conquest';
import { seededRandom } from '../src/random';
import { clientMessageSchema } from '../src/protocol';
import { fixedSource, mcItem, Recorder } from './fixtures';
import type { PublicPlayer } from '../src/protocol';

const three = (): PublicPlayer[] => [
  { playerId: 'p1', nickname: 'Ada', isBot: false, characterId: 'vexa', vehicleId: 'comet' },
  { playerId: 'p2', nickname: 'Ben', isBot: false, characterId: 'kael', vehicleId: 'viper' },
  { playerId: 'p3', nickname: 'Cy', isBot: false, characterId: 'nyra', vehicleId: 'aurum' },
];

function setup(n = 3) {
  const clock = new FakeClock();
  const rec = new Recorder();
  let outcome: MatchOutcome | null = null;
  const host = new ConquestHost({
    matchId: 'cq1',
    players: three().slice(0, n),
    clock,
    questions: fixedSource([mcItem('q1'), mcItem('q2')]),
    emit: rec.emit,
    random: seededRandom(3),
    onEnd: (o) => (outcome = o),
  });
  host.start();
  clock.advance(CONQUEST_ONLINE.countdownMs);
  const correct = (roundId: string) => host.peekRound(roundId)!.key.correctOptionIds![0]!;
  const wrong = (roundId: string) => host.peekRound(roundId)!.question.options!.find((o) => o.id !== correct(roundId))!.id;
  return { clock, rec, host, correct, wrong, outcome: () => outcome as MatchOutcome | null };
}

describe('ConquestHost', () => {
  it('sends the question only to the active player and never the answer key', () => {
    const { rec } = setup();
    const starts = rec.all.filter((e) => e.msg.type === 'ROUND_START');
    expect(starts).toHaveLength(1);
    expect(starts[0]!.to).toBe('p1');
    const json = JSON.stringify(starts[0]!.msg);
    expect(json).not.toContain('acceptedAnswers');
    expect(json).not.toContain('explanation');
  });

  it('rejects answers and actions from players whose turn it is not', () => {
    const { rec, host, correct } = setup();
    const q = rec.last('ROUND_START', 'p1');
    expect(host.submitAnswer('p2', q.roundId, { kind: 'option', optionId: correct(q.roundId) })).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(host.submitAction('p1', { type: 'end' })).toMatchObject({ ok: false, code: 'INVALID_STATE' });
    host.submitAnswer('p1', q.roundId, { kind: 'option', optionId: correct(q.roundId) });
    expect(host.submitAction('p2', { type: 'end' })).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });

  it('a correct answer grants gold and focus, then actions are validated by the rules', () => {
    const { rec, host, correct } = setup();
    const q = rec.last('ROUND_START', 'p1');
    const goldBefore = host.state.players[0]!.gold;
    expect(host.submitAnswer('p1', q.roundId, { kind: 'option', optionId: correct(q.roundId) }).ok).toBe(true);
    expect(host.submitAnswer('p1', q.roundId, { kind: 'option', optionId: correct(q.roundId) })).toMatchObject({ ok: false });
    expect(host.state.players[0]!.gold).toBe(goldBefore + CONQUEST.correctGold);
    expect(host.state.players[0]!.focus).toBe(1);
    const res = rec.last('ANSWER_RESULT', 'p1');
    expect(res.results[0]).toMatchObject({ playerId: 'p1', correct: true });
    // Illegal: p1 does not own c3.
    expect(host.submitAction('p1', { type: 'recruit', at: 'c3' })).toMatchObject({ ok: false, code: 'INVALID_STATE' });
    expect(host.submitAction('p1', { type: 'recruit', at: 'a0' }).ok).toBe(true);
    expect(host.state.territories.a0!.troops).toBe(CONQUEST.capitalTroops + 1);
    // Ending the turn passes the question to the next player.
    expect(host.submitAction('p1', { type: 'end' }).ok).toBe(true);
    expect(currentPlayer(host.state).id).toBe('p2');
    expect(rec.last('ROUND_START', 'p2').roundId).not.toBe(q.roundId);
  });

  it('times out an unanswered question and an idle action phase', () => {
    const { rec, host, clock } = setup();
    const q = rec.last('ROUND_START', 'p1');
    clock.advance(q.deadline - clock.now() + 1000);
    expect(host.state.phase).toBe('actions');
    expect(host.state.players[0]!.questionsAnswered).toBe(1);
    expect(host.state.players[0]!.correctAnswers).toBe(0);
    clock.advance(CONQUEST_ONLINE.answerRevealMs + CONQUEST_ONLINE.actionPhaseMs + 1000);
    expect(currentPlayer(host.state).id).toBe('p2');
  });

  it('skips a disconnected player quickly and lets a leaver go while the others keep playing', () => {
    const { rec, host, clock, correct } = setup();
    const q = rec.last('ROUND_START', 'p1');
    host.submitAnswer('p1', q.roundId, { kind: 'option', optionId: correct(q.roundId) });
    host.setConnected('p2', false);
    host.submitAction('p1', { type: 'end' });
    // p2 is away: their turn is skipped after a short wait, without a question being sent to them.
    expect(rec.of('ROUND_START').filter((m) => rec.all.find((e) => e.msg === m)?.to === 'p2')).toHaveLength(0);
    clock.advance(CONQUEST_ONLINE.disconnectedTurnMs + CONQUEST_ONLINE.answerRevealMs + 100);
    expect(currentPlayer(host.state).id).toBe('p3');
    // p3 leaves: their islands turn neutral and the game continues between p1 and p2.
    host.forfeit('p3');
    expect(host.state.players[2]!.alive).toBe(false);
    expect(Object.values(host.state.territories).some((t) => t.owner === 'p3')).toBe(false);
    expect(host.isEnded()).toBe(false);
    expect(currentPlayer(host.state).id).toBe('p1');
  });

  it('ends with a forfeit win when only one player remains', () => {
    const { host, outcome } = setup(2);
    host.forfeit('p2');
    const o = outcome()!;
    expect(o.reason).toBe('forfeit');
    expect(o.winnerId).toBe('p1');
    expect(o.forfeited).toEqual(['p2']);
    expect(o.outcomes).toEqual([
      { playerId: 'p1', result: 'win' },
      { playerId: 'p2', result: 'loss' },
    ]);
  });

  it('plays a full game to a decision with every action validated', () => {
    const { rec, host, clock, correct, outcome } = setup(2);
    let attacks = 0;
    for (let guard = 0; guard < 2000 && !host.isEnded(); guard++) {
      const cur = currentPlayer(host.state).id;
      if (host.state.phase === 'question') {
        const q = rec.last('ROUND_START', cur);
        host.submitAnswer(cur, q.roundId, { kind: 'option', optionId: correct(q.roundId) });
        clock.advance(10);
        continue;
      }
      // Policy: attack any neighbour the preview says we can take, else recruit, else end.
      const s = host.state;
      let acted = false;
      for (const [from, t] of Object.entries(s.territories)) {
        if (acted || t.owner !== cur || t.troops < 2) continue;
        for (const to of CONQUEST_MAP.find((m) => m.id === from)!.neighbors) {
          if (s.territories[to]!.owner === cur) continue;
          if (previewAttack(s, from, to, t.troops - 1, true).success) {
            expect(host.submitAction(cur, { type: 'attack', from, to, troops: t.troops - 1, useFocus: true }).ok).toBe(true);
            attacks++;
            acted = true;
            break;
          }
        }
      }
      if (!acted) {
        const mine = Object.entries(s.territories).find(([, t]) => t.owner === cur)![0];
        acted = host.submitAction(cur, { type: 'recruit', at: mine }).ok;
      }
      if (!acted) host.submitAction(cur, { type: 'end' });
      clock.advance(10);
    }
    const o = outcome();
    expect(o).not.toBeNull();
    expect(['finish', 'rounds-complete']).toContain(o!.reason);
    expect(o!.stats.every((st) => st.answered >= 1)).toBe(true);
    expect(attacks).toBeGreaterThan(0);
    // Server state agrees with the declared winner.
    if (o!.winnerId) expect(host.state.winnerId).toBe(o!.winnerId);
  });

  it('protocol accepts valid conquest intents and rejects malformed ones', () => {
    const ok = clientMessageSchema.safeParse({ type: 'CONQUEST_ACTION', msgId: 'abcdefgh1', matchId: 'cq1', action: { type: 'attack', from: 'a0', to: 'a1', troops: 2, useFocus: false } });
    expect(ok.success).toBe(true);
    const badTerritory = clientMessageSchema.safeParse({ type: 'CONQUEST_ACTION', msgId: 'abcdefgh2', matchId: 'cq1', action: { type: 'recruit', at: 'zz' } });
    expect(badTerritory.success).toBe(false);
    const badTroops = clientMessageSchema.safeParse({ type: 'CONQUEST_ACTION', msgId: 'abcdefgh3', matchId: 'cq1', action: { type: 'move', from: 'a0', to: 'a1', troops: 0 } });
    expect(badTroops.success).toBe(false);
    const queueConquest = clientMessageSchema.safeParse({ type: 'QUEUE_JOIN', msgId: 'abcdefgh4', mode: 'english-conquest', queue: 'ranked', bracket: 'core' });
    expect(queueConquest.success).toBe(false);
  });
});
