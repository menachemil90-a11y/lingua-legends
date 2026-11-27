/**
 * Ranked question pool loader.
 *
 * Ranked answer keys must never be publicly readable. The repository is public, so the
 * committed pool (`devRankedSample.ts`) is a development sample only. Production loads a
 * PRIVATE pool from one of these sources, in order:
 *   1. RANKED_POOL_FILE — a JSON array of content items on the server host (never committed);
 *   2. Supabase — `content_items` rows with `is_ranked_only = true` (read with the service role);
 *   3. the public development sample — only outside production, or if explicitly allowed.
 * With no private source in production, the ranked queue is disabled (casual/private still work).
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { BRACKET_LEVELS, BRACKETS, contentItemSchema, type ContentItem } from '@lingua/shared';
import { CONTENT_ITEMS } from '@lingua/content';
import { DEV_RANKED_SAMPLE } from './devRankedSample';

export type RankedPoolSource = 'private-file' | 'supabase' | 'public-sample' | 'disabled';

export interface RankedPool {
  source: RankedPoolSource;
  items: ContentItem[];
  /** Human-readable notes (never contains item content). */
  notes: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, ' ').trim();

/** Validates a candidate private pool: schema, unique ids, and no overlap with any public item. */
export function parseRankedPool(raw: unknown): { items: ContentItem[]; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(raw)) return { items: [], errors: ['the pool must be a JSON array of content items'] };
  const items: ContentItem[] = [];
  const ids = new Set<string>();
  const publicIds = new Set(CONTENT_ITEMS.map((i) => i.id));
  const publicPrompts = new Set(CONTENT_ITEMS.map((i) => `${norm(i.prompt)}|${norm(i.context ?? '')}`));
  const sampleIds = new Set(DEV_RANKED_SAMPLE.map((i) => i.id));
  const samplePrompts = new Set(DEV_RANKED_SAMPLE.map((i) => `${norm(i.prompt)}|${norm(i.context ?? '')}`));
  raw.forEach((entry, n) => {
    const parsed = contentItemSchema.safeParse(entry);
    if (!parsed.success) {
      errors.push(`item #${n}: ${parsed.error.issues[0]?.path.join('.')} ${parsed.error.issues[0]?.message}`);
      return;
    }
    const item = parsed.data;
    const key = `${norm(item.prompt)}|${norm(item.context ?? '')}`;
    if (ids.has(item.id)) errors.push(`${item.id}: duplicate id`);
    if (publicIds.has(item.id) || publicPrompts.has(key)) errors.push(`${item.id}: overlaps the public content bank`);
    // The committed sample is public too, so a private pool must not reuse it.
    if (sampleIds.has(item.id) || samplePrompts.has(key)) errors.push(`${item.id}: overlaps the public development sample`);
    ids.add(item.id);
    items.push(item);
  });
  return { items, errors };
}

/** Ranked needs enough option items per bracket for a full match. */
export function poolCoverage(items: ContentItem[]): Record<string, number> {
  return Object.fromEntries(BRACKETS.map((b) => [b, items.filter((i) => i.grading.mode === 'option' && BRACKET_LEVELS[b].includes(i.level)).length]));
}

export async function loadRankedPool(opts: {
  production: boolean;
  file?: string | undefined;
  allowPublicSample?: boolean | undefined;
  supabase?: { url: string; serviceRoleKey: string } | undefined;
}): Promise<RankedPool> {
  const notes: string[] = [];
  if (opts.file) {
    try {
      const { items, errors } = parseRankedPool(JSON.parse(readFileSync(opts.file, 'utf8')));
      if (errors.length === 0 && items.length > 0) return { source: 'private-file', items, notes: [`loaded ${items.length} items from RANKED_POOL_FILE`] };
      notes.push(`RANKED_POOL_FILE rejected: ${errors.slice(0, 5).join('; ')}${errors.length > 5 ? ` (+${errors.length - 5} more)` : ''}`);
    } catch (e) {
      notes.push(`RANKED_POOL_FILE could not be read: ${(e as Error).message}`);
    }
  }
  if (opts.supabase) {
    try {
      const db = createClient(opts.supabase.url, opts.supabase.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await db.from('content_items').select('id, current_version, content_versions(version, payload)').eq('is_ranked_only', true);
      if (error) throw new Error(error.message);
      type Row = { current_version: number; content_versions: { version: number; payload: unknown }[] };
      const payloads = ((data ?? []) as Row[]).map((r) => r.content_versions.find((v) => v.version === r.current_version)?.payload).filter(Boolean);
      const { items, errors } = parseRankedPool(payloads);
      if (errors.length === 0 && items.length > 0) return { source: 'supabase', items, notes: [`loaded ${items.length} items from Supabase`] };
      notes.push(items.length === 0 && errors.length === 0 ? 'Supabase has no ranked-only items' : `Supabase pool rejected: ${errors.slice(0, 5).join('; ')}`);
    } catch (e) {
      notes.push(`Supabase ranked pool unavailable: ${(e as Error).message}`);
    }
  }
  const allowSample = opts.allowPublicSample ?? !opts.production;
  if (allowSample) {
    notes.push('using the PUBLIC development sample — not suitable for real ranked play');
    return { source: 'public-sample', items: DEV_RANKED_SAMPLE, notes };
  }
  notes.push('no private ranked pool configured — the ranked queue is disabled');
  return { source: 'disabled', items: [], notes };
}
