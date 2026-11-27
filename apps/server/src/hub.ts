/** Tracks authenticated sessions and delivers server messages to players. */
import type { WebSocket } from 'ws';
import { CHARACTERS, COSMETICS, VEHICLES, type PublicPlayer, type ServerMessage } from '@lingua/shared';
import type { RecentIds, TokenBucket } from './rateLimit';

export interface Session {
  id: string;
  ws: WebSocket;
  ip: string;
  playerId: string | null;
  kind: 'guest' | 'registered' | null;
  nickname: string;
  cosmetics: { characterId: string; vehicleId: string; titleId?: string; frameId?: string };
  bucket: TokenBucket;
  chatBucket: TokenBucket;
  seen: RecentIds;
}

// Derived from the shared catalog so new heroes and vehicles work online automatically.
const ALLOWED_CHARACTERS = new Set(CHARACTERS.map((c) => c.id));
const ALLOWED_VEHICLES = new Set(VEHICLES.map((v) => v.id));

/** Achievements the server itself awards and stores, so it can vouch for the cosmetics they unlock. */
export const SERVER_VERIFIED_ACHIEVEMENTS = new Set(['first-victory', 'race-winner', 'combo-master', 'tournament-champion']);

/**
 * Titles and frames are status signals other players see. The server only passes on those it can
 * verify: default items, or items unlocked by an achievement it has recorded for this player.
 * Anything else stays visible to the player locally but is not shown to others.
 */
export function verifiedCosmetics(c: Session['cosmetics'], achievements: readonly string[]): Session['cosmetics'] {
  const ok = (id: string | undefined) => {
    const def = id ? COSMETICS.find((x) => x.id === id) : undefined;
    if (!def) return false;
    if (def.unlock.kind === 'default') return true;
    return def.unlock.kind === 'achievement' && SERVER_VERIFIED_ACHIEVEMENTS.has(def.unlock.achievementId) && achievements.includes(def.unlock.achievementId);
  };
  return {
    characterId: c.characterId,
    vehicleId: c.vehicleId,
    ...(ok(c.titleId) ? { titleId: c.titleId } : {}),
    ...(ok(c.frameId) ? { frameId: c.frameId } : {}),
  };
}

export function sanitizeCosmetics(c: Partial<Session['cosmetics']> | undefined): Session['cosmetics'] {
  return {
    characterId: c?.characterId && ALLOWED_CHARACTERS.has(c.characterId) ? c.characterId : 'vexa',
    vehicleId: c?.vehicleId && ALLOWED_VEHICLES.has(c.vehicleId) ? c.vehicleId : 'comet',
    ...(c?.titleId && /^title-[a-z-]{1,40}$/.test(c.titleId) ? { titleId: c.titleId } : {}),
    ...(c?.frameId && /^frame-[a-z-]{1,40}$/.test(c.frameId) ? { frameId: c.frameId } : {}),
  };
}

export class Hub {
  private byPlayer = new Map<string, Session>();

  bind(session: Session): Session | null {
    const prev = session.playerId ? this.byPlayer.get(session.playerId) : undefined;
    if (session.playerId) this.byPlayer.set(session.playerId, session);
    return prev && prev !== session ? prev : null;
  }

  unbind(session: Session): boolean {
    if (session.playerId && this.byPlayer.get(session.playerId) === session) {
      this.byPlayer.delete(session.playerId);
      return true;
    }
    return false;
  }

  get(playerId: string): Session | undefined {
    return this.byPlayer.get(playerId);
  }

  isOnline(playerId: string): boolean {
    return this.byPlayer.has(playerId);
  }

  send(playerId: string, msg: ServerMessage): void {
    const s = this.byPlayer.get(playerId);
    if (s && s.ws.readyState === 1) s.ws.send(JSON.stringify(msg));
  }

  sendSession(session: Session, msg: ServerMessage): void {
    if (session.ws.readyState === 1) session.ws.send(JSON.stringify(msg));
  }

  publicPlayer(playerId: string, extra: Partial<PublicPlayer> = {}): PublicPlayer {
    const s = this.byPlayer.get(playerId);
    return {
      playerId,
      nickname: s?.nickname ?? 'Player',
      isBot: false,
      characterId: s?.cosmetics.characterId ?? 'vexa',
      vehicleId: s?.cosmetics.vehicleId ?? 'comet',
      ...(s?.cosmetics.titleId ? { titleId: s.cosmetics.titleId } : {}),
      ...(s?.cosmetics.frameId ? { frameId: s.cosmetics.frameId } : {}),
      ...extra,
    };
  }

  get size(): number {
    return this.byPlayer.size;
  }
}
