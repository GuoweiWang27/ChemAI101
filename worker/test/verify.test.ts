import { describe, expect, it } from 'vitest';
import { verifyReactionResult } from '../src/verify';
import type { MoleculeStructure } from '../../types';

function molecule(pairs: Array<[element: string, bondsTo: number[]]>): MoleculeStructure {
  const atoms = pairs.map(([element], i) => ({ id: i + 1, element, x: 0, y: 0, z: 0 }));
  // 只在 j > i+1 时生成边，避免 A→B 与 B→A 各记一条导致价态翻倍
  const bonds = pairs.flatMap(([, bondsTo], i) =>
    bondsTo.filter((j) => j > i + 1).map((j) => ({ source: i + 1, target: j, order: 1 })),
  );
  return { atoms, bonds };
}

const methane = molecule([['C', [2, 3, 4, 5]], ['H', [1]], ['H', [1]], ['H', [1]], ['H', [1]]]);

describe('verifyReactionResult', () => {
  it('verifies a clean methane result with matching SMILES', () => {
    const v = verifyReactionResult({ productStructure: methane, productSmiles: 'C' });
    expect(v.status).toBe('verified');
    expect(v.issues).toEqual([]);
    expect(v.checks).toEqual({ structure: true, smiles: true });
  });

  it('flags over-valent carbon', () => {
    const bad = molecule([['C', [2, 3, 4, 5, 6]], ['H', [1]], ['H', [1]], ['H', [1]], ['H', [1]], ['Cl', [1]]]);
    const v = verifyReactionResult({ productStructure: bad });
    expect(v.status).toBe('warning');
    expect(v.issues.some((i) => i.includes('C') && i.includes('5'))).toBe(true);
    expect(v.checks.smiles).toBe(false);
  });

  it('flags SMILES / structure composition mismatch', () => {
    const v = verifyReactionResult({ productStructure: methane, productSmiles: 'CCO' });
    expect(v.status).toBe('warning');
    expect(v.issues[0]).toContain('重原子组成不一致');
  });

  it('flags disconnected fragments', () => {
    const twoFragments = {
      atoms: [
        { id: 1, element: 'C', x: 0, y: 0, z: 0 },
        { id: 2, element: 'O', x: 1, y: 0, z: 0 },
      ],
      bonds: [],
    };
    const v = verifyReactionResult({ productStructure: twoFragments });
    expect(v.status).toBe('warning');
    expect(v.issues.some((i) => i.includes('互不相连'))).toBe(true);
  });

  it('returns unknown when no usable structure came back', () => {
    const v = verifyReactionResult({ equation: '2H2 + O2 → 2H2O' });
    expect(v.status).toBe('unknown');
    expect(v.checks).toEqual({ structure: false, smiles: false });
  });
});
