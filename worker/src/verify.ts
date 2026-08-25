import { Atom3D, Bond3D, Verification } from '../../types';
import { getAtomComposition } from '../../utils/molecularWeight';

/** 主族常见最高价态（教学口径）；不在表内的元素跳过价态检查。 */
const VALENCE_MAX: Record<string, number> = {
  H: 1, B: 3, C: 4, N: 4, O: 2, F: 1,
  Na: 1, Mg: 2, Al: 3, Si: 4, P: 5, S: 6,
  Cl: 1, K: 1, Ca: 2, Br: 1, I: 1,
};

const KNOWN_ELEMENTS = new Set([
  ...Object.keys(VALENCE_MAX),
  'He', 'Ne', 'Ar', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
  'Ga', 'Ge', 'As', 'Se', 'Kr', 'Rb', 'Sr', 'Ag', 'Sn', 'Ba', 'Pt', 'Au', 'Hg', 'Pb',
]);

export function valenceIssues(atoms: Atom3D[], bonds: Bond3D[]): string[] {
  const degree = new Map<number, number>();
  for (const bond of bonds) {
    degree.set(bond.source, (degree.get(bond.source) ?? 0) + bond.order);
    degree.set(bond.target, (degree.get(bond.target) ?? 0) + bond.order);
  }
  const symbolById = new Map(atoms.map((atom) => [atom.id, atom.element]));
  const issues: string[] = [];
  for (const [id, valence] of degree) {
    const element = symbolById.get(id) ?? '';
    const max = VALENCE_MAX[element];
    if (max !== undefined && valence > max) {
      issues.push(`${element} 原子 #${id} 成键数 ${valence} 超过常见上限 ${max}`);
    }
  }
  return issues;
}

export function connectivityIssues(atoms: Atom3D[], bonds: Bond3D[]): string[] {
  if (atoms.length <= 1) return [];
  const parent = new Map<number, number>(atoms.map((atom) => [atom.id, atom.id]));
  const find = (x: number): number => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    while (parent.get(x) !== root) {
      const next = parent.get(x)!;
      parent.set(x, root);
      x = next;
    }
    return root;
  };
  for (const bond of bonds) {
    if (!parent.has(bond.source) || !parent.has(bond.target)) continue;
    const ra = find(bond.source);
    const rb = find(bond.target);
    if (ra !== rb) parent.set(ra, rb);
  }
  const components = new Set(atoms.map((atom) => find(atom.id)));
  return components.size > 1 ? [`结构包含 ${components.size} 个互不相连的碎片`] : [];
}

export function heavyCompositionOfAtoms(atoms: Atom3D[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const atom of atoms) {
    if (atom.element === 'H') continue;
    counts[atom.element] = (counts[atom.element] ?? 0) + 1;
  }
  return counts;
}

function heavyCompositionOfSmiles(smiles: string): Record<string, number> | null {
  try {
    const counts = getAtomComposition(smiles);
    delete counts.H;
    return Object.keys(counts).length > 0 ? counts : null;
  } catch {
    return null;
  }
}

function compositionDiff(expected: Record<string, number>, actual: Record<string, number>): string | null {
  const symbols = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const symbol of symbols) {
    const e = expected[symbol] ?? 0;
    const a = actual[symbol] ?? 0;
    if (e !== a) return `SMILES 侧 ${symbol}×${e} vs 结构侧 ${symbol}×${a}`;
  }
  return null;
}

/**
 * 对 DeepSeek 返回的反应结果做确定性校验。
 * status: verified=全部通过 | warning=有未通过项 | unknown=无可校验结构。
 * issues 为中文短句，前端可直接展示。
 */
export function verifyReactionResult(payload: unknown): Verification {
  const body = (payload ?? {}) as {
    productStructure?: { atoms?: Atom3D[]; bonds?: Bond3D[] };
    productSmiles?: unknown;
  };
  const issues: string[] = [];
  let structureChecked = false;
  let smilesChecked = false;

  const structure = body.productStructure;
  if (
    structure &&
    Array.isArray(structure.atoms) && structure.atoms.length > 0 &&
    Array.isArray(structure.bonds)
  ) {
    structureChecked = true;
    for (const atom of structure.atoms) {
      if (!KNOWN_ELEMENTS.has(atom.element)) issues.push(`未知元素 ${atom.element}`);
    }
    issues.push(...valenceIssues(structure.atoms, structure.bonds));
    issues.push(...connectivityIssues(structure.atoms, structure.bonds));

    if (typeof body.productSmiles === 'string' && body.productSmiles.trim().length > 0) {
      const fromSmiles = heavyCompositionOfSmiles(body.productSmiles.trim());
      if (fromSmiles) {
        smilesChecked = true;
        const diff = compositionDiff(fromSmiles, heavyCompositionOfAtoms(structure.atoms));
        if (diff) issues.push(`SMILES 与 3D 结构的重原子组成不一致（${diff}）`);
      }
    }
  }

  const status: Verification['status'] =
    !structureChecked ? 'unknown' : issues.length === 0 ? 'verified' : 'warning';
  return { status, issues, checks: { structure: structureChecked, smiles: smilesChecked } };
}
