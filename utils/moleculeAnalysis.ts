import { BuilderAtom, BuilderBond } from '../types';

/** 元素计数（用于分子式） */
export function elementCounts(atoms: Array<{ element: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const atom of atoms) {
    counts[atom.element] = (counts[atom.element] ?? 0) + 1;
  }
  return counts;
}

/** Hill 规则排序的 ASCII 分子式：有 C 时 C 在前 H 次之其余字母序；无 C 全字母序。 */
export function hillFormula(atoms: Array<{ element: string }>): string {
  const counts = elementCounts(atoms);
  const symbols = Object.keys(counts);
  if (symbols.length === 0) return '';
  const withCarbon = counts.C !== undefined;
  const ordered = withCarbon
    ? ['C', ...(counts.H ? ['H'] : []), ...symbols.filter((s) => s !== 'C' && s !== 'H').sort()]
    : symbols.sort();
  return ordered.map((sym) => `${sym}${counts[sym] > 1 ? counts[sym] : ''}`).join('');
}

/** 数字转 Unicode 下标（展示用）：H2O -> H₂O */
export function toSubscript(formula: string): string {
  const subs = '₀₁₂₃₄₅₆₇₈₉';
  return formula.replace(/\d/g, (digit) => subs[Number(digit)]);
}

export interface GraphValidation {
  ok: boolean;
  /** 无效键引用（指向不存在原子或自环） */
  invalidBondIds: string[];
  /** 连通分量数（>1 表示画布上有多于一个独立碎片） */
  components: number;
  formulaAscii: string;
  formulaDisplay: string;
}

/** 校验键图并给出连通性与分子式。纯函数，供前端与 Worker 共用。 */
export function validateGraph(
  atoms: Array<{ id: string; element: string }>,
  bonds: Array<{ id?: string; sourceId: string; targetId: string; order: number }>,
): GraphValidation {
  const ids = new Set(atoms.map((a) => a.id));
  const invalidBondIds: string[] = [];
  const valid: Array<{ a: string; b: string }> = [];
  for (const bond of bonds) {
    if (!ids.has(bond.sourceId) || !ids.has(bond.targetId) || bond.sourceId === bond.targetId) {
      invalidBondIds.push(bond.id ?? `${bond.sourceId}-${bond.targetId}`);
      continue;
    }
    if (bond.order >= 1 && bond.order <= 3) valid.push({ a: bond.sourceId, b: bond.targetId });
  }

  // 并查集数连通分量
  const parent = new Map<string, string>(atoms.map((a) => [a.id, a.id]));
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    while (parent.get(x) !== root) {
      const next = parent.get(x)!;
      parent.set(x, root);
      x = next;
    }
    return root;
  };
  for (const { a, b } of valid) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }
  const components = new Set(atoms.map((a) => find(a.id))).size;

  const formulaAscii = hillFormula(atoms);
  return {
    ok: invalidBondIds.length === 0,
    invalidBondIds,
    components,
    formulaAscii,
    formulaDisplay: toSubscript(formulaAscii),
  };
}

/** 从 BuilderAtom/Bond 构造可发送的分析负载（仅元素与键级，不含画布坐标） */
export function toIdentifyPayload(
  atoms: BuilderAtom[],
  bonds: BuilderBond[],
): {
  atoms: Array<{ element: string }>;
  bonds: Array<{ sourceId: number; targetId: number; order: number }>;
} {
  const indexById = new Map(atoms.map((a, i) => [a.id, i]));
  return {
    atoms: atoms.map((a) => ({ element: a.element })),
    bonds: bonds
      .filter((b) => indexById.has(b.sourceId) && indexById.has(b.targetId))
      .map((b) => ({
        sourceId: indexById.get(b.sourceId)!,
        targetId: indexById.get(b.targetId)!,
        order: Math.min(3, Math.max(1, Math.round(b.order))),
      })),
  };
}
