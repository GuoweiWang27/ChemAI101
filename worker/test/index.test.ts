import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import { handleRequest } from '../src/index';

const allowedOrigin = 'https://chemai101.guoweiwang.com';

function request(body: unknown, origin = allowedOrigin): Request {
  return new Request('https://chemai101-api.guoweiwang27.workers.dev/v1/analyze', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
    },
    body: JSON.stringify(body),
  });
}

describe('ChemAI proxy', () => {
  it('blocks origins outside the ChemAI sites', async () => {
    const upstream = vi.fn<typeof fetch>();

    const response = await handleRequest(
      request({ operation: 'predictReaction' }, 'https://attacker.example'),
      env,
      upstream,
    );

    expect(response.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('answers CORS preflight for the production origin', async () => {
    const response = await handleRequest(
      new Request('https://chemai101-api.guoweiwang27.workers.dev/v1/analyze', {
        method: 'OPTIONS',
        headers: { origin: allowedOrigin },
      }),
      env,
      vi.fn<typeof fetch>(),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
  });

  it('keeps the API key server-side and returns parsed reaction JSON', async () => {
    const upstream = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe(env.UPSTREAM_URL);
      expect(new Headers(init?.headers).get('authorization')).toBe(
        `Bearer ${env.DEEPSEEK_API_KEY}`,
      );
      const upstreamBody = JSON.parse(String(init?.body));
      expect(upstreamBody.model).toBe(env.MODEL_NAME);
      expect(upstreamBody.thinking).toEqual({ type: 'disabled' });
      expect(upstreamBody.max_tokens).toBe(4096);
      expect(upstreamBody.messages[0].content).toContain('H2 + O2');
      return Response.json({
        choices: [{ message: { content: '{"equation":"2H2 + O2 → 2H2O"}' } }],
      });
    });

    const response = await handleRequest(
      request({
        operation: 'predictReaction',
        reactants: 'H2 + O2',
        conditions: 'spark',
        language: 'en',
      }),
      env,
      upstream,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ equation: '2H2 + O2 → 2H2O' });
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
  });

  it('rejects oversized user input before calling the upstream API', async () => {
    const upstream = vi.fn<typeof fetch>();
    const response = await handleRequest(
      request({
        operation: 'predictReaction',
        reactants: 'C'.repeat(4001),
        conditions: '',
        language: 'en',
      }),
      env,
      upstream,
    );

    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('stops a valid request when the rate limit is exhausted', async () => {
    const upstream = vi.fn<typeof fetch>(async () =>
      Response.json({
        choices: [{ message: { content: '{"equation":"2H2 + O2 → 2H2O"}' } }],
      }),
    );
    const limitedEnv = {
      ...env,
      API_RATE_LIMITER: {
        limit: vi.fn(async () => ({ success: false })),
      },
    };

    const response = await handleRequest(
      request({
        operation: 'predictReaction',
        reactants: 'H2 + O2',
        conditions: 'spark',
        language: 'en',
      }),
      limitedEnv,
      upstream,
    );

    expect(response.status).toBe(429);
    expect(upstream).not.toHaveBeenCalled();
  });
});
