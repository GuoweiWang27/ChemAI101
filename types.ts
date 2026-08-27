export interface Atom3D {
  element: string;
  x: number;
  y: number;
  z: number;
  color?: string;
  /** 离子电荷；未提供表示中性原子/分子片段。 */
  charge?: number;
  id: number;
}

export interface Bond3D {
  source: number; // Index of atom
  target: number; // Index of atom
  order: number; // 1, 2, 3
}

export interface MoleculeStructure {
  atoms: Atom3D[];
  bonds: Bond3D[];
}

export type VerificationStatus = 'verified' | 'warning' | 'unknown';

export interface Verification {
  status: VerificationStatus;
  /** 未通过的检查明细（中文短句，可直接展示） */
  issues: string[];
  /** 各项检查是否实际执行 */
  checks: { structure: boolean; smiles: boolean };
}

export interface CompoundRecord {
  cid: number;
  iupacName?: string;
  molecularFormula?: string;
  molecularWeight?: string;
  structureType: '3d' | '2d';
  structure: MoleculeStructure;
}

export interface ReactionResult {
  equation: string;
  products: string[];
  mechanismSteps: string[];
  productStructure: MoleculeStructure; // Main product structure
  vseprInfo: string;
  verification?: Verification;
}

export interface NamingResult {
  systematicName: string;
  commonName: string;
  explanation: string;
}

export interface BuilderAtom {
  id: string;
  element: string;
  x: number;
  y: number;
  charge: number;
}

export interface BuilderBond {
  id: string;
  sourceId: string;
  targetId: string;
  order: number; // 1, 2, 3
}

export enum ElementType {
  H = 'H',
  C = 'C',
  N = 'N',
  O = 'O',
  F = 'F',
  Na = 'Na',
  Cl = 'Cl',
  S = 'S',
  P = 'P',
  Br = 'Br',
  I = 'I'
}

export const ELEMENT_COLORS: Record<string, string> = {
  H: '#FFFFFF',
  C: '#909090',
  N: '#3050F8',
  O: '#FF0D0D',
  F: '#90E050',
  Na: '#AB5CF2',
  Cl: '#1FF01F',
  S: '#FFFF30',
  P: '#FF8000',
  Br: '#A62929',
  I: '#940094',
  default: '#FF00FF'
};

export const ELEMENT_RADII: Record<string, number> = {
  H: 0.3,
  C: 0.7,
  N: 0.7,
  O: 0.7,
  F: 0.6,
  Na: 1.5,
  Cl: 1.0,
  S: 1.0,
  P: 1.0,
  Br: 1.1,
  I: 1.3,
  default: 0.8
};

/** 双语元素名（3D 悬停标签与讲解降级卡用），键与 data.test.ts KNOWN_ELEMENTS 对齐 */
export const ELEMENT_NAMES: Record<string, { zh: string; en: string }> = {
  H: { zh: '氢', en: 'Hydrogen' },
  He: { zh: '氦', en: 'Helium' },
  Li: { zh: '锂', en: 'Lithium' },
  Be: { zh: '铍', en: 'Beryllium' },
  B: { zh: '硼', en: 'Boron' },
  C: { zh: '碳', en: 'Carbon' },
  N: { zh: '氮', en: 'Nitrogen' },
  O: { zh: '氧', en: 'Oxygen' },
  F: { zh: '氟', en: 'Fluorine' },
  Ne: { zh: '氖', en: 'Neon' },
  Na: { zh: '钠', en: 'Sodium' },
  Mg: { zh: '镁', en: 'Magnesium' },
  Al: { zh: '铝', en: 'Aluminium' },
  Si: { zh: '硅', en: 'Silicon' },
  P: { zh: '磷', en: 'Phosphorus' },
  S: { zh: '硫', en: 'Sulfur' },
  Cl: { zh: '氯', en: 'Chlorine' },
  Ar: { zh: '氩', en: 'Argon' },
  K: { zh: '钾', en: 'Potassium' },
  Ca: { zh: '钙', en: 'Calcium' },
  Sc: { zh: '钪', en: 'Scandium' },
  Ti: { zh: '钛', en: 'Titanium' },
  V: { zh: '钒', en: 'Vanadium' },
  Cr: { zh: '铬', en: 'Chromium' },
  Mn: { zh: '锰', en: 'Manganese' },
  Fe: { zh: '铁', en: 'Iron' },
  Co: { zh: '钴', en: 'Cobalt' },
  Ni: { zh: '镍', en: 'Nickel' },
  Cu: { zh: '铜', en: 'Copper' },
  Zn: { zh: '锌', en: 'Zinc' },
  Ga: { zh: '镓', en: 'Gallium' },
  Ge: { zh: '锗', en: 'Germanium' },
  As: { zh: '砷', en: 'Arsenic' },
  Se: { zh: '硒', en: 'Selenium' },
  Br: { zh: '溴', en: 'Bromine' },
  Kr: { zh: '氪', en: 'Krypton' },
  Rb: { zh: '铷', en: 'Rubidium' },
  Sr: { zh: '锶', en: 'Strontium' },
  Ag: { zh: '银', en: 'Silver' },
  Sn: { zh: '锡', en: 'Tin' },
  I: { zh: '碘', en: 'Iodine' },
  Ba: { zh: '钡', en: 'Barium' },
  Pt: { zh: '铂', en: 'Platinum' },
  Au: { zh: '金', en: 'Gold' },
  Hg: { zh: '汞', en: 'Mercury' },
  Pb: { zh: '铅', en: 'Lead' },
  default: { zh: '元素', en: 'Element' }
};
