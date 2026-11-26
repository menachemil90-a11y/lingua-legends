/** HTTP API client for the multiplayer server. */
import type { Bracket, OnlineModeId } from '@lingua/shared';
import { useSettings } from '../state/settings';
import { usePlayer } from '../state/player';
import { safeStorage, STORAGE_PREFIX } from '../state/storage';
import { getSupabaseAccessToken } from '../data/supabase';

const TOKEN_KEY = `${STORAGE_PREFIX}guest-token`;

function base(): string {
  return useSettings.getState().serverUrl.replace(/\/$/, '');
}

async function http<T>(path: string, init?: RequestInit, timeoutMs = 5000): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(base() + path, { ...init, signal: ctl.signal, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkServer(): Promise<{ ok: boolean; version?: string; supabase?: boolean }> {
  try {
    return await http<{ ok: boolean; version: string; supabase: boolean }>('/health', undefined, 2500);
  } catch {
    return { ok: false };
  }
}

/** Returns a Supabase session token if the user is signed in, otherwise a server-issued guest token. */
export async function getAuthToken(): Promise<string> {
  const supa = await getSupabaseAccessToken();
  if (supa) return supa;
  const cached = safeStorage.getItem(TOKEN_KEY);
  if (cached) {
    try {
      const { token, exp } = JSON.parse(cached as string) as { token: string; exp: number };
      if (exp * 1000 > Date.now() + 60_000) return token;
    } catch {
      /* refresh below */
    }
  }
  const p = usePlayer.getState();
  const res = await http<{ token: string; exp: number; playerId: string }>('/api/auth/guest', {
    method: 'POST',
    body: JSON.stringify({ nickname: p.nickname, deviceId: p.playerId }),
  });
  safeStorage.setItem(TOKEN_KEY, JSON.stringify({ token: res.token, exp: res.exp }));
  return res.token;
}

export function invalidateGuestToken(): void {
  safeStorage.removeItem(TOKEN_KEY);
}

export interface LeaderboardRow {
  rank: number;
  playerId: string;
  nickname: string;
  rating: number;
  games: number;
  tier: string;
  label: string;
}

export async function fetchLeaderboard(mode: OnlineModeId, bracket: Bracket): Promise<{ season: string; rows: LeaderboardRow[] }> {
  return http(`/api/leaderboard?mode=${encodeURIComponent(mode)}&bracket=${encodeURIComponent(bracket)}`);
}

export interface RemoteRating {
  mode: OnlineModeId;
  bracket: Bracket;
  rating: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  label: string;
  tier: string;
  division: 1 | 2 | 3 | null;
  placement: { played: number; total: number } | null;
}

export async function fetchMyRatings(): Promise<RemoteRating[]> {
  const token = await getAuthToken();
  const res = await http<{ ratings: RemoteRating[] }>('/api/me/ratings', { headers: { authorization: `Bearer ${token}` } });
  return res.ratings;
}
