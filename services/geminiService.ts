import { ReactionResult, NamingResult, BuilderAtom, BuilderBond } from '../types';
import { Language } from '../contexts/LanguageContext';

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
const API_URL =
  viteEnv?.VITE_CHEMAI_API_URL ||
  'https://chemai101-api.guoweiwang27.workers.dev/v1/analyze';

async function requestChemAI<T>(payload: unknown): Promise<T> {
  const response = await fetch(API_URL, {
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
