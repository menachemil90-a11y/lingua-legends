import type { ClientIntent, OnlineModeId, PublicPlayer, ServerMessage } from '@lingua/shared';

/** Intents a match UI may send. The host/server decides every outcome. */
export type MatchIntent = Extract<
  ClientIntent,
  { type: 'ANSWER_SUBMIT' | 'ABILITY_USE' | 'CONQUEST_ACTION' | 'ESCAPE_ACTION' | 'QUICK_CHAT' | 'REMATCH_REQUEST' | 'MATCH_LEAVE' | 'READY' }
>;

export interface MatchTransport {
  readonly kind: 'local' | 'online';
  readonly matchId: string;
  readonly mode: OnlineModeId;
  readonly selfId: string;
  readonly players: PublicPlayer[];
  subscribe(fn: (msg: ServerMessage) => void): () => void;
  send(intent: MatchIntent): void;
  /** Estimated current server time (ms). */
  serverNow(): number;
  /** Converts a server timestamp into the local clock. */
  toLocal(serverTime: number): number;
  start(): void;
  dispose(): void;
}
