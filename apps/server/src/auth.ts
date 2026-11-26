/**
 * Session authentication.
 *  - Guests: server-issued HS256 JWTs (random server-side player id; never derived from client input).
 *  - Registered: Supabase access tokens, verified with the project JWKS (asymmetric keys)
 *    or the legacy JWT secret. Implemented; awaiting Supabase configuration.
 */
import { randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTPayload } from 'jose';
import type { Config } from './config';

export interface Identity {
  playerId: string;
  kind: 'guest' | 'registered';
  nickname?: string;
}

const ISSUER = 'lingua-legends';

export class Auth {
  private readonly key: Uint8Array;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet> | null;
  private readonly supabaseSecret: Uint8Array | null;

  constructor(private readonly cfg: Config) {
    this.key = new TextEncoder().encode(cfg.secret);
    this.jwks = cfg.SUPABASE_URL ? createRemoteJWKSet(new URL(`${cfg.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)) : null;
    this.supabaseSecret = cfg.SUPABASE_JWT_SECRET ? new TextEncoder().encode(cfg.SUPABASE_JWT_SECRET) : null;
  }

  newGuestId(): string {
    return `g_${randomBytes(12).toString('base64url')}`;
  }

  async issueGuestToken(playerId: string): Promise<{ token: string; exp: number }> {
    const exp = Math.floor(Date.now() / 1000) + this.cfg.GUEST_TOKEN_TTL_DAYS * 86400;
    const token = await new SignJWT({ kind: 'guest' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(playerId)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(this.key);
    return { token, exp };
  }

  async verify(token: string): Promise<Identity | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: ISSUER, algorithms: ['HS256'] });
      if (payload.kind === 'guest' && typeof payload.sub === 'string' && payload.sub.startsWith('g_')) {
        return { playerId: payload.sub, kind: 'guest' };
      }
    } catch {
      /* not a guest token — try Supabase */
    }
    const supa = await this.verifySupabase(token);
    if (supa?.sub) {
      const meta = (supa as JWTPayload & { user_metadata?: { nickname?: string } }).user_metadata;
      return { playerId: supa.sub, kind: 'registered', ...(meta?.nickname ? { nickname: meta.nickname } : {}) };
    }
    return null;
  }

  private async verifySupabase(token: string): Promise<JWTPayload | null> {
    const opts = { audience: 'authenticated' } as const;
    if (this.jwks) {
      try {
        return (await jwtVerify(token, this.jwks, opts)).payload;
      } catch {
        /* fall through to the legacy secret */
      }
    }
    if (this.supabaseSecret) {
      try {
        return (await jwtVerify(token, this.supabaseSecret, { ...opts, algorithms: ['HS256'] })).payload;
      } catch {
        return null;
      }
    }
    return null;
  }

  get supabaseEnabled(): boolean {
    return !!(this.jwks || this.supabaseSecret);
  }
}

/** Nicknames: letters, digits, space, _ and -, 3–16 chars. A tiny blocklist catches obvious abuse. */
const BLOCKED = ['admin', 'moderator', 'official', 'fuck', 'shit', 'bitch', 'nazi', 'zona', 'koos'];
export function sanitizeNickname(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.normalize('NFKC').replace(/[^\p{L}\p{N}_ -]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  if (s.length < 3) return null;
  const lower = s.toLowerCase().replace(/[\s_-]/g, '');
  if (BLOCKED.some((b) => lower.includes(b))) return null;
  return s;
}
