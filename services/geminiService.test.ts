import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompoundNotFoundError, fetchCompound, predictReaction } from './geminiService';

describe('browser ChemAI client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the Worker proxy without sending an API key', async () => {
    const browserFetch = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe(
        'https://chemai101-api.guoweiwang27.workers.dev/v1/analyze',
      );
      const headers = new Headers(init?.headers);
      expect(headers.has('authorization')).toBe(false);
      expect(headers.has('x-api-key')).toBe(false);
      expect(JSON.parse(String(init?.body))).toEqual({
        operation: 'predictReaction',
        reactants: 'H2 + O2',
        conditions: 'spark',
        language: 'en',
      });
      return Response.json({ equation: '2H2 + O2 → 2H2O' });
    });
    vi.stubGlobal('fetch', browserFetch);

    const result = await predictReaction('H2 + O2', 'spark', 'en');

    expect(result.equation).toBe('2H2 + O2 → 2H2O');
  });

  it('loads compound records from the Worker without any credentials', async () => {
    const browserFetch = vi.fn<typeof fetch>(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(
        'https://chemai101-api.guoweiwang27.workers.dev/v1/compound?name=%E9%98%BF%E5%8F%B8%E5%8C%B9%E6%9E%97',
      );
      const headers = new Headers(init?.headers);
      expect(headers.has('authorization')).toBe(false);
      return Response.json({ cid: 2244, structure: { atoms: [], bonds: [] }, structureType: '3d' });
    });
    vi.stubGlobal('fetch', browserFetch);

    const record = await fetchCompound('阿司匹林');
    expect(record.cid).toBe(2244);
  });

  it('raises a dedicated error when the compound is unknown', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => Response.json({}, { status: 404 })));
    await expect(fetchCompound('zzzz')).rejects.toBeInstanceOf(CompoundNotFoundError);
  });
});
