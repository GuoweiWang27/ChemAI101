import { afterEach, describe, expect, it, vi } from 'vitest';
import { predictReaction } from './geminiService';

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
});
