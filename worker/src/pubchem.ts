import { CompoundRecord, MoleculeStructure } from '../../types';
import { ZH_TO_EN } from './zh-names';

const PUBCHEM_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound';

/** PUG REST JSON 的 atoms.element 是原子序数（Z），需要符号表。
 *  覆盖常见课堂元素：1-38 号 + 教学常见的重元素。 */
const Z_TO_SYMBOL: Record<number, string> = {
  1: 'H', 2: 'He', 3: 'Li', 4: 'Be', 5: 'B', 6: 'C', 7: 'N', 8: 'O', 9: 'F', 10: 'Ne',
  11: 'Na', 12: 'Mg', 13: 'Al', 14: 'Si', 15: 'P', 16: 'S', 17: 'Cl', 18: 'Ar', 19: 'K', 20: 'Ca',
  21: 'Sc', 22: 'Ti', 23: 'V', 24: 'Cr', 25: 'Mn', 26: 'Fe', 27: 'Co', 28: 'Ni', 29: 'Cu', 30: 'Zn',
  31: 'Ga', 32: 'Ge', 33: 'As', 34: 'Se', 35: 'Br', 36: 'Kr', 37: 'Rb', 38: 'Sr',
  47: 'Ag', 50: 'Sn', 53: 'I', 56: 'Ba', 78: 'Pt', 79: 'Au', 80: 'Hg', 82: 'Pb',
};

export class PubChemError extends Error {
  constructor(message: string, readonly status: 404 | 503) {
    super(message);
  }
}

type Fetcher = typeof fetch;

interface PcBondBlock {
  aid1: number[];
  aid2: number[];
  order: number[];
}

interface PcCompound {
  atoms: { element: number[] };
  bonds?: PcBondBlock;
  coords?: Array<{ conformers?: Array<{ x?: number[]; y?: number[]; z?: number[] }> }>;
}

interface PcRecord {
  PC_Compounds?: PcCompound[];
}

async function getJson(url: string, fetcher: Fetcher): Promise<unknown> {
  const res = await fetcher(url, {
    headers: { 'user-agent': 'ChemAI101/1.0 (educational chemistry tool)' },
    signal: AbortSignal.timeout(8000),
  });
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  const faultCode = (payload as { Fault?: { Code?: string } } | null)?.Fault?.Code;
  if (!res.ok || faultCode) {
    const code = faultCode ?? `HTTP_${res.status}`;
    if (String(code).includes('NotFound')) throw new PubChemError('not-found', 404);
    throw new PubChemError(`pubchem-${code}`, 503);
  }
  return payload;
}

/** ServerBusy 是常态而非异常：静默重试一次（间隔 300ms） */
async function getJsonWithRetry(url: string, fetcher: Fetcher): Promise<unknown> {
  try {
    return await getJson(url, fetcher);
  } catch (error) {
    if (error instanceof PubChemError && error.status === 503) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return getJson(url, fetcher);
    }
    throw error;
  }
}

export function normalizeStructure(comp: PcCompound): {
  structure: MoleculeStructure;
  structureType: '3d' | '2d';
} {
  const elements = comp.atoms.element;
  const conformer = comp.coords?.[0]?.conformers?.[0];
  const xs = conformer?.x ?? [];
  const ys = conformer?.y ?? [];
  const zs = conformer?.z ?? [];
  const structureType: '3d' | '2d' = zs.length > 0 ? '3d' : '2d';

  const atoms = elements.map((z, i) => ({
    id: i + 1,
    element: Z_TO_SYMBOL[z] ?? `Z${z}`,
    x: xs[i] ?? 0,
    y: ys[i] ?? 0,
    z: zs[i] ?? 0,
  }));

  const validIds = new Set(atoms.map((atom) => atom.id));
  const bondBlocks = comp.bonds;
  const bonds = bondBlocks
    ? bondBlocks.aid1
        .map((aid1, i) => ({
          source: aid1,
          target: bondBlocks.aid2[i],
          order: Math.min(3, Math.max(1, Math.round(bondBlocks.order[i] ?? 1))),
        }))
        .filter(
          (bond) =>
            validIds.has(bond.source) && validIds.has(bond.target) && bond.source !== bond.target,
        )
    : [];

  return { structure: { atoms, bonds }, structureType };
}

async function resolveCid(name: string, fetcher: Fetcher): Promise<number> {
  try {
    return await fetchCidByName(name, fetcher);
  } catch (error) {
    // PubChem 名称索引基本只认英文：中文名（或其他未命中名称）404 时回退中英词典
    if (error instanceof PubChemError && error.status === 404 && ZH_TO_EN[name]) {
      return fetchCidByName(ZH_TO_EN[name], fetcher);
    }
    throw error;
  }
}

async function fetchCidByName(name: string, fetcher: Fetcher): Promise<number> {
  const data = (await getJsonWithRetry(
    `${PUBCHEM_BASE}/name/${encodeURIComponent(name)}/cids/JSON`,
    fetcher,
  )) as { IdentifierList?: { CID?: number[] } };
  const cid = data.IdentifierList?.CID?.[0];
  if (!cid) throw new PubChemError('not-found', 404);
  return cid;
}

async function fetchCompoundRecord(
  cid: number,
  fetcher: Fetcher,
): Promise<PcRecord> {
  try {
    return (await getJsonWithRetry(
      `${PUBCHEM_BASE}/cid/${cid}/JSON?record_type=3d`,
      fetcher,
    )) as PcRecord;
  } catch (error) {
    // 3D 记录缺失（很多盐类/小分子没有 3D）：回退 2D；但上游忙要继续抛
    if (error instanceof PubChemError && error.status === 503) throw error;
  }
  return (await getJsonWithRetry(`${PUBCHEM_BASE}/cid/${cid}/JSON`, fetcher)) as PcRecord;
}

async function fetchCompoundProperties(
  cid: number,
  fetcher: Fetcher,
): Promise<{ IUPACName?: string; MolecularFormula?: string; MolecularWeight?: number }> {
  try {
    const data = (await getJsonWithRetry(
      `${PUBCHEM_BASE}/cid/${cid}/property/IUPACName,MolecularFormula,MolecularWeight/JSON`,
      fetcher,
    )) as { PropertyTable?: { Properties?: Array<Record<string, unknown>> } };
    return (data.PropertyTable?.Properties?.[0] ?? {}) as {
      IUPACName?: string;
      MolecularFormula?: string;
      MolecularWeight?: number;
    };
  } catch {
    return {}; // 属性缺失不影响结构展示
  }
}

export async function lookupCompound(
  name: string,
  fetcher: Fetcher,
): Promise<CompoundRecord> {
  const cid = await resolveCid(name, fetcher);
  const [record, props] = await Promise.all([
    fetchCompoundRecord(cid, fetcher),
    fetchCompoundProperties(cid, fetcher),
  ]);
  const comp = record.PC_Compounds?.[0];
  if (!comp) throw new PubChemError('empty-record', 503);
  const { structure, structureType } = normalizeStructure(comp);
  return {
    cid,
    iupacName: props.IUPACName,
    molecularFormula: props.MolecularFormula,
    molecularWeight:
      props.MolecularWeight != null ? String(props.MolecularWeight) : undefined,
    structureType,
    structure,
  };
}
