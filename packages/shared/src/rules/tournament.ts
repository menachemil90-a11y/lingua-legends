/**
 * Single-elimination tournament brackets (pure, deterministic given a random source).
 *
 * 3–8 players. The bracket size is the next power of two (4 or 8); missing seeds become
 * byes for the top seeds. Draws are broken by the match statistics, then by seed — never
 * by chance — so results are explainable to players.
 */
import type { RandomFn } from '../random';
import { shuffle } from '../random';

export type TournamentSlotStatus = 'pending' | 'live' | 'done' | 'bye';

export interface TournamentMatch {
  a: string | null;
  b: string | null;
  winnerId: string | null;
  status: TournamentSlotStatus;
  matchId?: string;
}

export interface TournamentBracket {
  size: 4 | 8;
  /** Seed order (index 0 = seed 1). */
  seeds: string[];
  rounds: TournamentMatch[][];
}

/** Standard seeding positions so the top seeds meet as late as possible (1-based seeds). */
const SEED_ORDER: Record<4 | 8, number[]> = {
  4: [1, 4, 2, 3],
  8: [1, 8, 4, 5, 2, 7, 3, 6],
};

export const TOURNAMENT_MIN_PLAYERS = 3;
export const TOURNAMENT_MAX_PLAYERS = 8;

export function createBracket(playerIds: string[], random: RandomFn): TournamentBracket {
  if (playerIds.length < TOURNAMENT_MIN_PLAYERS || playerIds.length > TOURNAMENT_MAX_PLAYERS) throw new Error('A tournament needs 3–8 players');
  const size: 4 | 8 = playerIds.length <= 4 ? 4 : 8;
  const seeds = shuffle(playerIds, random);
  const order = SEED_ORDER[size];
  const first: TournamentMatch[] = [];
  for (let i = 0; i < order.length; i += 2) {
    const a = seeds[order[i]! - 1] ?? null;
    const b = seeds[order[i + 1]! - 1] ?? null;
    first.push({ a, b, winnerId: null, status: 'pending' });
  }
  const rounds: TournamentMatch[][] = [first];
  for (let n = first.length / 2; n >= 1; n /= 2) rounds.push(Array.from({ length: n }, () => ({ a: null, b: null, winnerId: null, status: 'pending' as const })));
  const bracket: TournamentBracket = { size, seeds, rounds };
  // Byes: a first-round match with a single player advances them immediately.
  first.forEach((m, i) => {
    if ((m.a === null) !== (m.b === null)) {
      m.status = 'bye';
      m.winnerId = m.a ?? m.b;
      place(bracket, 0, i, m.winnerId!);
    }
  });
  return bracket;
}

function place(b: TournamentBracket, round: number, index: number, winnerId: string): void {
  const next = b.rounds[round + 1];
  if (!next) return;
  const slot = next[Math.floor(index / 2)]!;
  if (index % 2 === 0) slot.a = winnerId;
  else slot.b = winnerId;
}

/** Records a result and moves the winner on. Returns false if the result is not valid for that match. */
export function recordResult(b: TournamentBracket, round: number, index: number, winnerId: string): boolean {
  const m = b.rounds[round]?.[index];
  if (!m || m.status === 'done' || m.status === 'bye' || (winnerId !== m.a && winnerId !== m.b)) return false;
  m.winnerId = winnerId;
  m.status = 'done';
  place(b, round, index, winnerId);
  return true;
}

/** Matches whose two players are known and that have not been started yet. */
export function playableMatches(b: TournamentBracket): { round: number; index: number; match: TournamentMatch }[] {
  const out: { round: number; index: number; match: TournamentMatch }[] = [];
  b.rounds.forEach((r, round) => r.forEach((match, index) => match.status === 'pending' && match.a && match.b && out.push({ round, index, match })));
  return out;
}

export function findMatchOf(b: TournamentBracket, playerId: string): { round: number; index: number; match: TournamentMatch } | null {
  for (let round = 0; round < b.rounds.length; round++) {
    const index = b.rounds[round]!.findIndex((m) => (m.a === playerId || m.b === playerId) && (m.status === 'pending' || m.status === 'live'));
    if (index >= 0) return { round, index, match: b.rounds[round]![index]! };
  }
  return null;
}

export function championOf(b: TournamentBracket): string | null {
  return b.rounds[b.rounds.length - 1]![0]!.winnerId;
}

export function seedOf(b: TournamentBracket, playerId: string): number {
  const i = b.seeds.indexOf(playerId);
  return i < 0 ? Number.MAX_SAFE_INTEGER : i + 1;
}

/**
 * Decides a finished match. A clear winner wins; a draw (or a cancelled match) goes to the
 * player with more correct answers, then the faster average answer, then the better seed.
 */
export function decideTournamentWinner(
  b: TournamentBracket,
  a: string,
  c: string,
  result: { winnerId: string | null; stats: { playerId: string; correct: number; avgResponseMs: number | null }[] },
): string {
  if (result.winnerId === a || result.winnerId === c) return result.winnerId;
  const sa = result.stats.find((s) => s.playerId === a);
  const sc = result.stats.find((s) => s.playerId === c);
  const ca = sa?.correct ?? 0;
  const cc = sc?.correct ?? 0;
  if (ca !== cc) return ca > cc ? a : c;
  const ta = sa?.avgResponseMs ?? Number.MAX_SAFE_INTEGER;
  const tc = sc?.avgResponseMs ?? Number.MAX_SAFE_INTEGER;
  if (ta !== tc) return ta < tc ? a : c;
  return seedOf(b, a) <= seedOf(b, c) ? a : c;
}

/** Final placement: 1 champion, 2 finalist, 3 semi-finalists, … (by the round a player lost in). */
export function placements(b: TournamentBracket): Map<string, number> {
  const out = new Map<string, number>();
  const last = b.rounds.length - 1;
  b.rounds.forEach((r, round) =>
    r.forEach((m) => {
      if (m.status !== 'done') return;
      const loser = m.winnerId === m.a ? m.b : m.a;
      if (loser) out.set(loser, 2 ** (last - round) + 1);
    }),
  );
  const champ = championOf(b);
  if (champ) out.set(champ, 1);
  return out;
}
