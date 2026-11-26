/**
 * Supabase integration (registered accounts + cloud progression).
 *
 * STATUS: implemented, awaiting external configuration. Without VITE_SUPABASE_URL
 * and VITE_SUPABASE_ANON_KEY the game runs fully as a guest/offline experience.
 * The anon key is safe to ship to browsers; all privileged operations go through
 * Row Level Security and server-side functions (see supabase/migrations).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LearningEvent } from '@lingua/learning';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = !!(url && anonKey);

let clientPromise: Promise<SupabaseClient | null> | null = null;

export function getSupabase(): Promise<SupabaseClient | null> {
  if (!supabaseConfigured) return Promise.resolve(null);
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true } }),
  );
  return clientPromise;
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function signInWithEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await getSupabase();
  if (!sb) return { ok: false, error: 'not-configured' };
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signOut(): Promise<void> {
  const sb = await getSupabase();
  await sb?.auth.signOut();
}

/**
 * Uploads learning events for cloud progression. RLS only allows inserting rows
 * for the signed-in user; mastery/rank/currency are never written by the client.
 */
export async function pushLearningEvents(events: LearningEvent[]): Promise<boolean> {
  const sb = await getSupabase();
  if (!sb || events.length === 0) return false;
  const { data: session } = await sb.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return false;
  const rows = events.map((e) => ({
    player_id: userId,
    content_item_id: e.itemId,
    content_version: e.itemVersion ?? 1,
    game_mode: e.mode,
    correct: e.correct,
    response_ms: e.responseMs,
    attempt: e.attempt,
    hint_used: e.hintUsed,
    error_category: e.errorCategory ?? null,
    client_event_id: e.id,
    occurred_at: new Date(e.timestamp).toISOString(),
  }));
  const { error } = await sb.from('learning_events').upsert(rows, { onConflict: 'player_id,client_event_id', ignoreDuplicates: true });
  return !error;
}

export async function requestAccountDeletion(): Promise<{ ok: boolean; error?: string }> {
  const sb = await getSupabase();
  if (!sb) return { ok: false, error: 'not-configured' };
  const { error } = await sb.rpc('request_account_deletion');
  return error ? { ok: false, error: error.message } : { ok: true };
}
