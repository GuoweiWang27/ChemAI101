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

function compoundRequest(name: string, origin = allowedOrigin): Request {
  return new Request(
    `https://chemai101-api.guoweiwang27.workers.dev/v1/compound?name=${encodeURIComponent(name)}`,
    { method: 'GET', headers: { origin } },
  );
}

function compoundUpstream() {
  return vi.fn<typeof fetch>(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/cids/JSON')) {
      return Response.json({ IdentifierList: { CID: [2244] } });
    }
    if (url.includes('record_type=3d')) {
      return Response.json({
        PC_Compounds: [
          {
            atoms: { element: [6, 8] },
            bonds: { aid1: [1], aid2: [2], order: [2] },
            coords: [{ conformers: [{ x: [0, 1.3], y: [0, 0.8], z: [0, 0] }] }],
          },
        ],
      });
    }
    return Response.json({
      PropertyTable: { Properties: [{ CID: 2244, MolecularFormula: 'C9H8O4' }] },
    });
  });
}

describe('compound proxy', () => {
  it('blocks origins outside the ChemAI sites', async () => {
    const response = await handleRequest(
      compoundRequest('aspirin', 'https://attacker.example'),
      env,
      compoundUpstream(),
    );
    expect(response.status).toBe(403);
  });

  it('rejects invalid names without calling PubChem', async () => {
    const upstream = compoundUpstream();
    const long = 'a'.repeat(101);
    for (const bad of ['', long, '<script>', 'aspirin;DROP']) {
      const response = await handleRequest(compoundRequest(bad), env, upstream);
      expect(response.status).toBe(400);
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it('returns a normalized PubChem record with CORS headers', async () => {
    const response = await handleRequest(compoundRequest('aspirin'), env, compoundUpstream());
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      cid: number;
      molecularFormula?: string;
      structure: { atoms: unknown[] };
      structureType: string;
    };
    expect(body.cid).toBe(2244);
    expect(body.molecularFormula).toBe('C9H8O4');
    expect(body.structure.atoms.length).toBeGreaterThan(0);
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
  });

  it('maps PubChem not-found to 404', async () => {
    const upstream = vi.fn<typeof fetch>(async () =>
      Response.json({ Fault: { Code: 'PUGREST.NotFound', Message: '' } }, { status: 404 }),
    );
    const response = await handleRequest(compoundRequest('zzzz'), env, upstream);
    expect(response.status).toBe(404);
  });

  it('rejects non-GET methods', async () => {
    const request = new Request(
      'https://chemai101-api.guoweiwang27.workers.dev/v1/compound?name=aspirin',
      { method: 'POST', headers: { origin: allowedOrigin } },
    );
    const response = await handleRequest(request, env, compoundUpstream());
    expect(response.status).toBe(405);
  });
});
