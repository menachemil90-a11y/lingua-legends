import { describe, expect, it } from 'vitest';
import { FakeClock, type MatchOutcome } from '../src/hosts/common';
import { GrammarRaceHost } from '../src/hosts/grammarRaceHost';
import { SentenceDuelHost } from '../src/hosts/sentenceDuelHost';
import { applyRaceAnswer, GRAMMAR_RACE, newRacer, racePositions, stepRacer } from '../src/rules/grammarRace';
import { seededRandom } from '../src/random';
import { gradeAnswer, prepareRoundQuestion, tokenize } from '../src/content/grading';
import { SENTENCE_MASTER } from '../src/rules/sentenceMaster';
import { fixedSource, mcItem, players, Recorder, sentenceItem } from './fixtures';

describe('race physics', () => {
  it('a careful racer beats a fast guesser', () => {
    const simulate = (answerEveryMs: number, accuracy: number, seed: number) => {
      const r = newRacer();
      const rand = seededRandom(seed);
      let t = 0;
      let nextAnswer = answerEveryMs;
      while (r.finishedAtMs === null && t < 200_000) {
        stepRacer(r, t, 100, 0);
        t += 100;
        if (t >= nextAnswer) {
          applyRaceAnswer(r, rand() < accuracy, t);
          nextAnswer = t + answerEveryMs + GRAMMAR_RACE.feedbackMs;
        }
      }
      return r.finishedAtMs ?? Infinity;
    };
    const careful = simulate(5000, 0.95, 1);
    const fastGuesser = simulate(2500, 0.5, 1);
    expect(careful).toBeLessThan(fastGuesser);
  });

  it('orders finishers by time then distance', () => {
    expect(
      racePositions([
        { playerId: 'a', distance: 800, finishedAtMs: null },
        { playerId: 'b', distance: 1000, finishedAtMs: 90_000 },
        { playerId: 'c', distance: 1000, finishedAtMs: 80_000 },
      ]),
    ).toEqual(['c', 'b', 'a']);
  });
});

describe('GrammarRaceHost', () => {
  it('runs a race to the finish with per-player questions', () => {
    const clock = new FakeClock();
    const rec = new Recorder();
    let outcome: MatchOutcome | null = null;
    const host = new GrammarRaceHost({
      matchId: 'race1',
      players: players(),
      clock,
      questions: fixedSource([mcItem('g1'), mcItem('g2')]),
      emit: rec.emit,
      random: seededRandom(5),
      onEnd: (o) => (outcome = o),
    });
    host.start();
    clock.advance(GRAMMAR_RACE.countdownMs + 10);
    for (let i = 0; i < 400 && !outcome; i++) {
      const q1 = rec.of('ROUND_START', 'p1').pop();
      if (q1) {
        const rq = host.peekRound(q1.roundId);
        if (rq) host.submitAnswer('p1', q1.roundId, { kind: 'option', optionId: rq.key.correctOptionIds![0]! });
      }
      clock.advance(1000);
    }
    expect(outcome).not.toBeNull();
    const o = outcome as unknown as MatchOutcome;
    expect(o.winnerId).toBe('p1');
    expect(o.stats.find((s) => s.playerId === 'p1')!.finishMs).toBeGreaterThan(0);
    // Player 2 never received player 1's questions directly
    expect(rec.all.filter((e) => e.msg.type === 'ROUND_START' && e.to === null)).toHaveLength(0);
  });

  it('rejects duplicate answers for the same question', () => {
    const clock = new FakeClock();
    const rec = new Recorder();
    const host = new GrammarRaceHost({
      matchId: 'race2',
      players: players(),
      clock,
      questions: fixedSource([mcItem('g1')]),
      emit: rec.emit,
      random: seededRandom(5),
      onEnd: () => {},
    });
    host.start();
    clock.advance(GRAMMAR_RACE.countdownMs + 10);
    const q = rec.of('ROUND_START', 'p1').pop()!;
    const opt = host.peekRound(q.roundId)!.key.correctOptionIds![0]!;
    expect(host.submitAnswer('p1', q.roundId, { kind: 'option', optionId: opt }).ok).toBe(true);
    expect(host.submitAnswer('p1', q.roundId, { kind: 'option', optionId: opt })).toMatchObject({ ok: false, code: 'DUPLICATE' });
  });
});

describe('sentence grading', () => {
  it('accepts every listed valid order and rejects others', () => {
    const rq = prepareRoundQuestion(sentenceItem('s1'), 'r1', seededRandom(1));
    const idsFor = (sentence: string) => {
      const pool = rq.question.tiles!.slice();
      return tokenize(sentence).map((tok) => {
        const i = pool.findIndex((t) => t.text.toLowerCase() === tok);
        return pool.splice(i, 1)[0]!.id;
      });
    };
    expect(gradeAnswer(rq, { kind: 'tiles', tileIds: idsFor('I went to the park yesterday') }).correct).toBe(true);
    expect(gradeAnswer(rq, { kind: 'tiles', tileIds: idsFor('Yesterday I went to the park') }).correct).toBe(true);
    const wrong = gradeAnswer(rq, { kind: 'tiles', tileIds: idsFor('I went yesterday to the park') });
    expect(wrong.correct).toBe(false);
    expect(wrong.feedback?.en).toContain('to');
    // Missing tiles are never correct
    expect(gradeAnswer(rq, { kind: 'tiles', tileIds: idsFor('I went to the park yesterday').slice(1) }).correct).toBe(false);
  });
});

describe('SentenceDuelHost', () => {
  it('scores a full duel and gives a second attempt', () => {
    const clock = new FakeClock();
    const rec = new Recorder();
    let outcome: MatchOutcome | null = null;
    const host = new SentenceDuelHost({
      matchId: 'sd1',
      players: players(),
      clock,
      questions: fixedSource([sentenceItem('s1')]),
      emit: rec.emit,
      random: seededRandom(9),
      onEnd: (o) => (outcome = o),
    });
    host.start();
    clock.advance(SENTENCE_MASTER.countdownMs);
    for (let round = 0; round < SENTENCE_MASTER.rounds; round++) {
      const r = rec.last('ROUND_START');
      const rq = host.peekRound(r.roundId)!;
      const pool = rq.question.tiles!.slice();
      const ids = rq.key.acceptedSequences![0]!.map((tok) => pool.splice(pool.findIndex((t) => t.text.toLowerCase() === tok), 1)[0]!.id);
      const reversed = ids.slice().reverse();
      expect(host.submitAnswer('p2', r.roundId, { kind: 'tiles', tileIds: reversed }).ok).toBe(true);
      expect(rec.last('ATTEMPT_RESULT', 'p2').attemptsLeft).toBe(1);
      clock.advance(1000);
      host.submitAnswer('p1', r.roundId, { kind: 'tiles', tileIds: ids });
      host.submitAnswer('p2', r.roundId, { kind: 'tiles', tileIds: ids });
      clock.advance(SENTENCE_MASTER.resolveMs + 100);
    }
    clock.advance(1000);
    const o = outcome as unknown as MatchOutcome;
    expect(o.reason).toBe('rounds-complete');
    expect(o.winnerId).toBe('p1');
    const s1 = o.stats.find((s) => s.playerId === 'p1')!;
    const s2 = o.stats.find((s) => s.playerId === 'p2')!;
    expect(s1.score!).toBeGreaterThan(s2.score!);
    expect(s2.correct).toBe(SENTENCE_MASTER.rounds);
  });
});
