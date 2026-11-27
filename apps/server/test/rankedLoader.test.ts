import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { q } from '@lingua/content';
import { CONTENT_ITEMS } from '@lingua/content';
import { loadRankedPool, parseRankedPool } from '../src/content/rankedPool';
import { DEV_RANKED_SAMPLE } from '../src/content/devRankedSample';
import { setRankedPool } from '../src/content/sources';
import { guestToken, testServer, TestClient } from './helpers';
import type { RunningServer } from '../src/app';

const fresh = (id: string) =>
  q({ id, level: 'B1', cat: 'vocabulary', d: 2, p: `A completely private prompt number ${id} ___ here.`, ans: 'alpha', wrong: ['beta', 'gamma', 'delta'], en: 'Private test item.', he: 'פריט בדיקה פרטי.', v: ['alpha'] });

const dir = mkdtempSync(join(tmpdir(), 'll-ranked-'));
const servers: RunningServer[] = [];
afterAll(async () => {
  for (const s of servers) await s.close();
});

describe('private ranked pool loading', () => {
  it('rejects any item that overlaps the public bank or the public development sample', () => {
    const pub = CONTENT_ITEMS.find((i) => i.grading.mode === 'option')!;
    const { errors } = parseRankedPool([fresh('pr-1'), { ...pub }, { ...DEV_RANKED_SAMPLE[0]! }, fresh('pr-1')]);
    expect(errors.some((e) => e.includes('public content bank'))).toBe(true);
    expect(errors.some((e) => e.includes('public development sample'))).toBe(true);
    expect(errors.some((e) => e.includes('duplicate id'))).toBe(true);
    expect(parseRankedPool([fresh('pr-2')]).errors).toEqual([]);
    expect(parseRankedPool({ not: 'an array' }).errors.length).toBe(1);
  });

  it('production never falls back to the public sample unless explicitly allowed', async () => {
    expect((await loadRankedPool({ production: true })).source).toBe('disabled');
    expect((await loadRankedPool({ production: true, allowPublicSample: true })).source).toBe('public-sample');
    expect((await loadRankedPool({ production: false })).source).toBe('public-sample');
  });

  it('loads a valid private file and refuses an invalid one', async () => {
    const good = join(dir, 'good.json');
    writeFileSync(good, JSON.stringify([fresh('pr-a'), fresh('pr-b')]));
    const ok = await loadRankedPool({ production: true, file: good });
    expect(ok.source).toBe('private-file');
    expect(ok.items.map((i) => i.id)).toEqual(['pr-a', 'pr-b']);
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, JSON.stringify([DEV_RANKED_SAMPLE_RAW_FIRST()]));
    const refused = await loadRankedPool({ production: true, file: bad });
    expect(refused.source).toBe('disabled');
    expect(refused.notes.join(' ')).toContain('rejected');
    // Notes never contain item content.
    expect(refused.notes.join(' ')).not.toContain(DEV_RANKED_SAMPLE[0]!.prompt);
  });

  it('a production server without a private pool refuses ranked queues but allows casual ones', async () => {
    const server = await testServer({ NODE_ENV: 'production' });
    servers.push(server);
    const health = (await (await fetch(`http://127.0.0.1:${server.port}/health`)).json()) as { ranked: { source: string; size: number } };
    expect(health.ranked).toEqual({ source: 'disabled', size: 0 });
    const c = await new TestClient(server.port, await guestToken(server.port, 'Prod')).connect();
    c.send({ type: 'QUEUE_JOIN', mode: 'word-battle', queue: 'ranked', bracket: 'core' });
    expect((await c.waitFor('ERROR', (e) => e.code === 'RANKED_UNAVAILABLE')).code).toBe('RANKED_UNAVAILABLE');
    c.send({ type: 'QUEUE_JOIN', mode: 'word-battle', queue: 'casual', bracket: 'core' });
    expect((await c.waitFor('QUEUE_STATE', (m) => m.status === 'searching')).status).toBe('searching');
    c.ws.close();
    // Restore the default (sample) pool for any later test in this worker.
    setRankedPool({ source: 'public-sample', items: DEV_RANKED_SAMPLE, notes: [] });
  });
});

function DEV_RANKED_SAMPLE_RAW_FIRST() {
  return { ...DEV_RANKED_SAMPLE[0]! };
}
