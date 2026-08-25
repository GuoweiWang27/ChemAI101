import { describe, expect, it } from 'vitest';
import { hillFormula, toSubscript, toIdentifyPayload, validateGraph } from './moleculeAnalysis';
import { BuilderAtom, BuilderBond } from '../types';

describe('hillFormula', () => {
  it('water = H2O (no carbon: alphabetical)', () => {
    expect(hillFormula([{ element: 'H' }, { element: 'H' }, { element: 'O' }])).toBe('H2O');
  });
  it('methane = CH4 (carbon first, then H, rest alphabetical)', () => {
    expect(hillFormula([{ element: 'H' }, { element: 'H' }, { element: 'H' }, { element: 'H' }, { element: 'C' }])).toBe('CH4');
  });
  it('ethanol C2H6O', () => {
    const atoms = [
      { element: 'C' }, { element: 'C' }, { element: 'H' }, { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' }, { element: 'O' }, { element: 'H' },
    ];
    expect(hillFormula(atoms)).toBe('C2H6O');
  });
  it('sodium chloride = ClNa (alphabetical without carbon)', () => {
    expect(hillFormula([{ element: 'Na' }, { element: 'Cl' }])).toBe('ClNa');
  });
  it('empty canvas = empty formula', () => {
    expect(hillFormula([])).toBe('');
  });
});

describe('toSubscript', () => {
  it('converts digits to unicode subscripts', () => {
    expect(toSubscript('H2O')).toBe('H₂O');
    expect(toSubscript('C6H12O6')).toBe('C₆H₁₂O₆');
  });
});

describe('validateGraph', () => {
  const atoms = [
    { id: 'a1', element: 'O' },
    { id: 'a2', element: 'H' },
    { id: 'a3', element: 'H' },
  ];

  it('water graph validates with one component', () => {
    const v = validateGraph(atoms, [
      { id: 'b1', sourceId: 'a1', targetId: 'a2', order: 1 },
      { id: 'b2', sourceId: 'a1', targetId: 'a3', order: 1 },
    ]);
    expect(v.ok).toBe(true);
    expect(v.components).toBe(1);
    expect(v.formulaAscii).toBe('H2O');
    expect(v.formulaDisplay).toBe('H₂O');
  });

  it('flags bonds pointing to missing atoms or self-loops', () => {
    const v = validateGraph(atoms, [
      { id: 'bad1', sourceId: 'a1', targetId: 'ghost', order: 1 },
      { id: 'bad2', sourceId: 'a2', targetId: 'a2', order: 2 },
    ]);
    expect(v.ok).toBe(false);
    expect(v.invalidBondIds).toEqual(['bad1', 'bad2']);
  });

  it('detects disconnected fragments', () => {
    const v = validateGraph(
      [...atoms, { id: 'a4', element: 'N' }, { id: 'a5', element: 'H' }],
      [{ id: 'b1', sourceId: 'a1', targetId: 'a2', order: 1 }],
    );
    expect(v.components).toBe(4); // O-H 碎片 + 游离 H(a3) + 游离 N + 游离 H(a5)
  });
});

describe('toIdentifyPayload', () => {
  it('maps string ids to indices and drops dangling bonds', () => {
    const builderAtoms: BuilderAtom[] = [
      { id: 'x1', element: 'O', x: 0, y: 0, charge: 0 },
      { id: 'x2', element: 'H', x: 5, y: 0, charge: 0 },
    ];
    const builderBonds: BuilderBond[] = [
      { id: 'k1', sourceId: 'x1', targetId: 'x2', order: 1 },
    ];
    const payload = toIdentifyPayload(builderAtoms, builderBonds);
    expect(payload.atoms).toEqual([{ element: 'O' }, { element: 'H' }]);
    expect(payload.bonds).toEqual([{ sourceId: 0, targetId: 1, order: 1 }]);
  });
});
