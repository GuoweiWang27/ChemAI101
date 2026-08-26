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

/** 现象解读候选：AI 从大白话描述里认出的候选反应 */
export interface ReactionCandidate {
  reactants: string;
  conditions: string;
  equation: string;
  rationale: string;
}

export interface InterpretResult {
  candidates: ReactionCandidate[];
  note?: string;
}

export const interpretPhenomenon = async (
  phenomenon: string,
  language: Language,
): Promise<InterpretResult> => {
  const data = await requestChemAI<InterpretResult>({
    operation: 'interpretPhenomenon',
    phenomenon,
    language,
  });
  if (!Array.isArray(data.candidates)) {
    throw new Error('Invalid interpretation payload');
  }
  return data;
};

export type TrackEvent = 'reaction' | 'builder' | 'compound' | 'textbook';

/** 匿名使用计数：发后即忘，绝不阻塞或打断主流程 */
export function trackEvent(event: TrackEvent, slug?: string): void {
  const body = slug ? { event, slug } : { event };
  fetch(`${API_BASE}/v1/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}

export interface UsageStats {
  totals: Record<string, number>;
  today: Record<string, number>;
  total: number;
  /** 服务端计数基线（计数功能启用前的既有用量），已计入 totals / total，但不含在 today */
  bases?: Record<string, number>;
}

export async function fetchUsageStats(signal?: AbortSignal): Promise<UsageStats> {
  const response = await fetch(`${API_BASE}/v1/stats`, { signal });
  if (!response.ok) throw new Error(`ChemAI service error (${response.status})`);
  return (await response.json()) as UsageStats;
}

export interface IdentifyCandidate {
  cid: number;
  title?: string;
  iupacName?: string;
  molecularFormula?: string;
}

export interface IdentifyResult {
  formula: string;
  candidates: IdentifyCandidate[];
}

/** 结构构建器识别：元素组成 -> Hill 分子式 -> PubChem 官方候选 */
export async function identifyStructure(
  atoms: Array<{ element: string }>,
  bonds: Array<{ sourceId: number; targetId: number; order: number }>,
  signal?: AbortSignal,
): Promise<IdentifyResult> {
  const response = await fetch(`${API_BASE}/v1/identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ atoms, bonds }),
    signal,
  });
  if (!response.ok) throw new Error(`ChemAI service error (${response.status})`);
  return (await response.json()) as IdentifyResult;
}

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
