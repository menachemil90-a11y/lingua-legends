import { describe, expect, it } from 'vitest';
import { championOf, createBracket, decideTournamentWinner, findMatchOf, placements, playableMatches, recordResult } from '../src/rules/tournament';
import { seededRandom } from '../src/random';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

describe('tournament brackets', () => {
  it('builds a 4-bracket for 3 players with one bye for the top seed', () => {
    const b = createBracket(ids(3), seededRandom(1));
    expect(b.size).toBe(4);
    expect(b.rounds.map((r) => r.length)).toEqual([2, 1]);
    const byes = b.rounds[0]!.filter((m) => m.status === 'bye');
    expect(byes).toHaveLength(1);
    expect(byes[0]!.winnerId).toBe(b.seeds[0]);
    expect(b.rounds[1]![0]!.a).toBe(b.seeds[0]);
    expect(playableMatches(b)).toHaveLength(1);
  });

  it('builds an 8-bracket for 6 players: seeds 1 and 2 get byes and every player appears once', () => {
    const b = createBracket(ids(6), seededRandom(2));
    expect(b.size).toBe(8);
    const first = b.rounds[0]!;
    expect(first.filter((m) => m.status === 'bye').map((m) => m.winnerId).sort()).toEqual([b.seeds[0], b.seeds[1]].sort());
    const appearances = first.flatMap((m) => [m.a, m.b]).filter(Boolean);
    expect(new Set(appearances).size).toBe(6);
    expect(playableMatches(b)).toHaveLength(2);
  });

  it('advances winners round by round to a champion and computes placements', () => {
    const b = createBracket(ids(8), seededRandom(3));
    let guard = 0;
    while (!championOf(b) && guard++ < 20) {
      for (const { round, index, match } of playableMatches(b)) {
        expect(recordResult(b, round, index, match.a!)).toBe(true);
      }
    }
    const champ = championOf(b)!;
    expect(champ).toBeTruthy();
    const places = placements(b);
    expect(places.get(champ)).toBe(1);
    expect([...places.values()].filter((p) => p === 2)).toHaveLength(1);
    expect([...places.values()].filter((p) => p === 3)).toHaveLength(2);
    expect([...places.values()].filter((p) => p === 5)).toHaveLength(4);
    expect(findMatchOf(b, champ)).toBeNull();
  });

  it('rejects impossible results', () => {
    const b = createBracket(ids(4), seededRandom(4));
    const { round, index, match } = playableMatches(b)[0]!;
    expect(recordResult(b, round, index, 'someone-else')).toBe(false);
    expect(recordResult(b, round, index, match.b!)).toBe(true);
    expect(recordResult(b, round, index, match.a!)).toBe(false);
  });

  it('breaks draws by correct answers, then speed, then seed — never by chance', () => {
    const b = createBracket(ids(4), seededRandom(5));
    const [s1, s2] = [b.seeds[0]!, b.seeds[1]!];
    expect(decideTournamentWinner(b, s1, s2, { winnerId: s2, stats: [] })).toBe(s2);
    expect(decideTournamentWinner(b, s1, s2, { winnerId: null, stats: [{ playerId: s1, correct: 3, avgResponseMs: 900 }, { playerId: s2, correct: 5, avgResponseMs: 2000 }] })).toBe(s2);
    expect(decideTournamentWinner(b, s1, s2, { winnerId: null, stats: [{ playerId: s1, correct: 4, avgResponseMs: 3000 }, { playerId: s2, correct: 4, avgResponseMs: 2000 }] })).toBe(s2);
    expect(decideTournamentWinner(b, s2, s1, { winnerId: null, stats: [] })).toBe(s1);
  });

  it('refuses fewer than 3 or more than 8 players', () => {
    expect(() => createBracket(ids(2), seededRandom(1))).toThrow();
    expect(() => createBracket(ids(9), seededRandom(1))).toThrow();
  });
});
