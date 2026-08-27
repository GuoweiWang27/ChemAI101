import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LiveStatsLine } from '../components/LiveStatsLine';
import { LanguageProvider } from '../contexts/LanguageContext';

describe('LiveStatsLine', () => {
  it('keeps a visible placeholder while the first stats request is pending', () => {
    const html = renderToStaticMarkup(
      React.createElement(LanguageProvider, null, React.createElement(LiveStatsLine)),
    );

    expect(html).toContain('已累计');
    expect(html).toContain('…');
    expect(html).toContain('次化学探索');
  });
});
