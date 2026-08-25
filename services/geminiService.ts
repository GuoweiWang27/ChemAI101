import { ReactionResult, NamingResult, BuilderAtom, BuilderBond, CompoundRecord } from '../types';
import { Language } from '../contexts/LanguageContext';

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
/** Worker 根地址；如需指向另一套非敏感代理，设置 VITE_CHEMAI_API_BASE（不要设成具体端点） */
const API_BASE =
  viteEnv?.VITE_CHEMAI_API_BASE || 'https://chemai101-api.guoweiwang27.workers.dev';
const ANALYZE_URL = `${API_BASE}/v1/analyze`;

async function requestChemAI<T>(payload: unknown): Promise<T> {
  const response = await fetch(ANALYZE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`ChemAI service error (${response.status})`);
  }

  return (await response.json()) as T;
}

export const predictReaction = async (
  reactants: string,
  conditions: string,
  language: Language,
): Promise<ReactionResult> =>
  requestChemAI<ReactionResult>({
    operation: 'predictReaction',
    reactants,
    conditions,
    language,
  });

export const nameMoleculeFromGraph = async (
  atoms: BuilderAtom[],
  bonds: BuilderBond[],
  language: Language,
): Promise<NamingResult> =>
  requestChemAI<NamingResult>({
    operation: 'nameMolecule',
    atoms: atoms.map((atom) => ({ element: atom.element })),
    bonds: bonds.map((bond) => ({
      sourceId: bond.sourceId,
      targetId: bond.targetId,
      order: bond.order,
    })),
    language,
  });

export class CompoundNotFoundError extends Error {
  constructor() {
    super('Compound not found');
  }
}

export async function fetchCompound(name: string, signal?: AbortSignal): Promise<CompoundRecord> {
  const response = await fetch(
    `${API_BASE}/v1/compound?name=${encodeURIComponent(name)}`,
    { signal },
  );
  if (response.status === 404) throw new CompoundNotFoundError();
  if (!response.ok) throw new Error(`ChemAI service error (${response.status})`);
  return (await response.json()) as CompoundRecord;
}
