export interface Atom3D {
  element: string;
  x: number;
  y: number;
  z: number;
  color?: string;
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

export interface ReactionResult {
  equation: string;
  products: string[];
  mechanismSteps: string[];
  productStructure: MoleculeStructure; // Main product structure
  vseprInfo: string;
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
