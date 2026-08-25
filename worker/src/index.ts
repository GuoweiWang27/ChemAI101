import { lookupCompound, PubChemError, searchByFormula } from './pubchem';
import { hillFormula } from '../../utils/moleculeAnalysis';
import { verifyReactionResult } from './verify';

const ALLOWED_ORIGINS = new Set([
  'https://chemai101.guoweiwang.com',
  'https://chemai101.pages.dev',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

const MAX_REQUEST_BYTES = 32 * 1024;
const MAX_UPSTREAM_BYTES = 1024 * 1024;

type Language = 'en' | 'zh';

type AnalyzeRequest =
  | {
      operation: 'predictReaction';
      reactants: string;
      conditions: string;
      language: Language;
    }
  | {
      operation: 'nameMolecule';
      atoms: Array<{ element: string }>;
      bonds: Array<{ sourceId: number; targetId: number; order: number }>;
      language: Language;
    };

type Fetcher = typeof fetch;

class PayloadTooLargeError extends Error {}

function corsHeaders(origin: string): Headers {
  return new Headers({
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-origin': origin,
    'access-control-max-age': '86400',
    vary: 'Origin',
  });
}

function jsonResponse(payload: unknown, status: number, origin?: string): Response {
  const headers = origin ? corsHeaders(origin) : new Headers();
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(payload), { status, headers });
}

async function readJsonWithLimit(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<unknown> {
  if (!stream) return null;

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError();
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'zh';
}

function asAnalyzeRequest(value: unknown): AnalyzeRequest | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  if (!isLanguage(body.language)) return null;

  if (body.operation === 'predictReaction') {
    if (
      typeof body.reactants !== 'string' ||
      body.reactants.trim().length === 0 ||
      body.reactants.length > 4000 ||
      typeof body.conditions !== 'string' ||
      body.conditions.length > 2000
    ) {
      return null;
    }
    return {
      operation: body.operation,
      reactants: body.reactants,
      conditions: body.conditions,
      language: body.language,
    };
  }

  if (body.operation === 'nameMolecule') {
    if (!Array.isArray(body.atoms) || !Array.isArray(body.bonds)) return null;
    if (body.atoms.length === 0 || body.atoms.length > 128 || body.bonds.length > 256) {
      return null;
    }

    const atoms = body.atoms.filter(
      (atom): atom is { element: string } =>
        Boolean(
          atom &&
            typeof atom === 'object' &&
            typeof (atom as Record<string, unknown>).element === 'string' &&
            ((atom as Record<string, unknown>).element as string).length <= 4,
        ),
    );
    const bonds = body.bonds.filter(
      (bond): bond is { sourceId: number; targetId: number; order: number } => {
        if (!bond || typeof bond !== 'object') return false;
        const candidate = bond as Record<string, unknown>;
        return (
          Number.isInteger(candidate.sourceId) &&
          Number.isInteger(candidate.targetId) &&
          Number.isInteger(candidate.order) &&
          Number(candidate.order) >= 1 &&
          Number(candidate.order) <= 3
        );
      },
    );
    if (atoms.length !== body.atoms.length || bonds.length !== body.bonds.length) return null;

    return {
      operation: body.operation,
      atoms,
      bonds,
      language: body.language,
    };
  }

  return null;
}

function buildPrompt(body: AnalyzeRequest): string {
  const languageInstruction =
    body.language === 'zh' ? 'Provide output in Simplified Chinese.' : 'Provide output in English.';

  if (body.operation === 'predictReaction') {
    return `
Analyze reaction: ${body.reactants} under ${body.conditions}.
1. Predict products & balanced equation.
2. Mechanism steps.
3. 3D VSEPR info for main product (atoms x,y,z approx -5 to 5, CPK colors).
${languageInstruction}
Return strictly JSON matching this structure:
{
  "equation": "string",
  "products": ["string"],
  "productSmiles": "canonical SMILES of the main product",
  "mechanismSteps": ["string"],
  "vseprInfo": "string",
  "productStructure": {
    "atoms": [{ "id": 1, "element": "C", "x": 0, "y": 0, "z": 0, "color": "#909090" }],
    "bonds": [{ "source": 1, "target": 2, "order": 1 }]
  }
}`;
  }

  const graphData = {
    atoms: body.atoms.map((atom) => ({ e: atom.element })),
    bonds: body.bonds.map((bond) => ({ s: bond.sourceId, t: bond.targetId, o: bond.order })),
  };
  return `Name this molecule: ${JSON.stringify(graphData)}. ${languageInstruction} Return JSON: { "systematicName": "", "commonName": "", "explanation": "" }`;
}

export async function handleRequest(
  request: Request,
  env: Env,
  fetcher: Fetcher = fetch,
  cache?: Cache,
): Promise<Response> {
  const origin = request.headers.get('origin') ?? '';
  if (!ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse({ error: 'Origin not allowed' }, 403);
  }

  const url = new URL(request.url);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (url.pathname === '/v1/analyze') {
    return handleAnalyze(request, env, origin, fetcher);
  }
  if (url.pathname === '/v1/compound') {
    return handleCompound(request, env, origin, fetcher, cache);
  }
  if (url.pathname === '/v1/identify') {
    return handleIdentify(request, env, origin, fetcher);
  }
  return jsonResponse({ error: 'Not found' }, 404, origin);
}

async function handleAnalyze(
  request: Request,
  env: Env,
  origin: string,
  fetcher: Fetcher,
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse({ error: 'Request too large' }, 413, origin);
  }

  let rawBody: unknown;
  try {
    rawBody = await readJsonWithLimit(request.body, MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return jsonResponse({ error: 'Request too large' }, 413, origin);
    }
    return jsonResponse({ error: 'Invalid JSON' }, 400, origin);
  }

  const body = asAnalyzeRequest(rawBody);
  if (!body) {
    return jsonResponse({ error: 'Invalid request' }, 400, origin);
  }

  const actor = request.headers.get('cf-connecting-ip') || 'anonymous';
  const rateLimit = await env.API_RATE_LIMITER.limit({
    key: `${actor}:${body.operation}`,
  });
  if (!rateLimit.success) {
    console.warn(JSON.stringify({ message: 'request rate limited', operation: body.operation }));
    return jsonResponse({ error: 'Too many requests' }, 429, origin);
  }

  try {
    const upstream = await fetcher(env.UPSTREAM_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: env.MODEL_NAME,
        messages: [{ role: 'user', content: buildPrompt(body) }],
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
        max_tokens: 4096,
        ...(body.operation === 'predictReaction' ? { temperature: 0.3 } : {}),
      }),
    });

    if (!upstream.ok) {
      console.error(
        JSON.stringify({ message: 'upstream request failed', status: upstream.status }),
      );
      return jsonResponse({ error: 'AI service unavailable' }, 502, origin);
    }

    const upstreamPayload = await readJsonWithLimit(upstream.body, MAX_UPSTREAM_BYTES);
    if (!upstreamPayload || typeof upstreamPayload !== 'object') {
      throw new Error('Invalid upstream payload');
    }
    const choices = (upstreamPayload as Record<string, unknown>).choices;
    if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') {
      throw new Error('Missing upstream choice');
    }
    const message = (choices[0] as Record<string, unknown>).message;
    if (!message || typeof message !== 'object') throw new Error('Missing upstream message');
    const content = (message as Record<string, unknown>).content;
    if (typeof content !== 'string') throw new Error('Missing upstream content');

    const parsed: unknown = JSON.parse(content);
    return jsonResponse(
      { ...(parsed as object), verification: verifyReactionResult(parsed) },
      200,
      origin,
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'proxy request failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    );
    return jsonResponse({ error: 'AI service unavailable' }, 502, origin);
  }
}

const COMPOUND_NAME_RE = /^[\p{L}\p{N}\s()\[\]\-,]{1,100}$/u;

async function handleCompound(
  request: Request,
  env: Env,
  origin: string,
  fetcher: Fetcher,
  cache?: Cache,
): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  const url = new URL(request.url);
  const name = (url.searchParams.get('name') ?? '').trim();
  if (!COMPOUND_NAME_RE.test(name)) {
    return jsonResponse({ error: 'Invalid compound name' }, 400, origin);
  }

  const cacheKey = new Request(`${url.origin}/v1/compound:${name.toLowerCase()}`);
  if (cache) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached && cached.ok) {
        const data = await cached.json();
        return jsonResponse(data, 200, origin);
      }
    } catch {
      // 缓存故障降级为直查
    }
  }

  const actor = request.headers.get('cf-connecting-ip') || 'anonymous';
  const rateLimit = await env.API_RATE_LIMITER.limit({ key: `${actor}:compound` });
  if (!rateLimit.success) {
    console.warn(JSON.stringify({ message: 'request rate limited', operation: 'compound' }));
    return jsonResponse({ error: 'Too many requests' }, 429, origin);
  }

  try {
    const record = await lookupCompound(name, fetcher);
    if (cache) {
      try {
        const stored = new Response(JSON.stringify(record), {
          headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=86400' },
        });
        await cache.put(cacheKey, stored.clone()); // clone 保返回体，put 消费副本
      } catch {
        // 缓存写入失败不影响响应
      }
    }
    return jsonResponse(record, 200, origin);
  } catch (error) {
    if (error instanceof PubChemError && error.status === 404) {
      return jsonResponse({ error: 'Compound not found' }, 404, origin);
    }
    console.error(
      JSON.stringify({
        message: 'pubchem lookup failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    );
    return jsonResponse({ error: 'Chemistry data source unavailable' }, 503, origin);
  }
}

const IDENTIFY_MAX_ATOMS = 128;

interface IdentifyBody {
  atoms: Array<{ element: string }>;
}

function asIdentifyRequest(value: unknown): IdentifyBody | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  if (!Array.isArray(body.atoms) || body.atoms.length === 0 || body.atoms.length > IDENTIFY_MAX_ATOMS) {
    return null;
  }
  const atoms: Array<{ element: string }> = [];
  for (const atom of body.atoms) {
    if (!atom || typeof atom !== 'object') return null;
    const element = (atom as Record<string, unknown>).element;
    if (typeof element !== 'string' || element.length < 1 || element.length > 4) return null;
    atoms.push({ element });
  }
  return { atoms };
}

/** 结构构建器识别：由元素组成计算 Hill 分子式，检索 PubChem 官方候选命名。 */
async function handleIdentify(
  request: Request,
  env: Env,
  origin: string,
  fetcher: Fetcher,
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  let raw: unknown;
  try {
    raw = await readJsonWithLimit(request.body, MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return jsonResponse({ error: 'Request too large' }, 413, origin);
    }
    return jsonResponse({ error: 'Invalid JSON' }, 400, origin);
  }
  const body = asIdentifyRequest(raw);
  if (!body) return jsonResponse({ error: 'Invalid request' }, 400, origin);

  const actor = request.headers.get('cf-connecting-ip') || 'anonymous';
  const rateLimit = await env.API_RATE_LIMITER.limit({ key: `${actor}:identify` });
  if (!rateLimit.success) {
    console.warn(JSON.stringify({ message: 'request rate limited', operation: 'identify' }));
    return jsonResponse({ error: 'Too many requests' }, 429, origin);
  }

  const formula = hillFormula(body.atoms);
  if (!formula) return jsonResponse({ error: 'Empty structure' }, 400, origin);

  try {
    const candidates = await searchByFormula(formula, fetcher);
    return jsonResponse({ formula, candidates }, 200, origin);
  } catch (error) {
    // PubChem 无此分子式记录属于正常空结果，不是服务故障
    if (error instanceof PubChemError && error.status === 404) {
      return jsonResponse({ formula, candidates: [] }, 200, origin);
    }
    console.error(
      JSON.stringify({
        message: 'identify failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    );
    return jsonResponse({ error: 'Identification service unavailable' }, 502, origin);
  }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    // tsconfig 同时含 DOM 与 workers-types；取 workers 语义的 caches.default
    const cache = (caches as unknown as { default?: Cache }).default;
    return handleRequest(request, env, fetch, cache);
  },
} satisfies ExportedHandler<Env>;
