import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { handleRequest } from '../src/index';

const allowedOrigin = 'https://chemai101.guoweiwang.com';

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

describe('anonymous usage counters', () => {
  it('records events and aggregates them in stats', async () => {
    const t1 = await handleRequest(trackRequest('reaction'), env, fetch);
    expect(t1.status).toBe(204);

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

  it('adds KV-stored baselines to totals but not to today', async () => {
    await env.COUNTERS.put('bases', JSON.stringify({ reaction: 120, textbook: 80 }));
    try {
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
      // 总数 = 事件计数 + 基线
      expect(body.totals.reaction).toBeGreaterThanOrEqual(121);
      expect(body.totals.textbook).toBeGreaterThanOrEqual(80);
      expect(body.total).toBeGreaterThanOrEqual(201);
      // 今日只算当日事件，不含基线
      expect(body.today.reaction).toBeGreaterThanOrEqual(1);
      expect(body.today.reaction).toBeLessThan(body.totals.reaction);
    } finally {
      await env.COUNTERS.delete('bases');
    }
  });

  it('survives a corrupted or invalid bases key', async () => {
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
