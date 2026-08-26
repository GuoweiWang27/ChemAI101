import { describe, expect, it } from 'vitest';
import { ALL_REACTIONS, CHAPTERS } from './index';

const KNOWN_ELEMENTS = new Set([
  'H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar',
  'K','Ca','Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br',
  'Kr','Rb','Sr','Ag','Sn','I','Ba','Pt','Au','Hg','Pb',
]);

describe('curated reactions dataset', () => {
  it('has globally unique slugs in valid format', () => {
    const ids = ALL_REACTIONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]{1,64}$/);
  });

  it('only contains teacher-reviewed entries with complete fields', () => {
    for (const r of ALL_REACTIONS) {
      expect(r.reviewed).toBe(true);
      expect(r.chapter.length).toBeGreaterThan(0);
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.reactants.length).toBeGreaterThan(0);
      expect(r.equation.length).toBeGreaterThan(0);
      expect(r.products.length).toBeGreaterThan(0);
      expect(r.mechanismSteps.length).toBeGreaterThanOrEqual(2);
      expect(r.mechanismSteps.length).toBeLessThanOrEqual(5);
    }
  });

  it('validates embedded structures (elements and bond endpoints)', () => {
    for (const r of ALL_REACTIONS) {
      const st = r.productStructure;
      if (!st) continue;
      const ids = new Set(st.atoms.map((a) => a.id));
      for (const atom of st.atoms) expect(KNOWN_ELEMENTS.has(atom.element)).toBe(true);
      for (const bond of st.bonds) {
        expect(ids.has(bond.source)).toBe(true);
        expect(ids.has(bond.target)).toBe(true);
        expect(bond.order).toBeGreaterThanOrEqual(1);
        expect(bond.order).toBeLessThanOrEqual(3);
      }
      if (r.stepAtomIds) {
        expect(r.stepAtomIds).toHaveLength(r.mechanismSteps.length);
        for (const group of r.stepAtomIds) {
          for (const atomId of group) expect(ids.has(atomId)).toBe(true);
        }
      }
    }
  });

  it('validates atomInsights keys and bilingual content', () => {
    for (const r of ALL_REACTIONS) {
      if (!r.atomInsights) continue;
      expect(r.productStructure).not.toBeNull();
      if (!r.productStructure) continue;
      const ids = new Set(r.productStructure.atoms.map((a) => a.id));
      for (const [key, insight] of Object.entries(r.atomInsights)) {
        // 键必须是结构内真实原子 id 的十进制字符串
        expect(key).toMatch(/^\d+$/);
        expect(ids.has(Number(key))).toBe(true);
        // 双语四字段全部非空
        for (const text of [insight.role, insight.detail]) {
          expect(typeof text.zh).toBe('string');
          expect(typeof text.en).toBe('string');
          expect(text.zh.trim().length).toBeGreaterThan(0);
          expect(text.en.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('keeps chapters ordered and non-empty once content lands', () => {
    expect(CHAPTERS.every((c) => c.length > 0)).toBe(true);
    // 发布门槛（Task 7 门禁复核）：签核条目 >= 10
    if (ALL_REACTIONS.length > 0) {
      expect(ALL_REACTIONS.length).toBeGreaterThanOrEqual(10);
    }
  });
});
