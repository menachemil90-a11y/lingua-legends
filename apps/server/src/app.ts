/**
 * Lingua Legends authoritative multiplayer server: HTTP API + WebSocket gateway.
 * Exported as a factory so integration tests can run real servers on random ports.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  clientMessageSchema,
  currentSeason,
  ERROR_CODES,
  MAX_MESSAGE_BYTES,
  QUEUE_MODE_IDS,
  BRACKETS,
  rankFromRating,
  type ClientMessage,
  type OnlineModeId,
  type Bracket,
  type ServerMessage,
} from '@lingua/shared';
import type { Config } from './config';
import { Auth, sanitizeNickname } from './auth';
import { Hub, sanitizeCosmetics, type Session } from './hub';
import { KeyedLimiter, RecentIds, TokenBucket } from './rateLimit';
import { MatchManager } from './matches';
import { Matchmaker, Rooms } from './lobby';
import { Friends } from './friends';
import type { ServerStore } from './store/types';
import { loadRankedPool } from './content/rankedPool';
import { rankedAvailable, rankedPoolInfo, setRankedPool } from './content/sources';

export const SERVER_VERSION = '0.1.0';

export interface RunningServer {
  port: number;
  close(): Promise<void>;
  hub: Hub;
  matches: MatchManager;
}

function json(res: ServerResponse, status: number, body: unknown, origin: string | null): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
  });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage, limit = 2048): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

function clientIp(req: IncomingMessage): string {
  // Only trust the socket address; configure a proxy-aware deployment explicitly if needed.
  return req.socket.remoteAddress ?? 'unknown';
}

export async function startServer(cfg: Config, store: ServerStore, port = cfg.PORT): Promise<RunningServer> {
  const pool = await loadRankedPool({
    production: cfg.NODE_ENV === 'production',
    file: cfg.RANKED_POOL_FILE,
    ...(cfg.ALLOW_PUBLIC_RANKED_SAMPLE ? { allowPublicSample: cfg.ALLOW_PUBLIC_RANKED_SAMPLE === 'true' } : {}),
    ...(cfg.STORE === 'supabase' && cfg.SUPABASE_URL && cfg.SUPABASE_SERVICE_ROLE_KEY ? { supabase: { url: cfg.SUPABASE_URL, serviceRoleKey: cfg.SUPABASE_SERVICE_ROLE_KEY } } : {}),
  });
  setRankedPool(pool);
  if (cfg.NODE_ENV !== 'test') console.log(`[ranked] source=${pool.source} items=${pool.items.length} — ${pool.notes.join(' | ')}`);
  const auth = new Auth(cfg);
  const hub = new Hub();
  const matches = new MatchManager(hub, store, { readyTimeoutMs: cfg.READY_TIMEOUT_MS });
  const matchmaker = new Matchmaker(hub, matches, store);
  const rooms = new Rooms(hub, matches, store, cfg.ROOM_TTL_MS);
  const friends = new Friends(hub, store, matches);
  const guestLimiter = new KeyedLimiter(cfg.GUEST_TOKENS_PER_MINUTE, cfg.GUEST_TOKENS_PER_MINUTE / 60);
  const httpLimiter = new KeyedLimiter(60, 2);
  const connPerIp = new Map<string, number>();
  const allowedOrigin = (origin: string | undefined) => !origin || cfg.origins.includes(origin) || cfg.origins.includes('*');

  const bearer = async (req: IncomingMessage) => {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) return null;
    return auth.verify(h.slice(7));
  };

  const server = createServer(async (req, res) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : null;
    const corsOrigin = origin && allowedOrigin(origin) ? origin : null;
    if (origin && !corsOrigin) return json(res, 403, { error: 'origin not allowed' }, null);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        ...(corsOrigin ? { 'access-control-allow-origin': corsOrigin, vary: 'Origin' } : {}),
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type, authorization',
        'access-control-max-age': '600',
      });
      return res.end();
    }
    const ip = clientIp(req);
    if (!httpLimiter.take(ip)) return json(res, 429, { error: 'rate limited' }, corsOrigin);
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        return json(res, 200, { ok: true, version: SERVER_VERSION, supabase: auth.supabaseEnabled, online: hub.size, liveMatches: matches.liveCount, ranked: rankedPoolInfo() }, corsOrigin);
      }
      if (req.method === 'POST' && url.pathname === '/api/auth/guest') {
        if (!guestLimiter.take(ip)) return json(res, 429, { error: 'rate limited' }, corsOrigin);
        const body = (await readBody(req)) as { nickname?: unknown };
        const nickname = sanitizeNickname(body.nickname) ?? `Player${randomBytes(2).toString('hex')}`;
        const playerId = auth.newGuestId();
        let friendCode = Friends.newFriendCode();
        while (await store.findByFriendCode(friendCode)) friendCode = Friends.newFriendCode();
        await store.upsertPlayer({ id: playerId, nickname, kind: 'guest', friendCode, createdAt: Date.now(), lastSeenAt: Date.now() });
        const { token, exp } = await auth.issueGuestToken(playerId);
        return json(res, 200, { token, exp, playerId, nickname }, corsOrigin);
      }
      if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
        const mode = url.searchParams.get('mode') as OnlineModeId;
        const bracket = url.searchParams.get('bracket') as Bracket;
        if (!(QUEUE_MODE_IDS as readonly string[]).includes(mode) || !BRACKETS.includes(bracket)) return json(res, 400, { error: 'bad params' }, corsOrigin);
        const season = currentSeason();
        const rows = await store.leaderboard(mode, bracket, season.id, 50);
        return json(
          res,
          200,
          {
            season: season.name,
            rows: rows.map((r, i) => {
              const rank = rankFromRating(r.state.rating);
              return { rank: i + 1, playerId: r.playerId, nickname: r.nickname, rating: r.state.rating, games: r.state.games, tier: rank.tier, label: r.state.games >= 5 ? rank.label : 'Placement' };
            }),
          },
          corsOrigin,
        );
      }
      if (req.method === 'GET' && url.pathname === '/api/me/ratings') {
        const id = await bearer(req);
        if (!id) return json(res, 401, { error: 'unauthenticated' }, corsOrigin);
        const ratings = await store.listRatings(id.playerId, currentSeason().id);
        return json(
          res,
          200,
          {
            ratings: ratings.map((r) => {
              const rank = rankFromRating(r.state.rating);
              return {
                mode: r.mode,
                bracket: r.bracket,
                rating: r.state.rating,
                games: r.state.games,
                wins: r.state.wins,
                losses: r.state.losses,
                draws: r.state.draws,
                label: rank.label,
                tier: rank.tier,
                division: rank.division,
                placement: r.state.games < 5 ? { played: r.state.games, total: 5 } : null,
              };
            }),
          },
          corsOrigin,
        );
      }
      if (req.method === 'GET' && url.pathname === '/api/me/wallet') {
        const id = await bearer(req);
        if (!id) return json(res, 401, { error: 'unauthenticated' }, corsOrigin);
        return json(res, 200, { ...(await store.getWallet(id.playerId)), achievements: await store.listAchievements(id.playerId) }, corsOrigin);
      }
      if (req.method === 'GET' && url.pathname === '/api/me/matches') {
        const id = await bearer(req);
        if (!id) return json(res, 401, { error: 'unauthenticated' }, corsOrigin);
        return json(res, 200, { matches: await store.listMatches(id.playerId, 20) }, corsOrigin);
      }
      return json(res, 404, { error: 'not found' }, corsOrigin);
    } catch (e) {
      console.error('[http]', e);
      return json(res, 500, { error: 'internal error' }, corsOrigin);
    }
  });

  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: MAX_MESSAGE_BYTES,
    verifyClient: (info, done) => {
      const origin = info.origin || info.req.headers.origin;
      if (!allowedOrigin(origin)) return done(false, 403, 'origin not allowed');
      const ip = clientIp(info.req);
      if ((connPerIp.get(ip) ?? 0) >= cfg.MAX_CONNECTIONS_PER_IP) return done(false, 429, 'too many connections');
      done(true);
    },
  });

  const sendError = (s: Session, code: string, message: string, ref?: string) =>
    hub.sendSession(s, { type: 'ERROR', code, message, ...(ref ? { ref } : {}) });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const ip = clientIp(req);
    connPerIp.set(ip, (connPerIp.get(ip) ?? 0) + 1);
    const session: Session = {
      id: randomBytes(8).toString('hex'),
      ws,
      ip,
      playerId: null,
      kind: null,
      nickname: 'Player',
      cosmetics: sanitizeCosmetics(undefined),
      bucket: new TokenBucket(30, 12),
      chatBucket: new TokenBucket(3, 0.5),
      seen: new RecentIds(512),
    };
    const authTimer = setTimeout(() => {
      if (!session.playerId) {
        sendError(session, ERROR_CODES.UNAUTHENTICATED, 'Authentication timeout');
        ws.close(4001, 'auth timeout');
      }
    }, 6000);
    let queue: Promise<void> = Promise.resolve();

    ws.on('message', (raw, isBinary) => {
      if (isBinary) return ws.close(4003, 'binary not supported');
      if (!session.bucket.take()) {
        sendError(session, ERROR_CODES.RATE_LIMITED, 'Slow down');
        return;
      }
      let data: unknown;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return sendError(session, ERROR_CODES.BAD_MESSAGE, 'Invalid JSON');
      }
      const parsed = clientMessageSchema.safeParse(data);
      if (!parsed.success) return sendError(session, ERROR_CODES.BAD_MESSAGE, parsed.error.issues[0]?.message ?? 'Invalid message');
      const msg = parsed.data;
      if (!session.seen.add(msg.msgId)) return sendError(session, ERROR_CODES.DUPLICATE, 'Duplicate message', msg.msgId);
      // Process messages from one socket strictly in order.
      queue = queue.then(() => handle(session, msg)).catch((e) => {
        console.error('[ws] handler error', e);
        sendError(session, 'INTERNAL', 'Internal error');
      });
    });
    ws.on('close', () => {
      clearTimeout(authTimer);
      connPerIp.set(ip, Math.max(0, (connPerIp.get(ip) ?? 1) - 1));
      if (session.playerId && hub.unbind(session)) {
        matchmaker.leave(session.playerId);
        rooms.leave(session.playerId);
        matches.onDisconnect(session.playerId);
        void friends.presence(session.playerId);
      }
    });
  });

  async function handle(s: Session, msg: ClientMessage): Promise<void> {
    if (msg.type === 'HELLO') {
      if (s.playerId) return;
      const identity = await auth.verify(msg.token);
      if (!identity) {
        sendError(s, ERROR_CODES.UNAUTHENTICATED, 'Invalid or expired token');
        s.ws.close(4001, 'unauthenticated');
        return;
      }
      let record = await store.getPlayer(identity.playerId);
      if (!record) {
        let friendCode = Friends.newFriendCode();
        while (await store.findByFriendCode(friendCode)) friendCode = Friends.newFriendCode();
        record = { id: identity.playerId, nickname: sanitizeNickname(identity.nickname) ?? 'Player', kind: identity.kind, friendCode, createdAt: Date.now(), lastSeenAt: Date.now() };
      }
      record.lastSeenAt = Date.now();
      await store.upsertPlayer(record);
      s.playerId = record.id;
      s.kind = identity.kind;
      s.nickname = record.nickname;
      s.cosmetics = sanitizeCosmetics(msg.cosmetics);
      const replaced = hub.bind(s);
      if (replaced) {
        hub.sendSession(replaced, { type: 'ERROR', code: ERROR_CODES.SESSION_REPLACED, message: 'Signed in from another tab or device' });
        replaced.playerId = null;
        replaced.ws.close(4002, 'replaced');
      }
      hub.sendSession(s, { type: 'WELCOME', playerId: record.id, nickname: record.nickname, friendCode: record.friendCode, serverTime: Date.now(), accountKind: identity.kind });
      matches.onReconnect(record.id);
      void friends.presence(record.id);
      return;
    }
    const playerId = s.playerId;
    if (!playerId) return sendError(s, ERROR_CODES.UNAUTHENTICATED, 'Send HELLO first');
    const fail = (code: string | null, message = code ?? '') => {
      if (code) sendError(s, code, message, msg.msgId);
    };

    switch (msg.type) {
      case 'PING':
        return hub.sendSession(s, { type: 'PONG', clientTime: msg.clientTime, serverTime: Date.now() });
      case 'QUEUE_JOIN':
        if (matches.isBusy(playerId)) return fail(ERROR_CODES.INVALID_STATE, 'Already in a match');
        if (msg.queue === 'ranked' && !rankedAvailable(msg.mode, msg.bracket)) return fail(ERROR_CODES.RANKED_UNAVAILABLE, 'Ranked play is not available on this server yet');
        rooms.leave(playerId);
        return matchmaker.join(playerId, msg.mode, msg.queue, msg.bracket);
      case 'QUEUE_LEAVE':
        return matchmaker.leave(playerId);
      case 'ROOM_CREATE':
        if (matches.isBusy(playerId)) return fail(ERROR_CODES.INVALID_STATE, 'Already in a match');
        matchmaker.leave(playerId);
        rooms.create(playerId, msg.mode, msg.bracket);
        return;
      case 'ROOM_JOIN':
        if (matches.isBusy(playerId)) return fail(ERROR_CODES.INVALID_STATE, 'Already in a match');
        matchmaker.leave(playerId);
        return fail(await rooms.join(playerId, msg.code), 'Room unavailable');
      case 'ROOM_LEAVE':
        return rooms.leave(playerId);
      case 'ROOM_START':
        return fail(await rooms.start(playerId), 'Cannot start this room');
      case 'READY':
        return fail(matches.ready(playerId, msg.matchId), 'Not in this match');
      case 'ANSWER_SUBMIT': {
        const err = matches.answer(playerId, msg.matchId, msg.roundId, msg.answer);
        return err ? fail(err.code, err.message) : undefined;
      }
      case 'ESCAPE_ACTION': {
        const err = matches.escape(playerId, msg.matchId, msg.action);
        return err ? fail(err.code, err.message) : undefined;
      }
      case 'CONQUEST_ACTION': {
        const err = matches.action(playerId, msg.matchId, msg.action);
        return err ? fail(err.code, err.message) : undefined;
      }
      case 'ABILITY_USE': {
        const err = matches.ability(playerId, msg.matchId, msg.ability);
        return err ? fail(err.code, err.message) : undefined;
      }
      case 'MATCH_LEAVE':
        return matches.leave(playerId, msg.matchId);
      case 'REMATCH_REQUEST':
        return fail(await matches.rematch(playerId, msg.matchId));
      case 'QUICK_CHAT':
        if (!s.chatBucket.take()) return fail(ERROR_CODES.RATE_LIMITED, 'Chat rate limit');
        return matches.quickChat(playerId, msg.matchId, msg.phraseId);
      case 'FRIENDS_LIST':
        return hub.sendSession(s, await friends.state(playerId));
      case 'FRIEND_REQUEST':
        return fail(await friends.request(playerId, msg.friendCode), 'Friend code not found');
      case 'FRIEND_RESPOND':
        return fail(await friends.respond(playerId, msg.requestId, msg.accept));
      case 'FRIEND_REMOVE':
        return friends.remove(playerId, msg.playerId);
      case 'FRIEND_CHALLENGE':
        return fail(await friends.challenge(playerId, msg.playerId, msg.mode, msg.bracket), 'Cannot challenge this player now');
      case 'INVITE_RESPOND':
        return fail(await friends.respondInvite(playerId, msg.inviteId, msg.accept), 'Invite unavailable');
      case 'BLOCK':
        return friends.block(playerId, msg.playerId);
      case 'UNBLOCK':
        return friends.unblock(playerId, msg.playerId);
      case 'REPORT':
        return friends.report(playerId, msg.playerId, msg.reason, msg.matchId, msg.details);
    }
  }

  // Heartbeat: drop dead sockets.
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      const anyWs = ws as WebSocket & { __alive?: boolean };
      if (anyWs.__alive === false) return ws.terminate();
      anyWs.__alive = false;
      ws.ping();
    });
  }, 30_000);
  wss.on('connection', (ws) => {
    const anyWs = ws as WebSocket & { __alive?: boolean };
    anyWs.__alive = true;
    ws.on('pong', () => (anyWs.__alive = true));
  });

  await new Promise<void>((resolve) => server.listen(port, cfg.HOST, resolve));
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;

  return {
    port: actualPort,
    hub,
    matches,
    async close() {
      clearInterval(heartbeat);
      matchmaker.dispose();
      rooms.dispose();
      matches.disposeAll();
      for (const ws of wss.clients) ws.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await store.flush();
    },
  };
}

export type { ServerMessage };
