import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RunningServer } from '../src/app';
import { guestToken, testServer, TestClient } from './helpers';

let server: RunningServer;
const clients: TestClient[] = [];

async function client(name: string): Promise<TestClient> {
  const c = await new TestClient(server.port, await guestToken(server.port, name)).connect();
  clients.push(c);
  return c;
}

/** Puts two clients into a live private Word Battle match. */
async function privateMatch(a: TestClient, b: TestClient, mode: 'word-battle' | 'grammar-race' | 'sentence-master' = 'word-battle') {
  a.send({ type: 'ROOM_CREATE', mode, bracket: 'core' });
  const room = await a.waitFor('ROOM_STATE', (m) => m.members.length === 1);
  b.send({ type: 'ROOM_JOIN', code: room.code });
  const foundA = await a.waitFor('MATCH_FOUND');
  const foundB = await b.waitFor('MATCH_FOUND');
  expect(foundA.matchId).toBe(foundB.matchId);
  a.send({ type: 'READY', matchId: foundA.matchId });
  b.send({ type: 'READY', matchId: foundA.matchId });
  await a.waitFor('MATCH_START');
  await b.waitFor('MATCH_START');
  return foundA.matchId;
}

function correctAndWrong(matchId: string, roundId: string) {
  const rq = server.matches.peekRound(matchId, roundId)!;
  const right = rq.key.correctOptionIds![0]!;
  const wrong = rq.question.options!.find((o) => o.id !== right)!.id;
  return { right, wrong };
}

beforeAll(async () => {
  server = await testServer();
});

afterAll(async () => {
  for (const c of clients) await c.close();
  await server.close();
});

describe('authentication', () => {
  it('issues guest tokens and rejects invalid ones', async () => {
    const a = await client('Alice');
    expect(a.playerId).toMatch(/^g_/);
    expect(a.friendCode).toMatch(/^[A-Z0-9]{8}$/);
    const bad = new TestClient(server.port, 'not-a-real-token-xxxxxxxxxxxx');
    await expect(bad.connect()).rejects.toThrow();
    await bad.close();
  });

  it('rejects disallowed origins and requires HELLO before any action', async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/health`, { headers: { origin: 'https://evil.example' } });
    expect(res.status).toBe(403);
    const { default: WebSocket } = await import('ws');
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`, { headers: { origin: 'http://localhost:5173' } });
    const msg = await new Promise<string>((resolve) => {
      ws.on('open', () => ws.send(JSON.stringify({ type: 'QUEUE_LEAVE', msgId: 'abcdefgh1234' })));
      ws.on('message', (raw) => resolve(raw.toString()));
    });
    expect(JSON.parse(msg)).toMatchObject({ type: 'ERROR', code: 'UNAUTHENTICATED' });
    ws.close();
  });
});

describe('private room Word Battle', () => {
  it('runs an authoritative round: hidden answers, server damage, duplicate/replay/unauthorized protection', async () => {
    const a = await client('Ari');
    const b = await client('Bea');
    const intruder = await client('Ivan');
    const matchId = await privateMatch(a, b);
    const round = await a.waitFor('ROUND_START', () => true, 9000);
    await b.waitFor('ROUND_START');
    const raw = JSON.stringify(round);
    expect(raw).not.toContain('acceptedAnswers');
    expect(raw).not.toContain('explanation');

    const { right, wrong } = correctAndWrong(matchId, round.roundId);
    // Intruder cannot act in someone else's match.
    intruder.send({ type: 'ANSWER_SUBMIT', matchId, roundId: round.roundId, answer: { kind: 'option', optionId: right } });
    expect((await intruder.waitFor('ERROR')).code).toBe('NOT_IN_MATCH');

    // Clients cannot set damage: extra fields are stripped by the schema.
    a.sendRaw({ type: 'ANSWER_SUBMIT', msgId: 'replay-test-0001', matchId, roundId: round.roundId, answer: { kind: 'option', optionId: right }, damage: 999 });
    // Replay of the same msgId is rejected.
    a.sendRaw({ type: 'ANSWER_SUBMIT', msgId: 'replay-test-0001', matchId, roundId: round.roundId, answer: { kind: 'option', optionId: right } });
    expect((await a.waitFor('ERROR')).code).toBe('DUPLICATE');
    // A second answer with a fresh msgId is also rejected (one answer per round).
    a.send({ type: 'ANSWER_SUBMIT', matchId, roundId: round.roundId, answer: { kind: 'option', optionId: wrong } });
    expect((await a.waitFor('ERROR', (e) => e.code === 'DUPLICATE')).code).toBe('DUPLICATE');

    b.send({ type: 'ANSWER_SUBMIT', matchId, roundId: round.roundId, answer: { kind: 'option', optionId: wrong } });
    const resultB = await b.waitFor('ANSWER_RESULT');
    expect(resultB.results.find((r) => r.playerId === b.playerId)!.correct).toBe(false);
    expect(resultB.results.find((r) => r.playerId === a.playerId)!.correct).toBe(true);
    // B only sees their own answer text, never A's.
    expect(resultB.results.find((r) => r.playerId === a.playerId)!.answerText).toBeUndefined();
    const state = await b.waitFor('PLAYER_STATE', (m) => m.state.mode === 'word-battle' && m.state.players.some((p) => p.hp < 100));
    if (state.state.mode !== 'word-battle') throw new Error('mode');
    const hpB = state.state.players.find((p) => p.playerId === b.playerId)!.hp;
    expect(hpB).toBeLessThan(100);
    expect(hpB).toBeGreaterThanOrEqual(86); // base 10 + at most 4 speed bonus

    // Forfeit ends the match for both players.
    b.send({ type: 'MATCH_LEAVE', matchId });
    const endA = await a.waitFor('MATCH_END');
    expect(endA.reason).toBe('forfeit');
    expect(endA.winnerId).toBe(a.playerId);
    expect(endA.ranked).toBe(false);
    expect(endA.ratingChange).toBeNull();
  }, 30_000);

  it('lets a disconnected player reconnect and resume', async () => {
    const a = await client('Rex');
    const b = await client('Sam');
    const matchId = await privateMatch(a, b);
    await a.waitFor('ROUND_START', () => true, 9000);
    await b.close();
    const st = await a.waitFor('PLAYER_STATE', (m) => m.state.mode === 'word-battle' && m.state.players.some((p) => !p.connected));
    expect(st).toBeTruthy();
    const b2 = await new TestClient(server.port, b.token).connect();
    clients.push(b2);
    expect(b2.playerId).toBe(b.playerId);
    const found = await b2.waitFor('MATCH_FOUND');
    expect(found.matchId).toBe(matchId);
    await b2.waitFor('MATCH_START');
    await b2.waitFor('PLAYER_STATE');
    await a.waitFor('PLAYER_STATE', (m) => m.state.mode === 'word-battle' && m.state.players.every((p) => p.connected));
    b2.send({ type: 'MATCH_LEAVE', matchId });
    await a.waitFor('MATCH_END');
  }, 30_000);

  it('closes the room once full and supports rematch requests', async () => {
    const a = await client('Una');
    const b = await client('Vic');
    const c = await client('Wes');
    a.send({ type: 'ROOM_CREATE', mode: 'sentence-master', bracket: 'foundation' });
    const room = await a.waitFor('ROOM_STATE', (m) => m.members.length === 1);
    b.send({ type: 'ROOM_JOIN', code: room.code });
    const found = await a.waitFor('MATCH_FOUND');
    await b.waitFor('MATCH_FOUND');
    c.send({ type: 'ROOM_JOIN', code: room.code });
    expect((await c.waitFor('ERROR')).code).toBe('ROOM_NOT_FOUND');
    a.send({ type: 'READY', matchId: found.matchId });
    b.send({ type: 'READY', matchId: found.matchId });
    await a.waitFor('ROUND_START', () => true, 9000);
    a.send({ type: 'MATCH_LEAVE', matchId: found.matchId });
    await b.waitFor('MATCH_END');
    a.send({ type: 'REMATCH_REQUEST', matchId: found.matchId });
    b.send({ type: 'REMATCH_REQUEST', matchId: found.matchId });
    const re = await a.waitFor('REMATCH_STATE', (m) => !!m.newMatchId);
    const found2 = await b.waitFor('MATCH_FOUND', (m) => m.matchId === re.newMatchId);
    expect(found2.queue).toBe('private');
  }, 30_000);
});

describe('Grammar Race rooms', () => {
  it('lets the host start a 3-racer race; only the host may start', async () => {
    const a = await client('Hana');
    const b = await client('Ido');
    const c = await client('Jon');
    a.send({ type: 'ROOM_CREATE', mode: 'grammar-race', bracket: 'core' });
    const room = await a.waitFor('ROOM_STATE', (m) => m.members.length === 1);
    expect(room.capacity).toBe(4);
    b.send({ type: 'ROOM_JOIN', code: room.code });
    c.send({ type: 'ROOM_JOIN', code: room.code });
    await a.waitFor('ROOM_STATE', (m) => m.members.length === 3);
    b.send({ type: 'ROOM_START' });
    expect((await b.waitFor('ERROR', (e) => e.code === 'FORBIDDEN')).code).toBe('FORBIDDEN');
    a.send({ type: 'ROOM_START' });
    const found = await c.waitFor('MATCH_FOUND');
    expect(found.players).toHaveLength(3);
    for (const p of [a, b, c]) p.send({ type: 'READY', matchId: found.matchId });
    const start = await b.waitFor('MATCH_START');
    expect(start.players).toHaveLength(3);
    const q = await c.waitFor('ROUND_START', () => true, 9000);
    expect(q.question.options!.length).toBeGreaterThanOrEqual(2);
    for (const p of [a, b]) p.send({ type: 'MATCH_LEAVE', matchId: found.matchId });
    const end = await c.waitFor('MATCH_END', () => true, 9000);
    expect(end.winnerId).toBe(c.playerId);
  }, 30_000);
});

describe('English Conquest rooms', () => {
  it('runs a 3-player conquest on the server: private questions, validated actions, leavers', async () => {
    const a = await client('Lia');
    const b = await client('Max');
    const c = await client('Noa');
    // Conquest is private-room only: the queue rejects it at validation.
    a.sendRaw({ type: 'QUEUE_JOIN', msgId: a.id(), mode: 'english-conquest', queue: 'casual', bracket: 'core' });
    expect((await a.waitFor('ERROR', (e) => e.code === 'BAD_MESSAGE')).code).toBe('BAD_MESSAGE');
    a.send({ type: 'ROOM_CREATE', mode: 'english-conquest', bracket: 'core' });
    const room = await a.waitFor('ROOM_STATE', (m) => m.members.length === 1);
    expect(room.capacity).toBe(4);
    b.send({ type: 'ROOM_JOIN', code: room.code });
    c.send({ type: 'ROOM_JOIN', code: room.code });
    await a.waitFor('ROOM_STATE', (m) => m.members.length === 3);
    a.send({ type: 'ROOM_START' });
    const found = await a.waitFor('MATCH_FOUND');
    expect(found.mode).toBe('english-conquest');
    for (const p of [a, b, c]) p.send({ type: 'READY', matchId: found.matchId });
    const st0 = await b.waitFor('PLAYER_STATE', (m) => m.state.mode === 'english-conquest');
    if (st0.state.mode !== 'english-conquest') throw new Error('mode');
    const first = st0.state.state.players[0]!.id;
    const active = [a, b, c].find((x) => x.playerId === first)!;
    const others = [a, b, c].filter((x) => x !== active) as [TestClient, TestClient];
    const q = await active.waitFor('ROUND_START', () => true, 9000);
    // Only the active player receives the question, and never the key.
    expect(JSON.stringify(q)).not.toContain('acceptedAnswers');
    await new Promise((r) => setTimeout(r, 200));
    for (const o of others) expect(o.messages.some((m) => m.type === 'ROUND_START')).toBe(false);
    // Another player cannot answer or act for the active player.
    others[0].send({ type: 'ANSWER_SUBMIT', matchId: found.matchId, roundId: q.roundId, answer: { kind: 'option', optionId: q.question.options![0]!.id } });
    expect((await others[0].waitFor('ERROR', (e) => e.code === 'FORBIDDEN')).code).toBe('FORBIDDEN');
    const key = server.matches.peekRound(found.matchId, q.roundId)!.key.correctOptionIds![0]!;
    active.send({ type: 'ANSWER_SUBMIT', matchId: found.matchId, roundId: q.roundId, answer: { kind: 'option', optionId: key } });
    const res = await active.waitFor('ANSWER_RESULT');
    expect(res.results[0]).toMatchObject({ playerId: active.playerId, correct: true });
    const afterAnswer = await others[1].waitFor('PLAYER_STATE', (m) => m.state.mode === 'english-conquest' && m.state.state.phase === 'actions');
    if (afterAnswer.state.mode !== 'english-conquest') throw new Error('mode');
    const capital = afterAnswer.state.state.players.find((p) => p.id === active.playerId)!.capital;
    // A forged, illegal action (recruiting on someone else's island) is rejected by the server rules.
    const foreign = afterAnswer.state.state.players.find((p) => p.id !== active.playerId)!.capital;
    active.send({ type: 'CONQUEST_ACTION', matchId: found.matchId, action: { type: 'recruit', at: foreign } });
    expect((await active.waitFor('ERROR', (e) => e.code === 'INVALID_STATE')).code).toBe('INVALID_STATE');
    active.send({ type: 'CONQUEST_ACTION', matchId: found.matchId, action: { type: 'recruit', at: capital } });
    await others[0].waitFor('PLAYER_STATE', (m) => m.state.mode === 'english-conquest' && m.state.state.territories[capital]!.troops === 4);
    active.send({ type: 'CONQUEST_ACTION', matchId: found.matchId, action: { type: 'end' } });
    const nextQ = await others[0].waitFor('ROUND_START', () => true, 9000);
    expect(nextQ.roundId).not.toBe(q.roundId);
    // One player leaves: the conquest continues for the other two; then a second leaves and the last one wins.
    active.send({ type: 'MATCH_LEAVE', matchId: found.matchId });
    const st = await others[1].waitFor('PLAYER_STATE', (m) => m.state.mode === 'english-conquest' && m.state.state.players.some((p) => p.id === active.playerId && !p.alive));
    if (st.state.mode !== 'english-conquest') throw new Error('mode');
    expect(Object.values(st.state.state.territories).some((t) => t.owner === active.playerId)).toBe(false);
    others[0].send({ type: 'MATCH_LEAVE', matchId: found.matchId });
    const end = await others[1].waitFor('MATCH_END', () => true, 9000);
    expect(end.winnerId).toBe(others[1].playerId);
    expect(end.ranked).toBe(false);
    expect(end.outcomes.filter((o) => o.result === 'loss')).toHaveLength(2);
    const endLeaver = await active.waitFor('MATCH_END', () => true, 9000).catch(() => null);
    // The first leaver was released from the match and earns no shards if they still get the result.
    if (endLeaver) expect(endLeaver.shardsEarned).toBe(0);
  }, 40_000);
});

describe('ranked matchmaking', () => {
  it('matches two real players, updates MMR server-side and shows them on the leaderboard', async () => {
    const a = await client('Rina');
    const b = await client('Tom');
    a.send({ type: 'QUEUE_JOIN', mode: 'word-battle', queue: 'ranked', bracket: 'advanced' });
    b.send({ type: 'QUEUE_JOIN', mode: 'word-battle', queue: 'ranked', bracket: 'advanced' });
    const found = await a.waitFor('MATCH_FOUND', () => true, 6000);
    expect(found.queue).toBe('ranked');
    expect(found.players.every((p) => !p.isBot)).toBe(true);
    a.send({ type: 'READY', matchId: found.matchId });
    b.send({ type: 'READY', matchId: found.matchId });
    const round = await a.waitFor('ROUND_START', () => true, 9000);
    // Ranked questions come from the server-only pool.
    const rq = server.matches.peekRound(found.matchId, round.roundId)!;
    expect(rq.item.id.startsWith('rk-')).toBe(true);
    b.send({ type: 'MATCH_LEAVE', matchId: found.matchId });
    const end = await a.waitFor('MATCH_END');
    expect(end.ranked).toBe(true);
    expect(end.ratingChange!.delta).toBe(32);
    expect(end.ratingChange!.placement).toEqual({ played: 1, total: 5 });
    const endB = await b.waitFor('MATCH_END');
    expect(endB.ratingChange!.delta).toBe(-32);
    const lb = (await (await fetch(`http://127.0.0.1:${server.port}/api/leaderboard?mode=word-battle&bracket=advanced`)).json()) as { rows: { playerId: string; rating: number }[] };
    expect(lb.rows[0]).toMatchObject({ playerId: a.playerId, rating: 1032 });
    const mine = (await (await fetch(`http://127.0.0.1:${server.port}/api/me/ratings`, { headers: { authorization: `Bearer ${a.token}` } })).json()) as { ratings: { rating: number }[] };
    expect(mine.ratings[0]!.rating).toBe(1032);
    // Rewards are computed and stored by the server; the forfeiting player gets no shards.
    expect(end.xpEarned).toBeGreaterThan(0);
    expect(end.shardsEarned).toBeGreaterThan(0);
    expect(end.achievements).toContain('first-victory');
    expect(endB.shardsEarned).toBe(0);
    const wallet = (await (await fetch(`http://127.0.0.1:${server.port}/api/me/wallet`, { headers: { authorization: `Bearer ${a.token}` } })).json()) as { xp: number; shards: number; achievements: string[] };
    expect(wallet).toMatchObject({ xp: end.xpEarned, shards: end.shardsEarned });
    expect(wallet.achievements).toContain('first-victory');
  }, 30_000);

  it('cancels a match when a player never readies up', async () => {
    const a = await client('Ola');
    const b = await client('Pia');
    a.send({ type: 'QUEUE_JOIN', mode: 'grammar-race', queue: 'casual', bracket: 'foundation' });
    b.send({ type: 'QUEUE_JOIN', mode: 'grammar-race', queue: 'casual', bracket: 'foundation' });
    const found = await a.waitFor('MATCH_FOUND', () => true, 6000);
    a.send({ type: 'READY', matchId: found.matchId });
    const cancelled = await a.waitFor('MATCH_CANCELLED', () => true, 8000);
    expect(cancelled.reason).toBe('ready-timeout');
  }, 30_000);
});

describe('friends and safety', () => {
  it('handles friend requests, challenges and blocking', async () => {
    const a = await client('Lia');
    const b = await client('Max');
    b.send({ type: 'FRIEND_REQUEST', friendCode: a.friendCode });
    const st = await a.waitFor('FRIENDS_STATE', (m) => m.incoming.length === 1);
    a.send({ type: 'FRIEND_RESPOND', requestId: st.incoming[0]!.requestId, accept: true });
    await b.waitFor('FRIENDS_STATE', (m) => m.friends.some((f) => f.playerId === a.playerId && f.online));
    b.send({ type: 'FRIEND_CHALLENGE', playerId: a.playerId, mode: 'grammar-race', bracket: 'core' });
    const invite = await a.waitFor('INVITE');
    expect(invite.from.playerId).toBe(b.playerId);
    a.send({ type: 'INVITE_RESPOND', inviteId: invite.inviteId, accept: true });
    const found = await b.waitFor('MATCH_FOUND');
    expect(found.mode).toBe('grammar-race');
    a.send({ type: 'MATCH_LEAVE', matchId: found.matchId });

    // Blocking removes the friendship and prevents joining the blocker's rooms.
    a.send({ type: 'BLOCK', playerId: b.playerId });
    await a.waitFor('FRIENDS_STATE', (m) => m.blocked.some((x) => x.playerId === b.playerId) && m.friends.length === 0);
    a.send({ type: 'ROOM_CREATE', mode: 'word-battle', bracket: 'core' });
    const room = await a.waitFor('ROOM_STATE', (m) => m.status === 'open');
    b.send({ type: 'ROOM_JOIN', code: room.code });
    expect((await b.waitFor('ERROR', (e) => e.code === 'ROOM_NOT_FOUND')).code).toBe('ROOM_NOT_FOUND');
    // Reports are accepted silently.
    b.send({ type: 'REPORT', playerId: a.playerId, reason: 'other', details: 'test' });
  }, 30_000);

  it('rate-limits message floods and rejects malformed messages', async () => {
    const a = await client('Zed');
    a.sendRaw({ type: 'HACK', msgId: 'abcdefgh99' });
    expect((await a.waitFor('ERROR')).code).toBe('BAD_MESSAGE');
    for (let i = 0; i < 80; i++) a.send({ type: 'PING', clientTime: Date.now() });
    expect((await a.waitFor('ERROR', (e) => e.code === 'RATE_LIMITED')).code).toBe('RATE_LIMITED');
  }, 15_000);
});
