import { describe, expect, it } from 'vitest';
import { parseRoute } from './routeParams';

describe('parseRoute', () => {
  it('parses slug and present mode', () => {
    expect(parseRoute('?r=na-h2o&mode=present')).toEqual({ slug: 'na-h2o', present: true });
  });

  it('defaults to self-study mode', () => {
    expect(parseRoute('?r=fe-cl2')).toEqual({ slug: 'fe-cl2', present: false });
  });

  it('returns null slug when missing or invalid', () => {
    expect(parseRoute('')).toEqual({ slug: null, present: false });
    expect(parseRoute('?r=')).toEqual({ slug: null, present: false });
    expect(parseRoute('?r=Bad_Slug!')).toEqual({ slug: null, present: false });
    expect(parseRoute('?mode=present')).toEqual({ slug: null, present: true });
  });
});
