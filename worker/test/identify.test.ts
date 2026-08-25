import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import { handleRequest } from '../src/index';

const allowedOrigin = 'https://chemai101.guoweiwang.com';

function identifyRequest(atoms: Array<{ element: string }>): Request {
  return new Request('https://chemai101-api.guoweiwang27.workers.dev/v1/identify', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: allowedOrigin },
    body: JSON.stringify({ atoms }),
  });
}

function formulaUpstream(cids: number[]) {
  return vi.fn<typeof fetch>(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/fastformula/')) {
      return Response.json({ IdentifierList: { CID: cids } });
    }
    const cid = url.match(/\/cid\/(\d+)\//)?.[1];
    return Response.json({
      PropertyTable: { Properties: [{ CID: Number(cid), Title: `Compound ${cid}`, IUPACName: `name-${cid}` }] },
    });
  });
}

describe('builder identify endpoint', () => {
  it('computes hill formula server-side and returns pubchem candidates', async () => {
    const response = await handleRequest(
      identifyRequest([{ element: 'H' }, { element: 'H' }, { element: 'O' }]),
      env,
      formulaUpstream([222]),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      formula: string;
      candidates: Array<{ cid: number; title?: string }>;
    };
    expect(body.formula).toBe('H2O');
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0].cid).toBe(222);
    expect(body.candidates[0].title).toBe('Compound 222');
  });

  it('returns empty candidates when pubchem has no such formula', async () => {
    const upstream = vi.fn<typeof fetch>(async () =>
      Response.json({ Fault: { Code: 'PUGREST.NotFound', Message: '' } }, { status: 404 }),
    );
    const response = await handleRequest(
      identifyRequest([{ element: 'Xx' }]),
      env,
      upstream,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ formula: 'Xx', candidates: [] });
  });

  it('rejects invalid payloads without calling pubchem', async () => {
    const upstream = formulaUpstream([222]);
    for (const bad of [{}, { atoms: [] }, { atoms: [{ element: '' }] }, { atoms: 'nope' }]) {
      const request = new Request('https://chemai101-api.guoweiwang27.workers.dev/v1/identify', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: allowedOrigin },
        body: JSON.stringify(bad),
      });
      const response = await handleRequest(request, env, upstream);
      expect(response.status).toBe(400);
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it('blocks foreign origins at the router level', async () => {
    const request = new Request('https://chemai101-api.guoweiwang27.workers.dev/v1/identify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://attacker.example' },
      body: JSON.stringify({ atoms: [{ element: 'H' }] }),
    });
    const response = await handleRequest(request, env, formulaUpstream([222]));
    expect(response.status).toBe(403);
  });
});
