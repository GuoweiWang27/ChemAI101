# ChemAI101 数据引擎升级实施计划

> **For agentic workers:** 本计划面向零上下文的执行者（人或 agent）。步骤用 checkbox（`- [ ]`）跟踪，按顺序执行，每完成一步勾选一步。中断后恢复的规则见下方「断点续传机制」。

**Goal:** 给 ChemAI101 接入 PubChem 真实化学数据库（名称 → 官方 2D/3D 结构），并为 AI 生成的反应产物加装确定性化学校验层（化合价/连通性/重原子组成交叉核对），同时完成模型接入卫生检查。

**Architecture:** 新增 Worker 端 `/v1/compound` 只读代理（Cloudflare Worker → PubChem PUG REST，带缓存与限流）；新增 Worker 端校验模块 `verify.ts`，在现有 `/v1/analyze` 返回前对 DeepSeek 的 JSON 结果跑确定性检查并把结论附加到响应；前端新增「分子库」标签页复用现有 `Molecule3DViewer`，反应结果卡片增加校验徽章。

**Tech Stack:** React 19 / TypeScript / Vite 6 / Three.js(@react-three/fiber+drei) / Cloudflare Workers(vitest-pool-workers 测试) / PubChem PUG REST（免 key）。

---

## 已拍板的决策（不要重新讨论）

| 决策 | 内容 | 依据 |
| --- | --- | --- |
| 升级方向 | ①真实化学数据引擎为主轴 + ③模型卫生顺手做；课堂套件（旧②）放第二轮 | 主人 2026-08-25 确认「①为主轴 + ③顺手」 |
| 工时预算 | 约 12–15 小时，与 ACT-07 计划的「约 15 小时 / 1 个月迭代至稳定版」一致 | Vault ACT-07 事实卡 |
| 时间窗 | 2026-09 动工、2026-10 中旬封版（Stanford REA ≈ 11-01 截稿） | 2027Fall 申请节奏 |
| PubChem 编码事实 | PUG REST JSON 坐标为埃单位浮点数（无需缩放，PubChemPy 全库无缩放逻辑可证）；`atoms.element` 是原子序数(Z)，需 Z→符号表；限流 5 req/s 且常返 `Fault: PUGREST.ServerBusy`，必须重试+缓存 | 2026-08-25 计划编写时核实 |
| 安全红线 | 沿用现状：任何 provider key 不进前端/构建变量/Git；PubChem 免 key，不得引入需 key 的数据源 | CLOUDFLARE_SETUP.md |
| 部署门禁 | push main（触发 Pages 构建）与 `npm run worker:deploy` 前必须经主人确认 | 大米留学 AGENTS.md 外部系统操作规则 |

## 基线快照（2026-08-25 体检结论）

- 仓库：`/Users/yimu/Documents/Guowei/Engineering/projects/chemai101/`，基线 commit `773e5e8`（main，与 origin 同步，工作区干净）。
- 线上：前端 `https://chemai101.guoweiwang.com/`（CF Pages `chemai101`）；API `https://chemai101-api.guoweiwang27.workers.dev/v1/analyze`（Worker `chemai101-api`，上游 DeepSeek `deepseek-v4-flash`）。
- 本地全量验证四件套当时全绿：`npm test`（6/6）、`npx tsc --noEmit`、`npm run build`、`npm run worker:check`。
- 已知遗留（本计划不强制解决，但别弄坏）：主 chunk >500kB；README 有 AI Studio 残留（Task 8 重写）；`services/geminiService.ts` 文件名历史遗留；`utils/molecularWeight.ts` 对 SMILES 隐式氢不计数（校验层因此只比「重原子组成」，见 Task 4 设计说明）。

## 断点续传机制（接手者必读）

1. **从第一个未勾选的 checkbox 继续**；不要跳任务，不要重做已勾选步骤。
2. 每完成一个 Task：勾掉该 Task 所有步骤 → 在文末「进度日志」表追加一行（日期｜Task｜结果｜commit）→ 更新下表「总进度」。
3. 提交纪律：每个 Task 至少一个 commit，message 用计划给出的文案；push 统一推迟到 Task 8 门禁。
4. 若某步验收失败且两次修复仍不过：停下，在进度日志记一行「BLOCKED：<现象>」，联系主人，不要绕过测试。

### 总进度

| Phase | 任务 | 状态 | 最后更新 |
| --- | --- | --- | --- |
| 准备 | Task 0 分支与基线 | ✅ 完成 | 2026-08-25 |
| 数据引擎 | Task 1 类型扩展 / Task 2 pubchem 模块 / Task 3 compound 路由 | ✅ 完成 | 2026-08-25 |
| 校验闭环 | Task 4 verify 模块与 analyze 集成 | ✅ 完成 | 2026-08-25 |
| 前端 | Task 5 服务层 / Task 6 分子库页 / Task 7 校验徽章 | ✅ 完成 | 2026-08-25 |
| 收尾 | Task 8 全量验证·文档·部署门禁 / Task 9 Vault 同步 | ✅ 全部完成（Worker 186693f3 + main 5d62628 已发布） | 2026-08-25 |

## File Structure（改动全景）

```
projects/chemai101/
├─ types.ts                          # 改：+Verification/+CompoundRecord；ReactionResult 加 verification?
├─ utils/molecularWeight.ts          # 不改（getAtomComposition 被 Worker 复用）
├─ worker/
│  ├─ src/
│  │  ├─ index.ts                    # 改：路由抽出 handleAnalyze；+handleCompound(GET /v1/compound)；响应附 verification
│  │  ├─ pubchem.ts                  # 新：PubChem 查询/归一化（Z表、ServerBusy 重试、3D→2D 回退）
│  │  └─ verify.ts                   # 新：确定性校验（元素/价态/连通性/SMILES 重原子组成比对）
│  └─ test/
│     ├─ index.test.ts               # 改：既有用例适配 + 新增 compound 路由用例
│     ├─ pubchem.test.ts             # 新
│     └─ verify.test.ts              # 新
├─ services/geminiService.ts         # 改：API_BASE 抽取；+fetchCompound(+CompoundNotFoundError)
├─ services/geminiService.test.ts    # 改：适配 + fetchCompound 用例
├─ components/LibraryModule.tsx      # 新：分子库搜索页
├─ components/ReactionLab.tsx        # 改：校验徽章
├─ App.tsx                           # 改：第三个 tab
└─ contexts/LanguageContext.tsx      # 改：新增中英文案键
```

约定：Worker 代码通过相对路径 `../../types`、`../../utils/molecularWeight` 复用前端纯 TS 文件（wrangler 打包支持；这些文件无 DOM 依赖）。类型单一来源是 `types.ts`。

---

### Task 0：分支与基线（≈10 分钟）

- [x] **Step 0.1 建特性分支**

```bash
cd /Users/yimu/Documents/Guowei/Engineering/projects/chemai101
git checkout main && git pull --ff-only && git checkout -b feat/data-engine
```

Expected: `Switched to a new branch 'feat/data-engine'`。

- [x] **Step 0.2 基线四件套确认全绿**

```bash
npm test && npx tsc --noEmit && npm run build >/dev/null && npm run worker:check >/dev/null && echo BASELINE_OK
```

Expected: 末行输出 `BASELINE_OK`（6 个测试通过）。若基线就不绿：停止并在进度日志记 BLOCKED，先修复环境再继续。

---

### Task 1：共享类型扩展（≈15 分钟）

**Files:** Modify `types.ts`

- [x] **Step 1.1 写失败用法（临时 tsc 探针）**

在 `types.ts` 末尾临时加一行引用不存在的类型：

```ts
export type __Probe = Verification;
```

Run: `npx tsc --noEmit`　Expected: FAIL `Cannot find name 'Verification'`。

- [x] **Step 1.2 实现类型**

删除探针行，在 `types.ts` 中 `ReactionResult` 定义之前加入：

```ts
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
```

并给现有接口补一个可选字段：

```ts
export interface ReactionResult {
  equation: string;
  products: string[];
  mechanismSteps: string[];
  productStructure: MoleculeStructure; // Main product structure
  vseprInfo: string;
  verification?: Verification;
}
```

- [x] **Step 1.3 验证**

Run: `npx tsc --noEmit`　Expected: 通过（无输出）。

- [x] **Step 1.4 Commit**

```bash
git add types.ts && git commit -m "feat: add Verification and CompoundRecord shared types"
```

---

### Task 2：Worker 端 PubChem 模块（≈2.5 小时）

**Files:** Create `worker/src/pubchem.ts`、Create `worker/test/pubchem.test.ts`

- [x] **Step 2.1 写失败测试**

创建 `worker/test/pubchem.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest';
import { lookupCompound, normalizeStructure, PubChemError } from '../src/pubchem';

/** 构造 PubChem PC-Compound 形状的 3D 甲烷记录（坐标为埃单位浮点数） */
function pcMethane3d() {
  return {
    PC_Compounds: [
      {
        atoms: { aid: [1, 2, 3, 4, 5], element: [6, 1, 1, 1, 1] },
        bonds: { aid1: [1, 1, 1, 1], aid2: [2, 3, 4, 5], order: [1, 1, 1, 1] },
        coords: [
          {
            type: [12, 3],
            aid: [1, 2, 3, 4, 5],
            conformers: [
              { x: [0.0, 0.6, -0.2, -0.2, -0.2], y: [0.0, 0.6, 0.6, -0.2, -0.2], z: [0.0, 0.6, -0.2, 0.6, -0.2] },
            ],
          },
        ],
      },
    ],
  };
}

function fakeFetcher(responses: Array<{ url: RegExp; body: unknown; status?: number }>) {
  const calls: string[] = [];
  const fn = vi.fn<typeof fetch>(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const hit = responses.find((r) => r.url.test(url));
    if (!hit) throw new Error(`unexpected fetch ${url}`);
    return Response.json(hit.body as object, { status: hit.status ?? 200 });
  });
  return { fn, calls };
}

describe('pubchem module', () => {
  it('normalizes a 3D PC-Compound into app structure (Z -> symbol)', () => {
    const { structure, structureType } = normalizeStructure(pcMethane3d().PC_Compounds[0]);
    expect(structureType).toBe('3d');
    expect(structure.atoms[0]).toMatchObject({ id: 1, element: 'C', x: 0, y: 0, z: 0 });
    expect(structure.atoms[1].element).toBe('H');
    expect(structure.bonds).toHaveLength(4);
    expect(structure.bonds.every((b) => b.order >= 1 && b.order <= 3)).toBe(true);
  });

  it('falls back to 2d when no 3d record exists (z defaults to 0)', async () => {
    const cidBody = { IdentifierList: { CID: [2244] } };
    const propBody = {
      PropertyTable: {
        Properties: [{ CID: 2244, IUPACName: 'aspirin', MolecularFormula: 'C9H8O4', MolecularWeight: 180.16 }],
      },
    };
    const record2d = {
      PC_Compounds: [
        {
          atoms: { element: [6, 8] },
          bonds: { aid1: [1], aid2: [2], order: [2] },
          coords: [{ conformers: [{ x: [0, 1.3], y: [0, 0.8] }] }],
        },
      ],
    };
    const { fn } = fakeFetcher([
      { url: /\/cids\/JSON/, body: cidBody },
      { url: /record_type=3d/, body: { Fault: { Code: 'PUGREST.NotFound', Message: 'No 3D' } }, status: 404 },
      { url: /\/cid\/2244\/JSON/, body: record2d },
      { url: /\/property\//, body: propBody },
    ]);

    const rec = await lookupCompound('aspirin', fn);
    expect(rec.cid).toBe(2244);
    expect(rec.structureType).toBe('2d');
    expect(rec.structure.atoms[1]).toMatchObject({ element: 'O', z: 0 });
    expect(rec.molecularFormula).toBe('C9H8O4');
  });

  it('throws 404 PubChemError for unknown compound names', async () => {
    const { fn } = fakeFetcher([
      { url: /\/cids\/JSON/, body: { Fault: { Code: 'PUGREST.NotFound', Message: 'No CID found' } }, status: 404 },
    ]);
    const err = await lookupCompound('zzzznotachemical', fn).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(PubChemError);
    expect((err as PubChemError).status).toBe(404);
  });

  it('retries once on ServerBusy before giving up', async () => {
    const cidBody = { IdentifierList: { CID: [2244] } };
    let cidsCalls = 0;
    const fn = vi.fn<typeof fetch>(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/cids/JSON')) {
        cidsCalls += 1;
        if (cidsCalls === 1) {
          return Response.json({ Fault: { Code: 'PUGREST.ServerBusy', Message: 'busy' } }, { status: 503 });
        }
        return Response.json(cidBody);
      }
      if (url.includes('record_type=3d')) return Response.json(pcMethane3d());
      return Response.json({ PropertyTable: { Properties: [{ CID: 2244 }] } });
    });

    const rec = await lookupCompound('methane', fn);
    expect(rec.structure.atoms).toHaveLength(5);
    expect(cidsCalls).toBe(2);
  });
});
```

- [x] **Step 2.2 运行确认失败**

Run: `npm test`　Expected: FAIL，`Cannot find module '../src/pubchem'`。

- [x] **Step 2.3 实现 `worker/src/pubchem.ts`**

```ts
import { CompoundRecord, MoleculeStructure } from '../../types';

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
```

- [x] **Step 2.4 运行确认通过**

Run: `npm test`　Expected: pubchem.test.ts 全部 PASS（原有用例不受影响）。

- [x] **Step 2.5 Commit**

```bash
git add worker/src/pubchem.ts worker/test/pubchem.test.ts
git commit -m "feat(worker): PubChem lookup with Z-table normalization, busy retry, 3D->2D fallback"
```

---

### Task 3：Worker 端 `/v1/compound` 路由（含缓存与限流）（≈2 小时）

**Files:** Modify `worker/src/index.ts`、Modify `worker/test/index.test.ts`

设计要点：缓存存「数据」而不是 HTTP 响应——命中后用当次请求的 origin 重建 CORS 头，避免跨源缓存污染；测试默认不注入 cache（DI 参数），生产由 default export 传 `caches.default`。

- [x] **Step 3.1 先加失败测试（追加到 `worker/test/index.test.ts` 末尾）**

```ts
function compoundRequest(name: string, origin = allowedOrigin): Request {
  return new Request(
    `https://chemai101-api.guoweiwang27.workers.dev/v1/compound?name=${encodeURIComponent(name)}`,
    { method: 'GET', headers: { origin } },
  );
}

function compoundUpstream() {
  return vi.fn<typeof fetch>(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/cids/JSON')) {
      return Response.json({ IdentifierList: { CID: [2244] } });
    }
    if (url.includes('record_type=3d')) {
      return Response.json({
        PC_Compounds: [
          {
            atoms: { element: [6, 8] },
            bonds: { aid1: [1], aid2: [2], order: [2] },
            coords: [{ conformers: [{ x: [0, 1.3], y: [0, 0.8], z: [0, 0] }] }],
          },
        ],
      });
    }
    return Response.json({
      PropertyTable: { Properties: [{ CID: 2244, MolecularFormula: 'C9H8O4' }] },
    });
  });
}

describe('compound proxy', () => {
  it('blocks origins outside the ChemAI sites', async () => {
    const response = await handleRequest(
      compoundRequest('aspirin', 'https://attacker.example'),
      env,
      compoundUpstream(),
    );
    expect(response.status).toBe(403);
  });

  it('rejects invalid names without calling PubChem', async () => {
    const upstream = compoundUpstream();
    const long = 'a'.repeat(101);
    for (const bad of ['', long, '<script>', 'aspirin;DROP']) {
      const response = await handleRequest(compoundRequest(bad), env, upstream);
      expect(response.status).toBe(400);
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it('returns a normalized PubChem record with CORS headers', async () => {
    const response = await handleRequest(compoundRequest('aspirin'), env, compoundUpstream());
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      cid: number;
      molecularFormula?: string;
      structure: { atoms: unknown[] };
      structureType: string;
    };
    expect(body.cid).toBe(2244);
    expect(body.molecularFormula).toBe('C9H8O4');
    expect(body.structure.atoms.length).toBeGreaterThan(0);
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
  });

  it('maps PubChem not-found to 404', async () => {
    const upstream = vi.fn<typeof fetch>(async () =>
      Response.json({ Fault: { Code: 'PUGREST.NotFound', Message: '' } }, { status: 404 }),
    );
    const response = await handleRequest(compoundRequest('zzzz'), env, upstream);
    expect(response.status).toBe(404);
  });

  it('rejects non-GET methods', async () => {
    const request = new Request(
      'https://chemai101-api.guoweiwang27.workers.dev/v1/compound?name=aspirin',
      { method: 'POST', headers: { origin: allowedOrigin } },
    );
    const response = await handleRequest(request, env, compoundUpstream());
    expect(response.status).toBe(405);
  });
});
```

- [x] **Step 3.2 运行确认失败**

Run: `npm test`　Expected: 新增 compound 用例 FAIL（404/500，因为路由不存在）。

- [x] **Step 3.3 改造 `worker/src/index.ts`**

三处修改：

**(a)** 顶部加导入：

```ts
import { lookupCompound, PubChemError } from './pubchem';
```

**(b)** 把 `handleRequest` 里 `/v1/analyze` 之后的所有业务逻辑原样搬进新函数 `handleAnalyze(request, env, origin, fetcher)`（签名与返回不变），`handleRequest` 改为纯路由 + 全局守卫：

```ts
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
  return jsonResponse({ error: 'Not found' }, 404, origin);
}
```

注意：原 `handleRequest` 中 `url.pathname !== '/v1/analyze' → 404` 与 OPTIONS 判断的先后顺序以本块为准（OPTIONS 提到路由前，两个路径共享预检）。

**(c)** 新增 `handleCompound`（放在 `handleRequest` 之后）：

```ts
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
    return jsonResponse({ error: 'Too many requests' }, 429, origin);
  }

  try {
    const record = await lookupCompound(name, fetcher);
    if (cache) {
      try {
        const stored = new Response(JSON.stringify(record), {
          headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=86400' },
        });
        await cache.put(cacheKey, stored.clone()); // ctx 无需等待；clone 保返回体
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
      JSON.stringify({ message: 'pubchem lookup failed', error: error instanceof Error ? error.message : 'unknown' }),
    );
    return jsonResponse({ error: 'Chemistry data source unavailable' }, 503, origin);
  }
}
```

default export 保持不变（`handleRequest(request, env)`），生产缓存注入改为显式：

```ts
export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env, fetch, caches.default);
  },
} satisfies ExportedHandler<Env>;
```

- [x] **Step 3.4 运行确认通过**

Run: `npm test`　Expected: 全部 PASS（含原有 6 例 + pubchem + compound 新例）。`npx tsc --noEmit` 同时零错误。

- [x] **Step 3.5 Commit**

```bash
git add worker/src/index.ts worker/test/index.test.ts
git commit -m "feat(worker): GET /v1/compound proxy with cache-API data cache, per-IP rate limit"
```

---

### Task 4：确定性校验引擎并接入 analyze（≈3 小时）

**Files:** Create `worker/src/verify.ts`、Create `worker/test/verify.test.ts`、Modify `worker/src/index.ts`（buildPrompt 与响应）

设计说明：`utils/molecularWeight.ts` 的 SMILES 解析不统计隐式氢（已知局限），所以交叉核对只用**重原子组成**（剔除 H 后逐元素计数比对）——这是诚实且确定性的口径；化合价表用主族常见最高价，过渡金属跳过。

- [x] **Step 4.1 写失败测试 `worker/test/verify.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { verifyReactionResult } from '../src/verify';
import type { MoleculeStructure } from '../../types';

function molecule(pairs: Array<[element: string, bondsTo: number[]]>): MoleculeStructure {
  const atoms = pairs.map(([element], i) => ({ id: i + 1, element, x: 0, y: 0, z: 0 }));
  // 只在 j > i+1 时生成边，避免 A→B 与 B→A 各记一条导致价态翻倍
  const bonds = pairs.flatMap(([, bondsTo], i) =>
    bondsTo.filter((j) => j > i + 1).map((j) => ({ source: i + 1, target: j, order: 1 })),
  );
  return { atoms, bonds };
}

const methane = molecule([['C', [2, 3, 4, 5]], ['H', [1]], ['H', [1]], ['H', [1]], ['H', [1]]]);

describe('verifyReactionResult', () => {
  it('verifies a clean methane result with matching SMILES', () => {
    const v = verifyReactionResult({ productStructure: methane, productSmiles: 'C' });
    expect(v.status).toBe('verified');
    expect(v.issues).toEqual([]);
    expect(v.checks).toEqual({ structure: true, smiles: true });
  });

  it('flags over-valent carbon', () => {
    const bad = molecule([['C', [2, 3, 4, 5, 6]], ['H', [1]], ['H', [1]], ['H', [1]], ['H', [1]], ['Cl', [1]]]);
    const v = verifyReactionResult({ productStructure: bad });
    expect(v.status).toBe('warning');
    expect(v.issues.some((i) => i.includes('C') && i.includes('5'))).toBe(true);
    expect(v.checks.smiles).toBe(false);
  });

  it('flags SMILES / structure composition mismatch', () => {
    const v = verifyReactionResult({ productStructure: methane, productSmiles: 'CCO' });
    expect(v.status).toBe('warning');
    expect(v.issues[0]).toContain('重原子组成不一致');
  });

  it('flags disconnected fragments', () => {
    const twoFragments = {
      atoms: [
        { id: 1, element: 'C', x: 0, y: 0, z: 0 },
        { id: 2, element: 'O', x: 1, y: 0, z: 0 },
      ],
      bonds: [],
    };
    const v = verifyReactionResult({ productStructure: twoFragments });
    expect(v.status).toBe('warning');
    expect(v.issues.some((i) => i.includes('互不相连'))).toBe(true);
  });

  it('returns unknown when no usable structure came back', () => {
    const v = verifyReactionResult({ equation: '2H2 + O2 → 2H2O' });
    expect(v.status).toBe('unknown');
    expect(v.checks).toEqual({ structure: false, smiles: false });
  });
});
```

- [x] **Step 4.2 运行确认失败**

Run: `npm test`　Expected: FAIL `Cannot find module '../src/verify'`。

- [x] **Step 4.3 实现 `worker/src/verify.ts`**

```ts
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
```

- [x] **Step 4.4 更新既有 analyze 用例并加集成断言（改 `worker/test/index.test.ts`）**

原「keeps the API key server-side…」用例中 mock 上游的 `content` 改为带结构与 SMILES 的完整 JSON，并同步期望响应（响应现在多出 `verification` 字段）：

```ts
const reactionContent = JSON.stringify({
  equation: 'CH4 + 2O2 -> CO2 + 2H2O',
  products: ['CO2', 'H2O'],
  mechanismSteps: [],
  vseprInfo: '',
  productSmiles: 'O=C=O',
  productStructure: {
    atoms: [
      { id: 1, element: 'C', x: 0, y: 0, z: 0, color: '#909090' },
      { id: 2, element: 'O', x: 1.2, y: 0, z: 0, color: '#FF0D0D' },
      { id: 3, element: 'O', x: -1.2, y: 0, z: 0, color: '#FF0D0D' },
    ],
    bonds: [
      { source: 1, target: 2, order: 2 },
      { source: 1, target: 3, order: 2 },
    ],
  },
});
```

mock 返回处：`return Response.json({ choices: [{ message: { content: reactionContent } }] });`

期望响应改为：

```ts
expect(await response.json()).toMatchObject({
  equation: 'CH4 + 2O2 -> CO2 + 2H2O',
  verification: { status: 'verified', checks: { structure: true, smiles: true } },
});
```

并在同一用例里补一条 prompt 断言（要求模型给出 productSmiles 字段）：

```ts
expect(upstreamBody.messages[0].content).toContain('productSmiles');
```

- [x] **Step 4.5 接入 `worker/src/index.ts`**

(a) 导入：`import { verifyReactionResult } from './verify';`

(b) `buildPrompt` 中 predictReaction 分支要求的 JSON 模板加一行字段（放在 `"products"` 之后任意位置）：

```
  "productSmiles": "canonical SMILES of the main product",
```

(c) `handleAnalyze` 成功分支，把原来的：

```ts
return jsonResponse(JSON.parse(content), 200, origin);
```

改为：

```ts
const parsed: unknown = JSON.parse(content);
return jsonResponse({ ...(parsed as object), verification: verifyReactionResult(parsed) }, 200, origin);
```

- [x] **Step 4.6 运行确认通过**

Run: `npm test && npx tsc --noEmit`　Expected: 全部 PASS、零类型错误。

- [x] **Step 4.7 Commit**

```bash
git add worker/src/verify.ts worker/test/verify.test.ts worker/src/index.ts worker/test/index.test.ts
git commit -m "feat(worker): deterministic chemistry verification attached to analyze results"
```

---

### Task 5：前端服务层（≈45 分钟）

**Files:** Modify `services/geminiService.ts`、Modify `services/geminiService.test.ts`

- [x] **Step 5.1 先改失败测试**

在 `services/geminiService.test.ts` 顶部改导入并追加用例：

```ts
import { CompoundNotFoundError, fetchCompound, predictReaction } from './geminiService';
```

追加：

```ts
it('loads compound records from the Worker without any credentials', async () => {
  const browserFetch = vi.fn<typeof fetch>(async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(String(input)).toBe(
      'https://chemai101-api.guoweiwang27.workers.dev/v1/compound?name=%E9%98%BF%E5%8F%B8%E5%8C%B9%E6%9E%97',
    );
    const headers = new Headers(init?.headers);
    expect(headers.has('authorization')).toBe(false);
    return Response.json({ cid: 2244, structure: { atoms: [], bonds: [] }, structureType: '3d' });
  });
  vi.stubGlobal('fetch', browserFetch);

  const record = await fetchCompound('阿司匹林');
  expect(record.cid).toBe(2244);
});

it('raises a dedicated error when the compound is unknown', async () => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => Response.json({}, { status: 404 })));
  await expect(fetchCompound('zzzz')).rejects.toBeInstanceOf(CompoundNotFoundError);
});
```

既有 predictReaction 用例无需改动：默认 `API_BASE` 相同，原 URL 断言继续成立。

- [x] **Step 5.2 运行确认失败**

Run: `npm test`　Expected: FAIL `fetchCompound is not exported`。

- [x] **Step 5.3 实现 `services/geminiService.ts` 改动**

顶部常量区替换为：

```ts
const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
/** Worker 根地址；如需指向另一套非敏感代理，设置 VITE_CHEMAI_API_BASE（不要设成具体端点） */
const API_BASE =
  viteEnv?.VITE_CHEMAI_API_BASE || 'https://chemai101-api.guoweiwang27.workers.dev';
const ANALYZE_URL = `${API_BASE}/v1/analyze`;
```

`requestChemAI` 内 `fetch(API_URL, …)` 改为 `fetch(ANALYZE_URL, …)`。

文件末尾追加：

```ts
import { CompoundRecord } from '../types';

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
```

（把 `import { CompoundRecord } …` 移到文件顶部 import 区，与其他 import 合并。）

- [x] **Step 5.4 运行确认通过**

Run: `npm test && npx tsc --noEmit`　Expected: 全绿。

- [x] **Step 5.5 Commit**

```bash
git add services/geminiService.ts services/geminiService.test.ts
git commit -m "feat(client): shared API base + fetchCompound client with dedicated 404 error"
```

---

### Task 6：「分子库」页面与导航（≈2.5 小时）

**Files:** Create `components/LibraryModule.tsx`、Modify `contexts/LanguageContext.tsx`、Modify `App.tsx`

- [x] **Step 6.1 语言键（en/zh 两个块各加一组）**

en 块 `commonNameLabel` 之前插入：

```ts
navLibrary: "Molecule Library",
libraryIntro: "Search any compound by name to load its official PubChem 3D structure.",
searchPlaceholder: "e.g. aspirin, caffeine, glucose",
searchBtn: "Load Structure",
searchingBtn: "Loading...",
formulaLabel: "Molecular Formula",
weightLabel: "Molecular Weight",
gPerMol: "g/mol",
iupacLabel: "IUPAC Name",
sourceBadge: "PubChem Data",
structure3dBadge: "3D Structure",
structure2dBadge: "2D Structure",
notFoundMsg: "No compound found with that name. Try the English name.",
dataBusyMsg: "The chemistry database is busy. Please try again shortly.",
networkErrorMsg: "Could not load compound data.",
```

zh 块对应位置插入：

```ts
navLibrary: "分子库",
libraryIntro: "按名称检索任意化合物，加载 PubChem 官方 3D 结构。",
searchPlaceholder: "例如：阿司匹林、咖啡因、葡萄糖",
searchBtn: "加载结构",
searchingBtn: "加载中...",
formulaLabel: "分子式",
weightLabel: "分子量",
gPerMol: "g/mol",
iupacLabel: "IUPAC 命名",
sourceBadge: "PubChem 数据",
structure3dBadge: "3D 结构",
structure2dBadge: "2D 结构",
notFoundMsg: "没有找到该化合物，换个名字或试试英文名。",
dataBusyMsg: "化学数据库正忙，请稍后再试。",
networkErrorMsg: "无法加载化合物数据。",
```

- [x] **Step 6.2 新建 `components/LibraryModule.tsx`**

```tsx
import React, { useState } from 'react';
import { CompoundNotFoundError, fetchCompound } from '../services/geminiService';
import { CompoundRecord } from '../types';
import { Molecule3DViewer } from './Molecule3DViewer';
import { Database, FlaskConical, Loader2, Search } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; variant: 'notFound' | 'busy' | 'network' }
  | { kind: 'ready'; record: CompoundRecord };

export const LibraryModule: React.FC = () => {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const { t } = useLanguage();

  const handleSearch = async () => {
    const name = query.trim();
    if (!name) return;
    setState({ kind: 'loading' });
    try {
      const record = await fetchCompound(name);
      setState({ kind: 'ready', record });
    } catch (error) {
      if (error instanceof CompoundNotFoundError) setState({ kind: 'error', variant: 'notFound' });
      else if (error instanceof Error && error.message.endsWith('(503)')) {
        setState({ kind: 'error', variant: 'busy' });
      } else setState({ kind: 'error', variant: 'network' });
    }
  };

  const errorText =
    state.kind === 'error'
      ? t(state.variant === 'notFound' ? 'notFoundMsg' : state.variant === 'busy' ? 'dataBusyMsg' : 'networkErrorMsg')
      : '';

  return (
    <div className="flex flex-col h-full gap-6 p-6">
      {/* Search bar */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-[#f0ece4]">
        <h2 className="text-xl font-bold font-display text-[#1a1a1a] mb-1 flex items-center gap-2">
          <Database className="w-5 h-5 text-science-600" /> {t('navLibrary')}
        </h2>
        <p className="text-sm text-[#6f685d] mb-4">{t('libraryIntro')}</p>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <FlaskConical className="absolute top-3 left-3 w-4 h-4 text-[#6f685d]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-9 p-3 border border-[#e8d5b8] rounded-lg focus:ring-2 focus:ring-science-500 focus:border-transparent transition-all outline-none"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={state.kind === 'loading' || !query.trim()}
            className={`px-6 rounded-lg font-semibold text-white shadow-md transition-all flex items-center gap-2 whitespace-nowrap
              ${state.kind === 'loading' || !query.trim() ? 'bg-[#D4A76A] cursor-not-allowed' : 'bg-gradient-to-r from-science-600 to-science-500 hover:from-science-700 hover:to-science-600 hover:shadow-lg'}`}
          >
            {state.kind === 'loading' ? <Loader2 className="animate-spin w-5 h-5" /> : <Search className="w-5 h-5" />}
            {state.kind === 'loading' ? t('searchingBtn') : t('searchBtn')}
          </button>
        </div>
      </div>

      {/* Result area */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {state.kind === 'ready' && (
          <>
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-science-100 flex flex-col gap-4">
              <div>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-[#e6f2f0] text-[#2a7c6f] border border-[#2a7c6f]/25">
                  <Database className="w-3 h-3" /> {t('sourceBadge')} · CID {state.record.cid}
                </span>
                <span className="ml-2 inline-block px-2 py-1 rounded-full text-xs font-medium bg-[#f5f0e8] text-[#866027] border border-[#e8d5b8]">
                  {state.record.structureType === '3d' ? t('structure3dBadge') : t('structure2dBadge')}
                </span>
              </div>
              {state.record.molecularFormula && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-[#866027] font-bold">{t('formulaLabel')}</div>
                  <div className="font-mono text-2xl text-science-800">{state.record.molecularFormula}</div>
                </div>
              )}
              {state.record.molecularWeight && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-[#866027] font-bold">{t('weightLabel')}</div>
                  <div className="font-mono text-xl text-[#1a1a1a]">
                    {state.record.molecularWeight} {t('gPerMol')}
                  </div>
                </div>
              )}
              {state.record.iupacName && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-[#866027] font-bold">{t('iupacLabel')}</div>
                  <div className="text-sm text-[#5c5549] italic">{state.record.iupacName}</div>
                </div>
              )}
            </div>
            <div className="lg:col-span-2 min-h-[400px] bg-white rounded-2xl shadow-lg border border-[#f0ece4] overflow-hidden">
              <Molecule3DViewer structure={state.record.structure} />
            </div>
          </>
        )}
        {state.kind === 'error' && (
          <div className="lg:col-span-3 bg-white rounded-2xl border-2 border-dashed border-[#e8d5b8] flex items-center justify-center text-[#8C1515]">
            {errorText}
          </div>
        )}
        {(state.kind === 'idle' || state.kind === 'loading') && (
          <div className="lg:col-span-3 bg-white/60 rounded-3xl border-2 border-dashed border-[#e8d5b8] flex flex-col items-center justify-center text-[#6f685d]">
            <Database className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">{t('libraryIntro')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
```

- [x] **Step 6.3 `App.tsx` 加第三页签**

tab 联合类型与状态：`useState<'reaction' | 'builder' | 'library'>('reaction')`；导入 `LibraryModule` 与 lucide 图标 `Database`；nav 中 builder 按钮后仿写：

```tsx
<button
  onClick={() => setActiveTab('library')}
  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
    ${activeTab === 'library'
      ? 'bg-white text-science-700 shadow-sm'
      : 'text-[#6f685d] hover:text-[#1a1a1a] hover:bg-white'}`}
>
  <Database className="w-4 h-4" />
  <span className="hidden sm:inline">{t('navLibrary')}</span>
</button>
```

主内容条件渲染改为：

```tsx
{activeTab === 'reaction' ? <ReactionLab /> : activeTab === 'library' ? <LibraryModule /> : <BuilderModule />}
```

- [x] **Step 6.4 验证**

Run: `npm test && npx tsc --noEmit && npm run build >/dev/null && echo TASK6_OK`

然后人工冒烟（可选但推荐）：`npm run dev` 起 Vite（本地前端默认打生产 Worker，能直接查 aspirin），浏览器开 `http://localhost:5173`，切到分子库搜 `aspirin` 应出 3D 分子。冒烟后 Ctrl-C。

Expected: 末行 `TASK6_OK`。

- [x] **Step 6.5 Commit**

```bash
git add components/LibraryModule.tsx contexts/LanguageContext.tsx App.tsx
git commit -m "feat(ui): Molecule Library tab backed by PubChem worker proxy"
```

---

### Task 7：反应结果校验徽章（≈1 小时）

**Files:** Modify `components/ReactionLab.tsx`

- [x] **Step 7.1 渲染徽章**

导入 `ShieldCheck, ShieldAlert, ShieldQuestion`（lucide）。在 `result.equation` 所在 `<div className="p-4 bg-science-50 …">` 之后、`grid grid-cols-1 md:grid-cols-2` 之前插入：

```tsx
{result.verification && (
  <div className={`mt-3 p-3 rounded-xl border text-sm ${
    result.verification.status === 'verified'
      ? 'bg-[#e8f5ec] border-[#bfe3cc] text-[#1f7a44]'
      : result.verification.status === 'warning'
        ? 'bg-[#fdf3e0] border-[#ecd9ae] text-[#8a6116]'
        : 'bg-[#f5f0e8] border-[#e8d5b8] text-[#5c5549]'
  }`}>
    <div className="flex items-center gap-2 font-semibold">
      {result.verification.status === 'verified'
        ? <ShieldCheck className="w-4 h-4" />
        : result.verification.status === 'warning'
          ? <ShieldAlert className="w-4 h-4" />
          : <ShieldQuestion className="w-4 h-4" />}
      <span>
        {result.verification.status === 'verified'
          ? t('verifyVerified')
          : result.verification.status === 'warning'
            ? t('verifyWarning')
            : t('verifyUnknown')}
      </span>
    </div>
    {result.verification.issues.length > 0 && (
      <ul className="mt-1 list-disc pl-5 space-y-0.5">
        {result.verification.issues.map((issue, i) => (
          <li key={i}>{issue}</li>
        ))}
      </ul>
    )}
  </div>
)}
```

语言键（en / zh 分别加入）：

```ts
verifyVerified: "Passed deterministic chemistry checks",
verifyWarning: "Failed some chemistry checks — treat as reference only",
verifyUnknown: "Structure not automatically verifiable",
```

```ts
verifyVerified: "已通过确定性化学校验",
verifyWarning: "未完全通过化学校验，仅供参考",
verifyUnknown: "结构暂无法自动校验",
```

- [x] **Step 7.2 验证**

Run: `npm test && npx tsc --noEmit && npm run build >/dev/null && echo TASK7_OK`　Expected: `TASK7_OK`。

- [x] **Step 7.3 Commit**

```bash
git add components/ReactionLab.tsx contexts/LanguageContext.tsx
git commit -m "feat(ui): verification badge on reaction results with bilingual copy"
```

---

### Task 8：模型卫生、全量验证、文档与部署门禁（≈2 小时）

- [x] **Step 8.1 模型卫生决策（方向③）**

打开 https://api-docs.deepseek.com 查当前推荐的低成本快速对话模型 ID：
- 若仍是 `deepseek-v4-flash`：无需改动，在进度日志记「模型已是最新」。
- 若有更新的官方推荐 ID：改 `wrangler.jsonc` 的 `vars.MODEL_NAME`，运行 `npm test && npm run worker:check`，单独提交 `chore: bump MODEL_NAME to <id>`。

- [x] **Step 8.2 全量四件套 + 密钥扫描**

```bash
npm test && npx tsc --noEmit && npm run build >/dev/null && npm run worker:check >/dev/null \
&& ! grep -rlE "sk-[A-Za-z0-9]{10,}|api\.deepseek\.com.{0,60}(Bearer|[A-Za-z0-9_-]{20,})" dist/ && echo ALL_GREEN
```

Expected: `ALL_GREEN`。任何一项红：回到对应 Task 修复，不许带病进 Step 8.3。

- [x] **Step 8.3 重写 README.md（清除 AI Studio 残留）**

新 README 要点（保留英文，简洁）：项目一句话（AI-assisted chemistry visualization for classroom demos）；架构图一行（Browser → CF Pages 前端 → Worker `chemai101-api` → DeepSeek（分析）/ PubChem（权威结构数据））；本地开发与四件套验证命令沿用现有段落；安全红线段落原文保留；删掉 AI Studio 链接与 "GHBanner" 图片段。同时把 `CLOUDFLARE_SETUP.md` 里对 `VITE_CHEMAI_API_URL` 的表述改为 `VITE_CHEMAI_API_BASE`。完成后提交：

```bash
git add README.md CLOUDFLARE_SETUP.md && git commit -m "docs: rewrite README and align setup guide with API base variable"
```

- [x] **Step 8.4 【门禁·需主人确认】合并并部署**

向主人展示：本计划勾选状态、ALL_GREEN 证据、commit 列表（`git log --oneline main..feat/data-engine`）。获得明确同意后：

```bash
git checkout main && git merge --ff-only feat/data-engine && git push origin main   # 触发 CF Pages 自动构建
npm run worker:deploy                                                              # 部署 Worker（需 wrangler 已登录）
```

- [x] **Step 8.5 线上验收探针**

```bash
sleep 90  # 等 Pages 构建完成
curl -sS -o /dev/null -w "front:%{http_code}\n" https://chemai101.guoweiwang.com/
curl -sS -X OPTIONS "https://chemai101-api.guoweiwang27.workers.dev/v1/compound?name=x" -H "Origin: https://chemai101.guoweiwang.com" -o /dev/null -w "preflight:%{http_code}\n"
curl -sS "https://chemai101-api.guoweiwang27.workers.dev/v1/compound?name=aspirin" -H "Origin: https://chemai101.guoweiwang.com" | head -c 300; echo
curl -sS -o /dev/null -w "bad-origin:%{http_code}\n" "https://chemai101-api.guoweiwang27.workers.dev/v1/compound?name=aspirin" -H "Origin: https://evil.example.com"
```

Expected: `front:200`、`preflight:204`、compound 返回含 `"cid":2244` 的 JSON、`bad-origin:403`。（compound 真实请求走一次 PubChem，不消耗 DeepSeek 配额。）

- [x] **Step 8.6 证据归档**

把以下证据存到 `docs/plans/evidence-20260825/`（文本即可）：ALL_GREEN 输出、Step 8.5 四条探针原始输出、merge commit hash、Worker 部署版本号（`npm run worker:deploy` 尾行 Version ID）。提交：

```bash
git add docs/plans/evidence-20260825 && git commit -m "chore: archive upgrade verification evidence"
```

---

### Task 9：Vault 同步与计划收尾（≈1 小时）

所有改动只涉及 Vault 文档（小范围修正，可直接做），逐项执行：

- [x] **Step 9.1** `📂背景档案/活动与荣誉事实库/activities/ACT-07-ChemAI101化学可视化工具.md`：证据表追加一行 ACT07-E06/E07（E3）：本轮升级的 GitHub commit 区间、线上探针证据文件路径；叙述段补一句「2026-09 升级：接入 PubChem 权威结构库并为 AI 输出加装确定性校验层」（时间以实际完成为准）。
- [x] **Step 9.2** `📚事件证据库/events/EVT-2026-012-ChemAI101代码与部署快照.md`：按该卡既有格式 touch 一轮，记录升级后技术栈变化（新增 Worker /v1/compound + verify 层 + PubChem 数据源）。
- [x] **Step 9.3** `00_大米留学项目中枢.md` 日志表追加一行（格式照抄现有行：日期｜标题｜一句摘要）。
- [x] **Step 9.4** `📋材料准备/💻STEM项目/ChemAI101.md` 与 `STEM项目总览.md`：状态与功能清单同步（114文件数字如有变化一并更新）。
- [x] **Step 9.5** Wiki 三件套：wiki-log 追加（署名 `ox-alpha`）→ `python3 99_⚙️System/scripts/generate-index.py > 99_⚙️System/wiki-index.md` → `bash 99_⚙️System/scripts/vault-check.sh`。
- [x] **Step 9.6** 回到本文件：勾掉剩余步骤，「总进度」表全部置 DONE，进度日志写终行。

---

## 明确不做（YAGNI / 第二轮候选）

- 课堂教学套件（演示大屏模式、课程反应库、使用统计）→ 第二轮，等本轮上线稳定。
- SMILES 直接输入画 3D（RDKit WASM 级别的解析）→ 依赖太重，PubChem 名称检索已覆盖课堂需求。
- 方程式自动配平校验 → 解析自然语言方程式的鲁棒性成本高，收益低。
- 前端组件级测试框架（Testing Library）→ 与仓库现有测试惯例不一致，不为本次引入。
- 修复 `calculateMolecularWeight` 的隐式氢问题 → 分子量展示已改用 PubChem 权威值，本地计算仅剩内部用途。

## 已知风险与预案

| 风险 | 预案 |
| --- | --- |
| PubChem ServerBusy 频发 | Worker 已做 300ms 单次重试 + 24h 数据缓存；前端有 busy 文案；课堂演示建议提前把要讲的分子先查一遍（命中缓存秒开） |
| 部分化合物无 3D 记录 | 自动回退 2D 并明确标注「2D 结构（无立体坐标）」，不伪造 z |
| DeepSeek 返回缺 productSmiles | checks.smiles=false，徽章降级为「已通过结构检查」语义内的 verified（只要结构检查过且无 issue）；不阻塞 |
| wrangler 本地未登录导致 Task 8.4 卡住 | 提前 `npx wrangler whoami` 检查；未登录请主人在终端跑 `npx wrangler login` |
| Pages 构建慢于预期 | Step 8.5 的 sleep 90 不够就改轮询（最多等 5 分钟） |

---

## 进度日志（执行者追加，勿删）

| 日期 | Task | 结果 | Commit / 备注 |
| --- | --- | --- | --- |
| 2026-08-25 | — | 计划定稿（ox-alpha），主人拍板方向①+③ | 基于 773e5e8 |
| 2026-08-25 | Task 0 | 分支 feat/data-engine 建立，计划文档入库，基线四件套全绿 | 472aab8 |
| 2026-08-25 | Task 1 | 共享类型 Verification / CompoundRecord，探针先红后绿 | 14dd200 |
| 2026-08-25 | Task 2 | pubchem 模块：4 用例绿（归一化/2D回退/404/ServerBusy重试） | fcc41ac |
| 2026-08-25 | Task 3 | /v1/compound 路由：5 用例绿；修 DOM/workers-types CacheStorage.default 类型冲突（窄化转换） | f7ad751 |
| 2026-08-25 | Task 4 | verify 引擎 5 用例 + analyze 集成断言（CO₂ verified）绿；prompt 增加 productSmiles | 372de51 |
| 2026-08-25 | Task 5 | fetchCompound 客户端 + CompoundNotFoundError：2 用例绿 | 10fafd4 |
| 2026-08-25 | Task 6 | 分子库页签 + 双语文案上线（浏览器人工冒烟留到部署验收一起做） | 4653c6b |
| 2026-08-25 | Task 7 | 反应结果校验徽章上线（verified/warning/unknown 三态） | 6551585 |
| 2026-08-25 | Task 8.1 | 模型卫生：官方目录确认 deepseek-v4-flash 为当前快速模型 ID，无需改动 | — |
| 2026-08-25 | Task 8.2 | 全量四件套 + dist 密钥扫描 = ALL_GREEN（22 测试） | — |
| 2026-08-25 | Task 8.3 | README 重写清除 AI Studio 残留；CLOUDFLARE_SETUP 对齐 VITE_CHEMAI_API_BASE | af64243 |
| 2026-08-25 | Task 8.4 | 主人 wrangler login 授权并明确「部署吧」→ Worker 上线 Version 186693f3；随后主人确认「合并上线」→ main ff 至 5d62628 并 push（Pages 自动构建） | 5d62628 |
| 2026-08-25 | Task 8.5 | 线上探针全绿：aspirin 真实查询 200（CID 2244·C9H8O4·3D 21原子，Cloudflare 出口不受本机限流影响）；403/400 防护回归；analyze 预检 204 | 见证据文件 |
| 2026-08-25 | Task 8.6 | 证据归档 prod-deploy-probes.md + prod-aspirin-response.json；本地验证记录先前已归档 | e6a9cda / 5d62628 |
| 2026-08-25 | Task 9 | Vault 同步完成：ACT07-E06、EVT-2026-012 rev8（CLM-13/14 + EVD-07）、中枢日志行、STEM 双文档更新、wiki-log×5 + 索引再生 + vault-check 通过 | — |
| 2026-08-25 | 终验 | 生产前端 bundle 含分子库代码（index-dF3_la66.js）；计划 48/48 步骤全部勾选，**升级闭环** | — |

> **本计划已完结。** 第二轮候选（课堂套件等）见「明确不做」清单；接手新工作时新建计划文档，不要在本文件续写。
