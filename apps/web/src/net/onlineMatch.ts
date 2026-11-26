/** Online match transport: forwards intents to the authoritative server. */
import type { OnlineModeId, PublicPlayer, ServerMessage } from '@lingua/shared';
import { connection, useConnection } from './connection';
import type { MatchIntent, MatchTransport } from './transport';

const MATCH_SCOPED = new Set<ServerMessage['type']>([
  'MATCH_START',
  'ROUND_START',
  'ANSWER_RESULT',
  'ANSWER_LOCKED',
  'ATTEMPT_RESULT',
  'COMBAT_EVENT',
  'PLAYER_STATE',
  'MATCH_END',
  'MATCH_CANCELLED',
  'REMATCH_STATE',
  'QUICK_CHAT',
]);

export function createOnlineMatch(matchId: string, mode: OnlineModeId, players: PublicPlayer[]): MatchTransport {
  const listeners = new Set<(m: ServerMessage) => void>();
  let currentId = matchId;
  const unsub = connection.subscribe((msg) => {
    if (MATCH_SCOPED.has(msg.type) && 'matchId' in msg && msg.matchId === currentId) {
      for (const l of listeners) l(msg);
    }
    if (msg.type === 'ERROR') for (const l of listeners) l(msg);
  });
  const selfId = useConnection.getState().playerId ?? '';
  return {
    kind: 'online',
    matchId,
    mode,
    selfId,
    players,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    send(intent: MatchIntent) {
      connection.send(intent);
    },
    serverNow: () => connection.serverNow(),
    toLocal: (t) => t - useConnection.getState().offsetMs,
    start() {
      /* The server starts the match after both players are READY. */
    },
    dispose() {
      currentId = '';
      unsub();
      listeners.clear();
    },
  };
}
