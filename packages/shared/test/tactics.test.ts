import { describe, expect, it } from 'vitest';
import { FakeClock, type MatchOutcome } from '../src/hosts/common';
import { WordBattleHost } from '../src/hosts/wordBattleHost';
import { TACTIC_IDS, TACTICS, WORD_BATTLE, type TacticId } from '../src/rules/wordBattle';
import { seededRandom } from '../src/random';
import { BotController, makeBotProfile, type BotTier } from '../src/bots';
import { fixedSource, mcItem, players, Recorder } from './fixtures';

/** Plays one bot-vs-bot match with the given tactics and returns p1's result. */
function play(t1: TacticId, t2: TacticId, seed: number, tier: BotTier = 'adept'): 'win' | 'loss' | 'draw' {
  const clock = new FakeClock();
  const random = seededRandom(seed);
  let outcome: MatchOutcome | null = null;
  const bots: Record<string, BotController> = {};
  const host = new WordBattleHost({
    matchId: `sim-${seed}`,
    players: players(),
    clock,
    questions: fixedSource([mcItem('q1'), mcItem('q2'), mcItem('q3')]),
    emit: (to, msg) => {
      for (const [id, b] of Object.entries(bots)) if (to === null || to === id) b.handle(msg);
    },
    random,
    onEnd: (o) => (outcome = o),
    tactics: { p1: t1, p2: t2 },
  });
  bots.p1 = new BotController(host, 'p1', makeBotProfile(tier, 'A1'), clock, seededRandom(seed * 7 + 1));
  bots.p2 = new BotController(host, 'p2', makeBotProfile(tier, 'A1'), clock, seededRandom(seed * 13 + 5));
  host.start();
  clock.advance(WORD_BATTLE.countdownMs + WORD_BATTLE.matchMs + 60_000);
  const o = outcome as MatchOutcome | null;
  if (!o) throw new Error('match did not end');
  return o.outcomes.find((x) => x.playerId === 'p1')!.result;
}

describe('Word Battle tactics', () => {
  it('applies each tactic on the server and shows it to both players', () => {
    const clock = new FakeClock();
    const rec = new Recorder();
    const host = new WordBattleHost({ matchId: 't1', players: players(), clock, questions: fixedSource([mcItem('q1')]), emit: rec.emit, random: seededRandom(1), onEnd: () => {}, tactics: { p1: 'guardian', p2: 'striker' } });
    host.start();
    const st = rec.last('PLAYER_STATE');
    if (st.state.mode !== 'word-battle') throw new Error('mode');
    const p1 = st.state.players.find((p) => p.playerId === 'p1')!;
    const p2 = st.state.players.find((p) => p.playerId === 'p2')!;
    expect(p1).toMatchObject({ tactic: 'guardian', hp: TACTICS.guardian.maxHp, maxHp: TACTICS.guardian.maxHp, shield: true });
    expect(p2).toMatchObject({ tactic: 'striker', hp: TACTICS.striker.maxHp, shield: false });
  });

  it('a striker who answers wrong loses HP, but running out of time does not', () => {
    const clock = new FakeClock();
    const rec = new Recorder();
    const host = new WordBattleHost({ matchId: 't2', players: players(), clock, questions: fixedSource([mcItem('q1')]), emit: rec.emit, random: seededRandom(2), onEnd: () => {}, tactics: { p1: 'striker', p2: 'balanced' } });
    host.start();
    clock.advance(WORD_BATTLE.countdownMs);
    const r = rec.last('ROUND_START');
    const key = host.peekRound(r.roundId)!.key.correctOptionIds![0]!;
    const wrong = host.peekRound(r.roundId)!.question.options!.find((o) => o.id !== key)!.id;
    host.submitAnswer('p1', r.roundId, { kind: 'option', optionId: wrong });
    clock.advance(r.deadline - clock.now() + 1000);
    let st = rec.last('PLAYER_STATE');
    if (st.state.mode !== 'word-battle') throw new Error('mode');
    expect(st.state.players.find((p) => p.playerId === 'p1')!.hp).toBe(TACTICS.striker.maxHp - TACTICS.striker.wrongSelfDamage);
    expect(st.state.players.find((p) => p.playerId === 'p2')!.hp).toBe(TACTICS.balanced.maxHp);
    // Next round: p1 does not answer at all → no self-damage.
    clock.advance(WORD_BATTLE.resolveMs + 100);
    const r2 = rec.last('ROUND_START');
    clock.advance(r2.deadline - clock.now() + 1000);
    st = rec.last('PLAYER_STATE');
    if (st.state.mode !== 'word-battle') throw new Error('mode');
    expect(st.state.players.find((p) => p.playerId === 'p1')!.hp).toBe(TACTICS.striker.maxHp - TACTICS.striker.wrongSelfDamage);
  });

  it('is balanced: at equal skill no tactic wins far more often than Balanced (bot simulation)', () => {
    const N = 80;
    const rates: Record<string, number> = {};
    for (const t of TACTIC_IDS.filter((x) => x !== 'balanced')) {
      let score = 0;
      for (let i = 0; i < N; i++) {
        // Alternate seats so seat order cannot bias the result.
        const r = i % 2 === 0 ? play(t, 'balanced', 1000 + i) : invert(play('balanced', t, 1000 + i));
        score += r === 'win' ? 1 : r === 'draw' ? 0.5 : 0;
      }
      rates[t] = score / N;
      if (process.env.PRINT_RATES) console.log(`TACTIC ${t} vs balanced: ${(rates[t] * 100).toFixed(1)}%`);
    }
    for (const [t, rate] of Object.entries(rates)) {
      expect(rate, `${t} vs balanced win rate ${rate.toFixed(2)}`).toBeGreaterThanOrEqual(0.35);
      expect(rate, `${t} vs balanced win rate ${rate.toFixed(2)}`).toBeLessThanOrEqual(0.65);
    }
  }, 60_000);
});

describe('Word Battle tactics across skill levels', () => {
  for (const tier of ['rookie', 'champion'] as const) {
    it(`stays within a fair band for ${tier} players`, () => {
      const N = 50;
      for (const t of TACTIC_IDS.filter((x) => x !== 'balanced')) {
        let score = 0;
        for (let i = 0; i < N; i++) {
          const r = i % 2 === 0 ? play(t, 'balanced', 5000 + i, tier) : invert(play('balanced', t, 5000 + i, tier));
          score += r === 'win' ? 1 : r === 'draw' ? 0.5 : 0;
        }
        if (process.env.PRINT_RATES) console.log(`TACTIC ${tier} ${t} vs balanced: ${((score / N) * 100).toFixed(1)}%`);
        expect(score / N, `${tier}: ${t}`).toBeGreaterThanOrEqual(0.3);
        expect(score / N, `${tier}: ${t}`).toBeLessThanOrEqual(0.7);
      }
    }, 60_000);
  }
});

function invert(r: 'win' | 'loss' | 'draw'): 'win' | 'loss' | 'draw' {
  return r === 'win' ? 'loss' : r === 'loss' ? 'win' : 'draw';
}
