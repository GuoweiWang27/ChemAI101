import { describe, expect, it } from 'vitest';
import { ZH_TO_EN } from '../src/zh-names';

describe('zh-en compound dictionary', () => {
  it('covers classroom essentials with non-empty english names', () => {
    for (const zh of ['水', '阿司匹林', '小苏打', '熟石灰', '乙醇', '高锰酸钾', '四氧化三铁']) {
      expect(ZH_TO_EN[zh], `missing entry: ${zh}`).toBeTruthy();
    }
    for (const [, en] of Object.entries(ZH_TO_EN)) {
      expect(en.length).toBeGreaterThan(0);
      expect(en).toMatch(/^[A-Za-z0-9()\[\] ,·\-]+$/);
    }
  });
});
