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
    }
  | {
      operation: 'interpretPhenomenon';
      phenomenon: string;
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

  if (body.operation === 'interpretPhenomenon') {
    if (
      typeof body.phenomenon !== 'string' ||
      body.phenomenon.trim().length === 0 ||
      body.phenomenon.length > 4000
    ) {
      return null;
    }
    return {
      operation: body.operation,
      phenomenon: body.phenomenon,
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

  if (body.operation === 'interpretPhenomenon') {
    return buildInterpretPrompt(body);
  }

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

function buildInterpretPrompt(body: Extract<AnalyzeRequest, { operation: 'interpretPhenomenon' }>): string {
  const languageInstruction =
    body.language === 'zh' ? 'All output text in Simplified Chinese.' : 'All output text in English.';
  return `
A student describes a chemistry phenomenon or demo in their own words:
"${body.phenomenon}"

Interpret which classroom-safe demonstration reaction(s) they most likely mean.
Rules:
- Only well-known teaching-level demonstrations (middle/high school chemistry). Never interpret requests involving weapons, poisons, drugs or explosives synthesis.
- If the description is not about a benign classroom demo, or you cannot identify any reaction, return an empty candidates array and explain briefly in "note".
- Otherwise provide 2-3 candidates (distinct plausible interpretations), ordered by likelihood.
${languageInstruction}
Return strictly JSON matching this structure:
{
  "candidates": [
    {
      "reactants": "comma-separated reactant formulas/names for the analysis pipeline",
      "conditions": "conditions string (temperature/catalyst etc., may be empty)",
      "equation": "balanced chemical equation",
      "rationale": "one sentence: why this reaction matches the described phenomenon"
    }
  ],
  "note": "short remark when candidates is empty, otherwise empty string"
}`;
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
  if (url.pathname === '/v1/track') {
    return handleTrack(request, env, origin);
  }
  if (url.pathname === '/v1/stats') {
    return handleStats(request, env, origin);
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
        messages: [
          {
            role: 'user',
            content:
              body.operation === 'interpretPhenomenon'
                ? buildInterpretPrompt(body)
                : buildPrompt(body),
          },
        ],
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
        max_tokens: 4096,
        ...(body.operation === 'predictReaction' ? { temperature: 0.3 } : {}),
        ...(body.operation === 'interpretPhenomenon' ? { temperature: 0.5 } : {}),
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

const TRACK_EVENTS = new Set(['reaction', 'builder', 'compound', 'textbook']);
const SLUG_RE = /^[a-z0-9-]{1,64}$/;
const TRACK_TTL_SECONDS = 7776000; // 90 天

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

/** 匿名使用计数：每次使用写一个唯一 key（天然原子，无读改写竞态），读取时按前缀聚合计数。 */
async function handleTrack(request: Request, env: Env, origin: string): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  let raw: unknown;
  try {
    raw = await readJsonWithLimit(request.body, 1024);
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, origin);
  }
  const body = (raw ?? {}) as Record<string, unknown>;
  const event = typeof body.event === 'string' ? body.event : '';
  if (!TRACK_EVENTS.has(event)) {
    return jsonResponse({ error: 'Invalid event' }, 400, origin);
  }
  let slug = '';
  if (body.slug !== undefined) {
    if (typeof body.slug !== 'string' || !SLUG_RE.test(body.slug)) {
      return jsonResponse({ error: 'Invalid slug' }, 400, origin);
    }
    slug = body.slug;
  }

  const actor = request.headers.get('cf-connecting-ip') || 'anonymous';
  const rateLimit = await env.API_RATE_LIMITER.limit({ key: `${actor}:track` });
  if (!rateLimit.success) {
    return jsonResponse({ error: 'Too many requests' }, 429, origin);
  }

  try {
    const key = `t:${event}:${todayStamp()}:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await env.COUNTERS.put(key, slug, { expirationTtl: TRACK_TTL_SECONDS });
  } catch (error) {
    // 计数失败绝不影响主功能
    console.error(
      JSON.stringify({ message: 'track write failed', error: error instanceof Error ? error.message : 'unknown' }),
    );
  }
  return new Response(null, { status: 204 });
}

/** 计数基线：计数功能启用前的既有用量。存 KV 单键 JSON，可通过 wrangler 配置，无需重新部署。 */
const BASES_KEY = 'bases';

/** 读计数基线。键不存在 / JSON 损坏 / 字段非法时一律按 0 处理——基线只参与汇总，绝不能弄坏 stats。 */
function emptyBases(): Record<string, number> {
  const bases: Record<string, number> = {};
  for (const event of TRACK_EVENTS) bases[event] = 0;
  return bases;
}

async function readBases(env: Env): Promise<Record<string, number>> {
  let raw: string | null;
  try {
    raw = await env.COUNTERS.get(BASES_KEY);
  } catch (error) {
    console.error(
      JSON.stringify({ message: 'bases read failed', error: error instanceof Error ? error.message : 'unknown' }),
    );
    return emptyBases();
  }
  if (!raw) return emptyBases();
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const bases = emptyBases();
    for (const event of TRACK_EVENTS) {
      const value = parsed[event];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        bases[event] = Math.floor(value);
      }
    }
    return bases;
  } catch {
    return emptyBases();
  }
}

async function countPrefix(env: Env, prefix: string): Promise<number> {
  let count = 0;
  let cursor: string | undefined;
  for (;;) {
    const page = (await env.COUNTERS.list({ prefix, cursor })) as {
      keys: Array<{ name: string }>;
      list_complete: boolean;
      cursor?: string;
    };
    count += page.keys.length;
    if (page.list_complete) break;
    cursor = page.cursor;
  }
  return count;
}

async function handleStats(request: Request, env: Env, origin: string): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }
  const bases = await readBases(env);
  const totals: Record<string, number> = {};
  const today: Record<string, number> = {};
  const stamp = todayStamp();
  let total = 0;
  for (const event of TRACK_EVENTS) {
    totals[event] = (await countPrefix(env, `t:${event}:`)) + (bases[event] ?? 0);
    // 今日数只统计当日事件，不含基线
    today[event] = await countPrefix(env, `t:${event}:${stamp}`);
    total += totals[event];
  }
  return jsonResponse({ totals, today, total, bases }, 200, origin);
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    // tsconfig 同时含 DOM 与 workers-types；取 workers 语义的 caches.default
    const cache = (caches as unknown as { default?: Cache }).default;
    return handleRequest(request, env, fetch, cache);
  },
} satisfies ExportedHandler<Env>;
