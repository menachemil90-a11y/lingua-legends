/*
 * Tools for the PRIVATE ranked question pool (never committed — the repository is public).
 *
 *   pnpm ranked:validate <pool.private.json>
 *       Checks schema, duplicates, overlap with the public bank and the public dev sample,
 *       and coverage per bracket.
 *   pnpm ranked:export-sql <pool.private.json> <out.private.sql>
 *       Writes SQL that loads the pool into Supabase as `is_ranked_only` items (readable only by
 *       the service role, enforced by RLS). Run it in the Supabase SQL editor, then delete the file.
 *   pnpm ranked:build <generator.private.ts> <out.private.json>
 *       Builds a JSON pool from a TypeScript generator that default-exports ContentItemInput[].
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateContent, RAW_PASSAGES } from '../packages/content/src/index';
import { parseRankedPool, poolCoverage } from '../apps/server/src/content/rankedPool';

const [cmd, a, b] = process.argv.slice(2);
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

function load(path: string) {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  const { items, errors } = parseRankedPool(raw);
  const structural = validateContent(raw as never, RAW_PASSAGES, { references: false, targets: false }).issues.filter((i) => i.severity === 'error');
  return { items, errors: [...errors, ...structural.map((i) => `${i.ref}: ${i.message}`)] };
}

async function main() {
  if (cmd === 'validate' && a) {
    const { items, errors } = load(a);
    console.log(`items: ${items.length}`, poolCoverage(items));
    if (errors.length) {
      console.error(errors.map((e) => `  ✗ ${e}`).join('\n'));
      process.exit(1);
    }
    const thin = Object.entries(poolCoverage(items)).filter(([, n]) => n < 30);
    if (thin.length) console.warn(`warning: fewer than 30 option items in ${thin.map(([k]) => k).join(', ')} — questions will repeat often`);
    console.log('Private ranked pool is valid.');
    return;
  }
  if (cmd === 'export-sql' && a && b) {
    if (!b.endsWith('.private.sql')) throw new Error('the output file must end with .private.sql so git ignores it');
    const { items, errors } = load(a);
    if (errors.length) throw new Error(`pool is invalid (${errors.length} errors) — run ranked:validate first`);
    const lines = ['-- PRIVATE ranked pool. Do not commit. Delete after running.', 'begin;'];
    for (const i of items) {
      lines.push(
        `insert into public.content_items (id, current_version, level, primary_skill, category, item_type, modes, tags, review_status, is_ranked_only) values (${q(i.id)}, ${i.version}, ${q(i.level)}, ${q(i.primarySkill)}, ${q(i.category)}, ${q(i.type)}, array[${i.modes.map(q).join(',')}]::text[], ${q(JSON.stringify(i.tags))}::jsonb, ${q(i.reviewStatus)}, true) on conflict (id) do update set current_version = excluded.current_version, is_ranked_only = true;`,
        `insert into public.content_versions (item_id, version, payload) values (${q(i.id)}, ${i.version}, ${q(JSON.stringify(i))}::jsonb) on conflict (item_id, version) do update set payload = excluded.payload;`,
      );
    }
    lines.push('commit;');
    writeFileSync(b, lines.join('\n') + '\n');
    console.log(`Wrote ${b} (${items.length} ranked-only items).`);
    return;
  }
  if (cmd === 'build' && a && b) {
    if (!b.endsWith('.private.json')) throw new Error('the output file must end with .private.json so git ignores it');
    const mod = (await import(pathToFileURL(resolve(a)).href)) as { default: unknown[] };
    writeFileSync(b, JSON.stringify(mod.default, null, 1));
    console.log(`Wrote ${b} (${mod.default.length} items). Now run: pnpm ranked:validate ${b}`);
    return;
  }
  console.log('usage: ranked-pool.ts validate <file> | export-sql <file> <out.private.sql> | build <generator.private.ts> <out.private.json>');
  process.exit(2);
}
void main();
