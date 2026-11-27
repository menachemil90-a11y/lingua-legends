import { describe, expect, it } from 'vitest';
import { FakeClock, type MatchOutcome } from '../src/hosts/common';
import { ESCAPE_COOP, EscapeCoopHost } from '../src/hosts/escapeCoopHost';
import type { EscapeRoom } from '../src/rules/escape';
import { clientMessageSchema } from '../src/protocol';
import { seededRandom } from '../src/random';
import { fixedSource, mcItem, players, Recorder } from './fixtures';

const room: EscapeRoom = {
  id: 'test-room',
  title: 'Test room',
  titleHe: 'חדר בדיקה',
  level: 'A2',
  theme: 'workshop',
  intro: 'Intro',
  introHe: 'פתיחה',
  outro: 'Outro',
  outroHe: 'סיום',
  timedSeconds: 600,
  puzzles: [
    { id: 'p1', object: 'note', title: 'Note', question: 'Which day?', kind: 'choice', options: ['Monday', 'Tuesday'], answer: 1, explanation: { en: 'e', he: 'ה' }, hint: { en: 'h', he: 'ר' }, vocabulary: ['day'] },
    { id: 'p2', object: 'chest', title: 'Chest', question: 'Word?', kind: 'text', accepted: ['key'], explanation: { en: 'e', he: 'ה' }, hint: { en: 'h', he: 'ר' }, vocabulary: ['key'] },
    { id: 'p3', object: 'desk', title: 'Desk', question: 'Order?', kind: 'order', steps: ['a', 'b', 'c'], explanation: { en: 'e', he: 'ה' }, hint: { en: 'h', he: 'ר' }, vocabulary: [] },
  ],
};

function setup() {
  const clock = new FakeClock();
  const rec = new Recorder();
  let outcome: MatchOutcome | null = null;
  const host = new EscapeCoopHost({ matchId: 'e1', players: players(), clock, questions: fixedSource([mcItem('q')]), emit: rec.emit, random: seededRandom(1), onEnd: (o) => (outcome = o) }, room);
  host.start();
  clock.advance(ESCAPE_COOP.countdownMs);
  const state = () => {
    const m = rec.last('PLAYER_STATE');
    if (m.state.mode !== 'escape-room') throw new Error('mode');
    return m.state;
  };
  return { clock, rec, host, state, outcome: () => outcome as MatchOutcome | null };
}

describe('EscapeCoopHost', () => {
  it('checks answers on the server and shares every attempt with the team', () => {
    const { host, state } = setup();
    expect(host.submitEscape('p1', { type: 'answer', puzzleId: 'p1', answer: { kind: 'choice', index: 0 } }).ok).toBe(true);
    expect(state().last).toMatchObject({ puzzleId: 'p1', by: 'p1', correct: false });
    expect(state().solved).toHaveLength(0);
    host.submitEscape('p2', { type: 'answer', puzzleId: 'p1', answer: { kind: 'choice', index: 1 } });
    expect(state().solved).toEqual([{ puzzleId: 'p1', by: 'p2', attempts: 2, hinted: false }]);
    // An opened lock cannot be "solved" again.
    expect(host.submitEscape('p1', { type: 'answer', puzzleId: 'p1', answer: { kind: 'choice', index: 1 } })).toMatchObject({ ok: false, code: 'DUPLICATE' });
  });

  it('rejects outsiders, unknown locks and answers before the room opens', () => {
    const clock = new FakeClock();
    const rec = new Recorder();
    const host = new EscapeCoopHost({ matchId: 'e2', players: players(), clock, questions: fixedSource([mcItem('q')]), emit: rec.emit, random: seededRandom(1), onEnd: () => {} }, room);
    host.start();
    expect(host.submitEscape('p1', { type: 'hint', puzzleId: 'p1' })).toMatchObject({ ok: false, code: 'INVALID_STATE' });
    clock.advance(ESCAPE_COOP.countdownMs);
    expect(host.submitEscape('intruder', { type: 'hint', puzzleId: 'p1' })).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(host.submitEscape('p1', { type: 'hint', puzzleId: 'nope' })).toMatchObject({ ok: false, code: 'BAD_MESSAGE' });
  });

  it('records shared hints and limits brute force', () => {
    const { host, state } = setup();
    host.submitEscape('p1', { type: 'hint', puzzleId: 'p2' });
    expect(state().hints).toEqual(['p2']);
    let last;
    for (let i = 0; i < ESCAPE_COOP.maxAttemptsPerPuzzle * 2 + 1; i++) last = host.submitEscape(i % 2 ? 'p1' : 'p2', { type: 'answer', puzzleId: 'p2', answer: { kind: 'text', text: `wrong${i}` } });
    expect(last).toMatchObject({ ok: false, code: 'RATE_LIMITED' });
    host.submitEscape('p1', { type: 'answer', puzzleId: 'p3', answer: { kind: 'order', order: ['a', 'b', 'c'] } });
    expect(state().solved.find((x) => x.puzzleId === 'p3')).toMatchObject({ by: 'p1', hinted: false });
  });

  it('the whole team wins when every lock is open (text answers are normalised)', () => {
    const { host, outcome, state } = setup();
    host.submitEscape('p1', { type: 'answer', puzzleId: 'p1', answer: { kind: 'choice', index: 1 } });
    host.submitEscape('p2', { type: 'answer', puzzleId: 'p2', answer: { kind: 'text', text: '  The KEY. ' } });
    host.submitEscape('p2', { type: 'answer', puzzleId: 'p3', answer: { kind: 'order', order: ['a', 'b', 'c'] } });
    const o = outcome()!;
    expect(o.reason).toBe('finish');
    expect(o.outcomes.every((x) => x.result === 'win')).toBe(true);
    expect(state().escaped).toBe(true);
    expect(o.stats.find((s) => s.playerId === 'p2')).toMatchObject({ correct: 2, answered: 2 });
  });

  it('running out of time is a shared draw, never a defeat; leavers do not stop the team', () => {
    const { host, clock, outcome } = setup();
    host.forfeit('p2');
    expect(host.isEnded()).toBe(false);
    clock.advance(room.timedSeconds * 1000 * ESCAPE_COOP.timeFactor + 10);
    const o = outcome()!;
    expect(o.reason).toBe('timeout');
    expect(o.outcomes).toEqual([
      { playerId: 'p1', result: 'draw' },
      { playerId: 'p2', result: 'loss' },
    ]);
    expect(o.forfeited).toEqual(['p2']);
  });

  it('protocol validates escape intents', () => {
    const okMsg = clientMessageSchema.safeParse({ type: 'ESCAPE_ACTION', msgId: 'abcdefgh1', matchId: 'e1', action: { type: 'answer', puzzleId: 'p1', answer: { kind: 'text', text: 'key' } } });
    expect(okMsg.success).toBe(true);
    const tooLong = clientMessageSchema.safeParse({ type: 'ESCAPE_ACTION', msgId: 'abcdefgh2', matchId: 'e1', action: { type: 'answer', puzzleId: 'p1', answer: { kind: 'text', text: 'x'.repeat(200) } } });
    expect(tooLong.success).toBe(false);
    const queue = clientMessageSchema.safeParse({ type: 'QUEUE_JOIN', msgId: 'abcdefgh3', mode: 'escape-room', queue: 'casual', bracket: 'core' });
    expect(queue.success).toBe(false);
  });
});
