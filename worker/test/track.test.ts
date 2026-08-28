import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { handleRequest, migrateLegacyCounters } from '../src/index';

const allowedOrigin = 'https://chemai101.guoweiwang.com';

function dayStamp(offsetDays = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function trackRequest(event: string, slug?: string, origin = allowedOrigin): Request {
  return new Request('https://chemai101-api.guoweiwang27.workers.dev/v1/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(slug ? { event, slug } : { event }),
  });
}

function statsRequest(origin = allowedOrigin): Request {
  return new Request('https://chemai101-api.guoweiwang27.workers.dev/v1/stats', {
    method: 'GET',
    headers: { origin },
  });
}

beforeEach(async () => {
  await env.USAGE_DB.prepare(
    'CREATE TABLE IF NOT EXISTS usage_counts (event TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL CHECK (count >= 0), PRIMARY KEY (event, day))',
  ).run();
  await env.USAGE_DB.prepare(
    'CREATE TABLE IF NOT EXISTS usage_legacy_counts (event TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL CHECK (count >= 0), PRIMARY KEY (event, day))',
  ).run();
  await env.USAGE_DB.prepare(
    "CREATE TABLE IF NOT EXISTS usage_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL, details TEXT NOT NULL DEFAULT '{}')",
  ).run();
  await env.USAGE_DB.prepare('DELETE FROM usage_counts').run();
  await env.USAGE_DB.prepare('DELETE FROM usage_legacy_counts').run();
  await env.USAGE_DB.prepare('DELETE FROM usage_migrations').run();
});

describe('anonymous usage counters', () => {
  it('records events and aggregates them in stats', async () => {
    const t1 = await handleRequest(trackRequest('reaction'), env, fetch);
    expect(t1.status).toBe(204);
    expect(t1.headers.get('access-control-allow-origin')).toBe(allowedOrigin);

    await handleRequest(trackRequest('textbook', 'na-h2o'), env, fetch);
    await handleRequest(trackRequest('textbook', 'fe-cl2'), env, fetch);

    const stats = await handleRequest(statsRequest(), env, fetch);
    expect(stats.status).toBe(200);
    const body = (await stats.json()) as {
      totals: Record<string, number>;
      today: Record<string, number>;
      total: number;
    };
    expect(body.totals.reaction).toBeGreaterThanOrEqual(1);
    expect(body.totals.textbook).toBeGreaterThanOrEqual(2);
    expect(body.today.reaction).toBeGreaterThanOrEqual(1);
    expect(body.total).toBeGreaterThanOrEqual(3);
  });

  it('serves exact aggregate stats without listing legacy KV keys', async () => {
    await env.USAGE_DB.prepare(
      'INSERT INTO usage_counts (event, day, count) VALUES (?, ?, ?), (?, ?, ?)',
    )
      .bind('reaction', dayStamp(), 7, 'textbook', dayStamp(), 3)
      .run();

    const originalList = env.COUNTERS.list.bind(env.COUNTERS);
    Object.defineProperty(env.COUNTERS, 'list', {
      configurable: true,
      value: async () => {
        throw new Error('KV list() limit exceeded for the day.');
      },
    });
    try {
      const stats = await handleRequest(statsRequest(), env, fetch);
      expect(stats.status).toBe(200);
      const body = (await stats.json()) as {
        totals: Record<string, number>;
        today: Record<string, number>;
        total: number;
      };
      expect(body.totals.reaction).toBe(7);
      expect(body.totals.textbook).toBe(3);
      expect(body.today.reaction).toBe(7);
      expect(body.total).toBe(10);
    } finally {
      Object.defineProperty(env.COUNTERS, 'list', { configurable: true, value: originalList });
    }
  });

  it('rejects unknown events and malformed slugs', async () => {
    for (const bad of [trackRequest('hack'), trackRequest('reaction', 'Bad_Slug!')]) {
      const response = await handleRequest(bad, env, fetch);
      expect(response.status).toBe(400);
    }
  });

  it('blocks foreign origins', async () => {
    const response = await handleRequest(trackRequest('reaction', undefined, 'https://evil.example'), env, fetch);
    expect(response.status).toBe(403);
  });

  it('rejects non-GET on stats', async () => {
    const request = new Request('https://chemai101-api.guoweiwang27.workers.dev/v1/stats', {
      method: 'POST',
      headers: { origin: allowedOrigin },
    });
    const response = await handleRequest(request, env, fetch);
    expect(response.status).toBe(405);
  });

  it('adds migrated baselines to totals but not to today', async () => {
    await env.USAGE_DB.prepare(
      'INSERT INTO usage_counts (event, day, count) VALUES (?, ?, ?), (?, ?, ?)',
    )
      .bind('reaction', 'legacy', 120, 'textbook', 'legacy', 80)
      .run();
    await handleRequest(trackRequest('reaction'), env, fetch);

    const stats = await handleRequest(statsRequest(), env, fetch);
    expect(stats.status).toBe(200);
    const body = (await stats.json()) as {
      totals: Record<string, number>;
      today: Record<string, number>;
      total: number;
      bases: Record<string, number>;
    };
    expect(body.bases.reaction).toBe(120);
    expect(body.bases.textbook).toBe(80);
    expect(body.totals.reaction).toBe(121);
    expect(body.totals.textbook).toBe(80);
    expect(body.total).toBe(201);
    expect(body.today.reaction).toBe(1);
  });

  it('does not depend on the legacy KV bases key', async () => {
    await env.COUNTERS.put('bases', '{not valid json');
    try {
      const stats = await handleRequest(statsRequest(), env, fetch);
      expect(stats.status).toBe(200);
      const body = (await stats.json()) as { totals: Record<string, number>; bases: Record<string, number> };
      for (const event of ['reaction', 'builder', 'compound', 'textbook']) {
        expect(body.bases[event]).toBe(0);
        expect(body.totals[event]).toBeGreaterThanOrEqual(0);
      }
    } finally {
      await env.COUNTERS.delete('bases');
    }
  });

  it('migrates legacy event keys idempotently into aggregate stats', async () => {
    const nonce = Date.now().toString(36);
    const keys = [
      `t:reaction:${dayStamp(-1)}:${nonce}-a`,
      `t:reaction:${dayStamp(-1)}:${nonce}-b`,
      `t:textbook:${dayStamp()}:${nonce}-c`,
    ];
    for (const key of keys) await env.COUNTERS.put(key, '');
    try {
      await migrateLegacyCounters(env);
      await migrateLegacyCounters(env);

      const stats = await handleRequest(statsRequest(), env, fetch);
      expect(stats.status).toBe(200);
      const body = (await stats.json()) as {
        totals: Record<string, number>;
        today: Record<string, number>;
        total: number;
      };
      expect(body.totals.reaction).toBe(2);
      expect(body.totals.textbook).toBe(1);
      expect(body.today.textbook).toBe(1);
      expect(body.total).toBe(3);
    } finally {
      for (const key of keys) await env.COUNTERS.delete(key);
    }
  });
});

describe('interpretPhenomenon request validation', () => {
  function interpretRequest(body: unknown, origin = allowedOrigin): Request {
    return new Request('https://chemai101-api.guoweiwang27.workers.dev/v1/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify(body),
    });
  }

  it('rejects malformed phenomenon payloads before hitting upstream', async () => {
    const badBodies = [
      { operation: 'interpretPhenomenon', phenomenon: '', language: 'zh' },
      { operation: 'interpretPhenomenon', phenomenon: '   ', language: 'zh' },
      { operation: 'interpretPhenomenon', phenomenon: 'x'.repeat(4001), language: 'zh' },
      { operation: 'interpretPhenomenon', phenomenon: 123, language: 'zh' },
      { operation: 'interpretPhenomenon' },
    ];
    for (const body of badBodies) {
      const response = await handleRequest(interpretRequest(body), env, fetch);
      expect(response.status).toBe(400);
    }
  });

  it('rejects malformed identifyMoleculeByDesc payloads before hitting upstream', async () => {
    const badBodies = [
      { operation: 'identifyMoleculeByDesc', description: '', language: 'zh' },
      { operation: 'identifyMoleculeByDesc', description: '   ', language: 'en' },
      { operation: 'identifyMoleculeByDesc', description: 'x'.repeat(4001), language: 'zh' },
      { operation: 'identifyMoleculeByDesc', description: 42, language: 'zh' },
      { operation: 'identifyMoleculeByDesc' },
    ];
    for (const body of badBodies) {
      const response = await handleRequest(interpretRequest(body), env, fetch);
      expect(response.status).toBe(400);
    }
  });

  it('rejects unknown operations and non-POST on analyze', async () => {
    const unknown = await handleRequest(
      interpretRequest({ operation: 'hack', phenomenon: 'x', language: 'zh' }),
      env,
      fetch,
    );
    expect(unknown.status).toBe(400);

    const wrongMethod = new Request('https://chemai101-api.guoweiwang27.workers.dev/v1/analyze', {
      method: 'GET',
      headers: { origin: allowedOrigin },
    });
    expect((await handleRequest(wrongMethod, env, fetch)).status).toBe(405);
  });
});
