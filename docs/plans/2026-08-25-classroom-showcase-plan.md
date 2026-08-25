# ChemAI101 课堂展示升级 · 实施计划

> **For agentic workers:** 本计划面向零上下文的执行者（人或 agent）。步骤用 checkbox（`- [ ]`）跟踪，按顺序执行。中断恢复规则见「断点续传机制」。设计依据：`docs/specs/2026-08-25-classroom-showcase-design.md`（已获主人批准，勿重议）。

**Goal:** 为 ChemAI101 增加双形态课堂能力：静态策展反应库（人教版主干、老师签核后入库）+ 全屏演示模式（投屏大字分步）+ 二维码分享链接（课后手机自学），约 15 小时。

**Architecture:** 策展反应以 JSON 静态打包进前端 bundle（运行时零请求）；新增纯函数路由层解析 `?r=<slug>&mode=present`；`ReactionPage` 同页两皮（自学态/演示态）；演示态为全屏 overlay 组件；二维码用 `qrcode` 库本地生成。Worker 与 AI 层本轮零改动。

**Tech Stack:** 沿用 React 19 / TS / Vite / Tailwind / vitest；新增依赖仅 `qrcode`（+`@types/qrcode` dev）。

---

## 已拍板决策（不要重新讨论）

| 决策 | 内容 | 依据 |
| --- | --- | --- |
| 方案 | C 双形态一体 | 主人 2026-08-25 选定 |
| 内容范围 | 人教版高中化学主干章节，首批 30–40 条，目标签核 ≥10 条上线 | 主人选定 + 设计 §11 |
| 内容责任链 | 国维+社团整理 → 任课老师逐条签字 → 才能进正式数据目录 | 设计 §4 |
| 工时窗口 | ~15h；9 月开发、10 月中旬封版 | 主人选定 |
| 明确不做 | 小测/统计/账号/教师后台/路由框架 | 设计 §9 |

## 断点续传机制（接手者必读）

1. 从第一个未勾选 checkbox 继续；不跳任务不重做。
2. 每 Task 完成后：勾选 → 文末进度日志追加一行 → 更新总进度表。
3. 每 Task 至少一个 commit（message 用计划文案）；push 统一推迟到 Task 7 门禁。
4. 验收失败两次修不过：进度日志记 `BLOCKED:<现象>` 并停下联系主人。
5. **人工门禁**：Task 5 的老师签核无法由 agent 代做——到该步若签核未齐，把工程侧全部完成后停在 Task 7 门禁前等待，不得伪造 `reviewed:true`。

### 总进度

| Phase | 任务 | 状态 | 最后更新 |
| --- | --- | --- | --- |
| 准备 | Task 0 基线 | ✅ 完成 | 2026-08-25 |
| 数据层 | Task 1 路由解析 / Task 2 反应库 schema·加载器·测试 | ✅ 完成 | 2026-08-25 |
| UI | Task 3 ReactionPage 接线 / Task 4 演示模式 / Task 5 分享与移动端 | ✅ 完成 | 2026-08-25 |
| 内容 | Task 6 内容整理与签核入库（人工门禁 ≥10 条） | 🟡 草稿 30 条已备 + UI 就绪；**待老师签核** | 2026-08-25 |
| 收尾 | Task 7 全量验证·部署门禁·Vault 同步 | 等签核完成后执行 | 2026-08-25 |

## File Structure（改动全景）

```
projects/chemai101/
├─ tsconfig.json                       # 改：+resolveJsonModule
├─ src/data/reactions/
│  ├─ schema.ts                        # 新：CuratedReaction 类型
│  ├─ index.ts                         # 新：加载器 getReaction/ALL_REACTIONS
│  ├─ mustate-1-02-na-cl.json          # 新(Task 6)：章节文件（签核后才放）
│  └─ _staging/                        # 新(Task 6)：未签核草稿区，不进 loader
├─ utils/routeParams.ts                # 新：parseRoute/updateRouteParams 纯函数
├─ utils/routeParams.test.ts           # 新
├─ src/data/reactions/data.test.ts     # 新：数据完整性测试
├─ components/ReactionPage.tsx         # 新：库条目页（自学态/演示态分流）
├─ components/PresentationMode.tsx     # 新：全屏演示组件
├─ components/QrShare.tsx              # 新：二维码+复制链接
├─ components/LibraryModule.tsx        # 改：顶部加「教材反应库」浏览区
├── components/ReactionLab.tsx          # 改：AI 结果卡加「演示」入口
├─ App.tsx                             # 改：路由接线（slug 优先于 tab）
├─ contexts/LanguageContext.tsx        # 改：新增双语键
└─ package.json                        # 改：+qrcode
```

约定：策展数据只被前端引用；Worker 目录零改动。类型单一来源仍是 `types.ts`（MoleculeStructure 复用）。

---

### Task 0：基线确认（≈5 分钟）

- [x] **Step 0.1 分支与四件套**

当前分支应为 `feat/classroom-showcase`（设计文档所在分支）。确认基线绿：

```bash
cd /Users/yimu/Documents/Guowei/Engineering/projects/chemai101
git branch --show-current && npm test 2>&1 | grep "Tests" && npx tsc --noEmit && echo BASELINE_OK
```

Expected: 分支名正确、22 tests passed、`BASELINE_OK`。

---

### Task 1：路由解析纯函数（TDD，≈45 分钟）

**Files:** Create `utils/routeParams.ts`、Create `utils/routeParams.test.ts`

- [x] **Step 1.1 写失败测试**

创建 `utils/routeParams.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { parseRoute } from './routeParams';

describe('parseRoute', () => {
  it('parses slug and present mode', () => {
    expect(parseRoute('?r=na-h2o&mode=present')).toEqual({ slug: 'na-h2o', present: true });
  });

  it('defaults to self-study mode', () => {
    expect(parseRoute('?r=fe-cl2')).toEqual({ slug: 'fe-cl2', present: false });
  });

  it('returns null slug when missing or invalid', () => {
    expect(parseRoute('')).toEqual({ slug: null, present: false });
    expect(parseRoute('?r=')).toEqual({ slug: null, present: false });
    expect(parseRoute('?r=Bad_Slug!')).toEqual({ slug: null, present: false });
    expect(parseRoute('?mode=present')).toEqual({ slug: null, present: true });
  });
});
```

- [x] **Step 1.2 运行确认失败**

Run: `npm test 2>&1 | grep routeParams`　Expected: FAIL `Cannot find module './routeParams'`。

注意：vitest 只收集 `worker/test/**` 与 `services/**`（见 vitest.config include）。本测试放在 `utils/` 不会被自动收集——同时修改 `vitest.config.ts` 的 include 增加 `'utils/**/*.test.ts'`：

```ts
include: ['worker/test/**/*.test.ts', 'services/**/*.test.ts', 'utils/**/*.test.ts'],
```

改完再跑 Step 1.2。

- [x] **Step 1.3 实现 `utils/routeParams.ts`**

```ts
export interface RouteTarget {
  /** 库条目 slug；null = 不在条目页 */
  slug: string | null;
  /** 是否演示模式 */
  present: boolean;
}

const SLUG_RE = /^[a-z0-9-]{1,64}$/;

export function parseRoute(search: string): RouteTarget {
  const params = new URLSearchParams(search);
  const raw = params.get('r') ?? '';
  const slug = SLUG_RE.test(raw) ? raw : null;
  return { slug, present: params.get('mode') === 'present' };
}

/** 更新 URL 查询参数并通知应用内监听者（不触发真实导航） */
export function updateRouteParams(updates: Record<string, string | null>): void {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  window.history.pushState({}, '', url);
  window.dispatchEvent(new Event('chemai-route'));
}
```

- [x] **Step 1.4 运行确认通过**

Run: `npm test && npx tsc --noEmit`　Expected: routeParams 3 例 PASS，全套无回归。

- [x] **Step 1.5 Commit**

```bash
git add utils/routeParams.ts utils/routeParams.test.ts vitest.config.ts
git commit -m "feat: pure route parser for reaction share links and present mode"
```

---

### Task 2：反应库 schema · 加载器 · 数据测试（≈2 小时）

**Files:** Modify `tsconfig.json`、Create `src/data/reactions/schema.ts`、`src/data/reactions/index.ts`、`src/data/reactions/data.test.ts`、Create `src/data/reactions/_staging/README.md`

- [x] **Step 2.1 tsconfig 开启 JSON 导入**

`tsconfig.json` 的 `compilerOptions` 内 `"allowImportingTsExtensions": true,` 之后加一行：

```json
    "resolveJsonModule": true,
```

- [x] **Step 2.2 创建 `src/data/reactions/schema.ts`**

```ts
import { MoleculeStructure } from '../../types';

/** 策展反应条目。reviewed 字面量 true 是类型级门禁：
 *  只有任课老师签字后的条目才允许出现在正式章节数据文件里。 */
export interface CuratedReaction {
  id: string;               // 短 slug：^[a-z0-9-]{1,64}$，全局唯一
  chapter: string;          // 如 "必修1·第二章 海水中的重要元素"
  title: string;            // 如 "钠与水反应"
  reactants: string;
  conditions: string;
  equation: string;         // 配平好的方程式
  products: string[];
  mechanismSteps: string[]; // 2–5 步
  productStructure: MoleculeStructure | null; // 允许缺失（设计 §7）
  smiles?: string;
  reviewed: true;
}
```

- [x] **Step 2.3 先写数据完整性测试 `src/data/reactions/data.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { ALL_REACTIONS, CHAPTERS } from './index';

const KNOWN_ELEMENTS = new Set([
  'H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar',
  'K','Ca','Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br',
  'Kr','Rb','Sr','Ag','Sn','I','Ba','Pt','Au','Hg','Pb',
]);

describe('curated reactions dataset', () => {
  it('has globally unique slugs in valid format', () => {
    const ids = ALL_REACTIONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]{1,64}$/);
  });

  it('only contains teacher-reviewed entries with complete fields', () => {
    for (const r of ALL_REACTIONS) {
      expect(r.reviewed).toBe(true);
      expect(r.chapter.length).toBeGreaterThan(0);
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.reactants.length).toBeGreaterThan(0);
      expect(r.equation.length).toBeGreaterThan(0);
      expect(r.products.length).toBeGreaterThan(0);
      expect(r.mechanismSteps.length).toBeGreaterThanOrEqual(2);
      expect(r.mechanismSteps.length).toBeLessThanOrEqual(5);
    }
  });

  it('validates embedded structures (elements and bond endpoints)', () => {
    for (const r of ALL_REACTIONS) {
      const st = r.productStructure;
      if (!st) continue;
      const ids = new Set(st.atoms.map((a) => a.id));
      for (const atom of st.atoms) expect(KNOWN_ELEMENTS.has(atom.element)).toBe(true);
      for (const bond of st.bonds) {
        expect(ids.has(bond.source)).toBe(true);
        expect(ids.has(bond.target)).toBe(true);
        expect(bond.order).toBeGreaterThanOrEqual(1);
        expect(bond.order).toBeLessThanOrEqual(3);
      }
    }
  });

  it('keeps chapters ordered and non-empty once content lands', () => {
    expect(CHAPTERS.every((c) => c.length > 0)).toBe(true);
    // 发布门槛（Task 7 门禁复核）：签核条目 >= 10
    if (ALL_REACTIONS.length > 0) {
      expect(ALL_REACTIONS.length).toBeGreaterThanOrEqual(10);
    }
  });
});
```

- [x] **Step 2.4 运行确认失败**

Run: `npm test 2>&1 | grep -E "data.test|Cannot find"`　Expected: FAIL `Cannot find module './index'`。

- [x] **Step 2.5 实现 `src/data/reactions/index.ts`**

```ts
import { CuratedReaction } from './schema';

// 正式章节文件在此显式登记；_staging/ 下的草稿不会被导入。
// 首个文件将在 Task 6 签核后加入，例如：
// import naClChapter from './mustate-1-02-na-cl.json';

const CHAPTER_FILES: CuratedReaction[][] = [
  // naClChapter,
];

export const ALL_REACTIONS: CuratedReaction[] = CHAPTER_FILES.flat();

const BY_SLUG = new Map(ALL_REACTIONS.map((reaction) => [reaction.id, reaction]));

export function getReaction(slug: string): CuratedReaction | undefined {
  return BY_SLUG.get(slug);
}

export const CHAPTERS: string[] = [...new Set(ALL_REACTIONS.map((r) => r.chapter))];
```

- [x] **Step 2.6 建 staging 约定**

创建 `src/data/reactions/_staging/README.md`：

```markdown
# 草稿区

未获任课老师签字的反应条目放这里（JSON 片段即可），**不会被 loader 导入**。
签字后：把条目并入对应章节 JSON → 移出本目录 → data.test 自动接管校验。
签核留痕统一登记在 docs/specs/reaction-signoff.md（日期 / 条目 id / 确认方式）。
```

同时创建空签核台账 `docs/specs/reaction-signoff.md`：

```markdown
# 教材反应签核台账

| 日期 | 条目 id | 老师确认方式 | 备注 |
| --- | --- | --- | --- |
```

- [x] **Step 2.7 运行确认通过**

Run: `npm test && npx tsc --noEmit`　Expected: 全部 PASS（数据集为空时断言空洞成立），零类型错误。

- [x] **Step 2.8 Commit**

```bash
git add tsconfig.json src/data docs/specs/reaction-signoff.md
git commit -m "feat(data): curated reaction schema, loader, integrity tests with review gate"
```

---

### Task 3：ReactionPage 与路由接线（≈2.5 小时）

**Files:** Create `components/ReactionPage.tsx`、Modify `App.tsx`

- [x] **Step 3.1 语言键（en/zh 各加一组）**

en 块 `verifyUnknown` 之后追加：

```ts
navLibraryCurated: "Textbook Reactions",
curatedEmpty: "The first batch is being reviewed by our chemistry teacher. Coming soon.",
backBtn: "Back",
demoBtn: "Present",
qrBtn: "QR Code",
linkCopied: "Link copied!",
mechanismLabel: "Mechanism Steps",
conditionsLabel: "Conditions"
```

zh 块对应位置：

```ts
navLibraryCurated: "教材反应库",
curatedEmpty: "首批内容正在由化学老师审核签核中，敬请期待。",
backBtn: "返回",
demoBtn: "演示模式",
qrBtn: "扫码学习",
linkCopied: "链接已复制！",
mechanismLabel: "机理步骤",
conditionsLabel: "反应条件"
```

- [x] **Step 3.2 创建 `components/ReactionPage.tsx`（自学态壳 + 分流）**

```tsx
import React from 'react';
import { CuratedReaction } from '../src/data/reactions/schema';
import { Molecule3DViewer } from './Molecule3DViewer';
import { PresentationMode } from './PresentationMode';
import { QrShare } from './QrShare';
import { updateRouteParams } from '../utils/routeParams';
import { ArrowLeft, Presentation as PresentationIcon } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ReactionPageProps {
  reaction: CuratedReaction;
  present: boolean;
  onExit: () => void;
}

export const ReactionPage: React.FC<ReactionPageProps> = ({ reaction, present, onExit }) => {
  const { t } = useLanguage();
  if (present) {
    return (
      <PresentationMode
        equation={reaction.equation}
        conditions={reaction.conditions}
        title={reaction.title}
        steps={reaction.mechanismSteps}
        structure={reaction.productStructure}
        onClose={() => updateRouteParams({ mode: null })}
      />
    );
  }
  return (
    <div className="flex flex-col h-full gap-6 p-6 overflow-y-auto">
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-[#f0ece4]">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onExit}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f0ece4] text-[#5c5549] hover:bg-[#e8d5b8] transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> {t('backBtn')}
          </button>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#f5f0e8] text-[#866027] border border-[#e8d5b8]">
            {reaction.chapter}
          </span>
        </div>
        <h2 className="text-2xl font-bold font-display text-[#1a1a1a] mb-3">{reaction.title}</h2>
        <div className="p-4 bg-science-50 rounded-xl border border-science-200 font-mono text-lg text-science-800 break-words mb-3">
          {reaction.equation}
        </div>
        <p className="text-sm text-[#5c5549] mb-4">
          <span className="font-semibold">{t('conditionsLabel')}:</span> {reaction.conditions || '—'}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => updateRouteParams({ mode: 'present' })}
            className="px-5 py-2.5 rounded-lg font-semibold text-white shadow-md bg-gradient-to-r from-science-600 to-science-500 hover:from-science-700 hover:to-science-600 transition-all flex items-center gap-2"
          >
            <PresentationIcon className="w-4 h-4" /> {t('demoBtn')}
          </button>
          <QrShare />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-[#f0ece4]">
          <h3 className="text-lg font-semibold text-[#1a1a1a] mb-3">{t('mechanismLabel')}</h3>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-[#5c5549]">
            {reaction.mechanismSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            {reaction.products.map((p, i) => (
              <span key={i} className="px-3 py-1 bg-[#f5f0e8] border border-[#e8d5b8] rounded-full text-sm text-[#1a1a1a]">
                {p}
              </span>
            ))}
          </div>
        </div>
        <div className="min-h-[360px] bg-white rounded-2xl shadow-lg border border-[#f0ece4] overflow-hidden">
          {reaction.productStructure ? (
            <Molecule3DViewer structure={reaction.productStructure} />
          ) : (
            <div className="h-full flex items-center justify-center text-[#6f685d] text-sm">
              {t('noStructureMsg')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

语言键补充（en/zh）：`noStructureMsg: "No 3D structure available for this reaction." / "该反应暂无 3D 结构数据。"`

- [x] **Step 3.3 创建占位 `components/PresentationMode.tsx`（Task 4 实现）**

先导出最小可编译壳（避免阻塞本 Task 编译）：

```tsx
import React from 'react';
import { MoleculeStructure } from '../types';

interface PresentationModeProps {
  equation: string;
  conditions: string;
  title: string;
  steps: string[];
  structure: MoleculeStructure | null;
  onClose: () => void;
}

export const PresentationMode: React.FC<PresentationModeProps> = (props) => {
  void props;
  return null;
};
```

同样先建 `components/QrShare.tsx` 占位：

```tsx
import React from 'react';
export const QrShare: React.FC = () => null;
```

- [x] **Step 3.4 `App.tsx` 路由接线**

(a) 导入区追加：

```tsx
import { useEffect, useState } from 'react';
import { parseRoute, updateRouteParams, RouteTarget } from './utils/routeParams';
import { ReactionPage } from './components/ReactionPage';
import { getReaction } from './src/data/reactions';
```

(b) 组件内 tab state 之后加路由状态：

```tsx
  const [route, setRoute] = useState<RouteTarget>(() => parseRoute(window.location.search));
  useEffect(() => {
    const sync = () => setRoute(parseRoute(window.location.search));
    window.addEventListener('popstate', sync);
    window.addEventListener('chemai-route', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('chemai-route', sync);
    };
  }, []);

  const reaction = route.slug ? getReaction(route.slug) : undefined;
  const exitReaction = () => updateRouteParams({ r: null, mode: null });
```

(c) 主内容改为 slug 优先：

```tsx
           {reaction ? (
             <ReactionPage reaction={reaction} present={route.present} onExit={exitReaction} />
           ) : activeTab === 'reaction' ? (
             <ReactionLab />
           ) : activeTab === 'library' ? (
             <LibraryModule />
           ) : (
             <BuilderModule />
           )}
```

- [x] **Step 3.5 验证**

Run: `npm test && npx tsc --noEmit && npm run build >/dev/null && echo TASK3_OK`

手工冒烟（可选）：`/?r=不存在` 应回退 tab 视图（getReaction undefined）。

Expected: `TASK3_OK`。

- [x] **Step 3.6 Commit**

```bash
git add components/ReactionPage.tsx components/PresentationMode.tsx components/QrShare.tsx App.tsx contexts/LanguageContext.tsx
git commit -m "feat(ui): reaction page routing with self-study/present split and placeholders"
```

---

### Task 4：全屏演示模式（≈3 小时）

**Files:** Modify `components/PresentationMode.tsx`（替换占位）、Modify `components/ReactionLab.tsx`

- [x] **Step 4.1 实现完整 `PresentationMode.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { MoleculeStructure } from '../types';
import { Molecule3DViewer } from './Molecule3DViewer';
import { ChevronLeft, ChevronRight, Minimize2, Maximize2 } from 'lucide-react';

interface PresentationModeProps {
  equation: string;
  conditions: string;
  title: string;
  steps: string[];
  structure: MoleculeStructure | null;
  onClose: () => void;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({
  equation,
  conditions,
  title,
  steps,
  structure,
  onClose,
}) => {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        setStepIndex((prev) => Math.max(prev - 1, 0));
      } else if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'f' || event.key === 'F') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [steps.length, onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#101418] text-white flex flex-col select-none">
      {/* Top bar */}
      <header className="flex items-start justify-between gap-4 px-8 pt-6 pb-4">
        <div className="min-w-0">
          <div className="font-mono text-3xl md:text-5xl font-bold tracking-tight break-words">
            {equation}
          </div>
          <div className="mt-2 text-base md:text-xl text-white/60">
            {title}
            {conditions ? ` · ${conditions}` : ''}
          </div>
        </div>
        <button
          onClick={onClose}
          title="Esc"
          className="shrink-0 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
        >
          <Minimize2 className="w-6 h-6" />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-6 px-8 pb-8">
        {/* Mechanism steps */}
        <div className="md:w-[45%] flex flex-col justify-center gap-4 min-w-0">
          {steps.map((step, i) => {
            const active = i === stepIndex;
            return (
              <button
                key={i}
                onClick={() => setStepIndex(i)}
                className={`text-left rounded-2xl px-6 py-5 transition-all duration-300 ${
                  active
                    ? 'bg-white/15 scale-[1.03] shadow-xl'
                    : 'bg-transparent text-white/40 hover:text-white/70'
                }`}
              >
                <span className={`block ${active ? 'text-2xl md:text-3xl font-semibold' : 'text-lg md:text-xl'}`}>
                  {step}
                </span>
              </button>
            );
          })}
        </div>

        {/* Structure */}
        {structure && (
          <div className="md:w-[55%] min-h-[240px] md:min-h-0 rounded-3xl overflow-hidden bg-black/30">
            <Molecule3DViewer structure={structure} />
          </div>
        )}
      </div>

      {/* Footer controls */}
      <footer className="flex items-center justify-between px-8 pb-6 text-white/70">
        <button
          onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
          disabled={stepIndex === 0}
          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="font-mono text-xl">
          {stepIndex + 1} / {steps.length}
        </div>
        <button
          onClick={() => setStepIndex((prev) => Math.min(prev + 1, steps.length - 1))}
          disabled={stepIndex === steps.length - 1}
          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </footer>
    </div>
  );
};
```

说明：Maximize2 图标本任务不用可移除 import；保留 F 键走原生 Fullscreen API。

- [x] **Step 4.2 AI 自由探索结果接入「演示」入口（改 `components/ReactionLab.tsx`）**

导入 `PresentationMode` 与 lucide `Presentation` 图标；组件内加状态：

```tsx
const [presenting, setPresenting] = useState(false);
```

结果卡「产品结构」标题行右侧的 `{t('interactive')}` 徽章旁追加按钮：

```tsx
<button
  onClick={() => setPresenting(true)}
  className="flex items-center gap-1 text-xs px-2 py-1 bg-[#f5f0e8] text-[#866027] rounded border border-[#e8d5b8] hover:bg-[#efe6d5] transition-colors"
>
  <Presentation className="w-3 h-3" /> {t('demoBtn')}
</button>
```

组件返回的最外层 fragment 末尾（`</>` 之前）挂载：

```tsx
{presenting && result && (
  <PresentationMode
    equation={result.equation}
    conditions={conditions}
    title={t('reactionResult')}
    steps={result.mechanismSteps}
    structure={result.productStructure}
    onClose={() => setPresenting(false)}
  />
)}
```

- [x] **Step 4.3 验证**

Run: `npm test && npx tsc --noEmit && npm run build >/dev/null && echo TASK4_OK`

手工冒烟（可选）：分子库暂无条目，可临时在浏览器对任意 AI 分析结果点「演示」验证键盘 ←→/F/Esc。

Expected: `TASK4_OK`。

- [x] **Step 4.4 Commit**

```bash
git add components/PresentationMode.tsx components/ReactionLab.tsx
git commit -m "feat(ui): fullscreen presentation mode with keyboard controls for classroom projection"
```

---

### Task 5：二维码分享与移动端适配（≈2 小时）

**Files:** Modify `components/QrShare.tsx`、Modify `package.json`、Modify `components/LibraryModule.tsx`

- [x] **Step 5.1 安装依赖**

```bash
npm install qrcode && npm install -D @types/qrcode
```

- [x] **Step 5.2 实现 `components/QrShare.tsx`**

```tsx
import React, { useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, QrCode } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const QrShare: React.FC = () => {
  const { t } = useLanguage();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleQr = async () => {
    if (dataUrl) {
      setDataUrl(null);
      return;
    }
    const url = window.location.href;
    setDataUrl(await QRCode.toDataURL(url, { width: 220, margin: 1 }));
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时忽略（二维码本身已可用）
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => void toggleQr()}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium border border-science-300 text-science-700 hover:bg-science-50 transition-colors"
      >
        <QrCode className="w-4 h-4" /> {t('qrBtn')}
      </button>
      {dataUrl && (
        <div className="absolute right-0 top-full mt-2 z-20 bg-white rounded-xl shadow-xl border border-[#e8d5b8] p-4 w-[240px]">
          <img src={dataUrl} alt="QR" className="w-full rounded-lg" />
          <button
            onClick={() => void copyLink()}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#f0ece4] hover:bg-[#e8d5b8] text-sm font-medium text-[#5c5549]"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            {copied ? t('linkCopied') : window.location.host + window.location.pathname}
          </button>
        </div>
      )}
    </div>
  );
};
```

- [x] **Step 5.3 移动端自查清单（手工，写入验收）**

375px 宽度下检查三处：ReactionLab 输入区不横向溢出；ReactionPage 两栏变单列（已有 lg: 断点）；演示模式结构区移到步骤下方且高度 ≥240px。发现溢出就地修 Tailwind 类（如 `min-w-0`/`break-words`）。

- [x] **Step 5.4 验证并提交**

Run: `npm test && npx tsc --noEmit && npm run build >/dev/null && echo TASK5_OK`

```bash
git add components/QrShare.tsx package.json package-lock.json components/LibraryModule.tsx
git commit -m "feat(ui): local QR share panel with copy-link fallback"
```

（注：LibraryModule 若本任务无改动则从 git add 中去掉。）

---

### Task 6：教材反应库浏览区 + 内容整理签核入库【含人工门禁】（≈4h 开发 + 内容并行）

**Files:** Modify `components/LibraryModule.tsx`、Modify `contexts/LanguageContext.tsx`、Create `src/data/reactions/mustate-1-02-na-cl.json` 等、Create `docs/specs/reaction-content-guide.md`

- [x] **Step 6.1 内容生产指南 `docs/specs/reaction-content-guide.md`**

写清：人教版章节对照表、条目字段填写规范（方程式配平、机理 2–5 步中文、productStructure 来源优先 PubChem 同名主产物）、`_staging` → 正式的晋级流程、签核台账回填要求。给出一条完整样例（钠与水，含 21 原子级结构可后续补 null）。

- [x] **Step 6.2 LibraryModule 顶部加「教材反应库」浏览区**

在搜索卡之上插入策展区（数据为空时渲染 `curatedEmpty` 空态）：

```tsx
import { ALL_REACTIONS, CHAPTERS } from '../src/data/reactions';
import { BookOpen } from 'lucide-react';
import { updateRouteParams } from '../utils/routeParams';
```

```tsx
{/* Curated library */}
<div className="bg-white p-6 rounded-2xl shadow-lg border border-[#f0ece4]">
  <h2 className="text-lg font-bold font-display text-[#1a1a1a] mb-3 flex items-center gap-2">
    <BookOpen className="w-5 h-5 text-science-600" /> {t('navLibraryCurated')}
  </h2>
  {ALL_REACTIONS.length === 0 ? (
    <p className="text-sm text-[#6f685d]">{t('curatedEmpty')}</p>
  ) : (
    <div className="flex flex-wrap gap-2">
      {[...new Map(ALL_REACTIONS.map((r) => [r.id, r])).values()].map((r) => (
        <button
          key={r.id}
          onClick={() => updateRouteParams({ r: r.id })}
          className="px-3 py-1.5 rounded-full text-sm border border-[#e8d5b8] hover:border-science-400 hover:text-science-700 transition-colors"
          title={`${r.chapter} · ${r.title}`}
        >
          {r.title}
        </button>
      ))}
    </div>
  )}
</div>
```

- [x] **Step 6.3 内容生产（人工为主，agent 可代拟初稿）**

按指南产出 30–40 条到 `_staging/`；国维联系任课老师逐条审核；签核记录进 `docs/specs/reaction-signoff.md`。**每获签一批**：将条目并入对应章节 JSON → 在 `index.ts` 登记 import → data.test 自动校验。

**门禁规则**：只有签核过的条目允许进入正式 JSON；agent 不得代替老师置 `reviewed:true`。

- [x] **Step 6.4 验证**

Run: `npm test && npx tsc --noEmit && npm run build >/dev/null && echo TASK6_OK`

Expected: `TASK6_OK`（签核不足 10 条时 Task 7 门禁会拦发布）。

- [x] **Step 6.5 Commit（每批一次）**

```bash
git add src/data/reactions docs/specs components/LibraryModule.tsx contexts/LanguageContext.tsx
git commit -m "feat(data): curated textbook reactions batch N (teacher-reviewed)"
```

---

### Task 7：全量验证 · 部署门禁 · Vault 同步（≈2 小时）

- [x] **Step 7.1 全量四件套 + 密钥扫描**

```bash
npm test && npx tsc --noEmit && npm run build >/dev/null && npm run worker:check >/dev/null \
&& ! grep -rlE "sk-[A-Za-z0-9]{10,}|api\.deepseek\.com.{0,60}(Bearer|[A-Za-z0-9_-]{20,})" dist/ && echo ALL_GREEN
```

- [x] **Step 7.2 发布门槛核对（人工事实）**

- [x] 签核条目 ≥10（台账 40 条已登记，口径=弈沐哥授权先上线、老师签核后补）
- [ ] 断网冒烟：DevTools Offline 下打开库条目完整可用（移交主人体验确认；数据在 bundle 内已由构建验证）
- [ ] 手机宽度冒烟：375px 无横向滚动（移交主人）
- [ ] 二维码扫码直达正确反应（移交主人）

- [x] **Step 7.3 【门禁·需主人确认】合并部署**

向主人展示勾选状态、ALL_GREEN、签核台账、commit 列表。同意后：

```bash
git checkout main && git merge --ff-only feat/classroom-showcase && git push origin main
```

（Worker 本轮零改动，无需 wrangler deploy。）Pages 构建后探针：

```bash
curl -sS -o /dev/null -w "front:%{http_code}\n" https://chemai101.guoweiwang.com/
js=$(curl -sS https://chemai101.guoweiwang.com/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)
curl -sS "https://chemai101.guoweiwang.com$js" | grep -q "mode=present\|Textbook Reactions\|教材反应库" && echo BUNDLE_VERIFIED
```

- [x] **Step 7.4 证据归档**

存 `docs/specs/evidence-classroom/`：ALL_GREEN 输出、探针输出、bundle 名、merge hash；提交 `chore: archive classroom showcase evidence`。

- [x] **Step 7.5 Vault 同步（小范围文档修正）**

- ACT-07 卡：更新记录补一行「第二轮课堂展示升级（演示模式/反应库/二维码）」+ 新 E07 证据行；
- EVT-2026-012：touch 记录新功能面（revision 顺延）；
- 中枢日志一行；STEM 双文档同步；
- wiki-log（署名 ox-alpha）→ `generate-index.py` → `vault-check.sh`。

- [x] **Step 7.6 回到本计划：全部勾选 + 进度日志终行**

---

## 明确不做（YAGNI）

课堂小测、使用统计、账号体系、教师后台、CMS、路由框架、SSR、二维码之外的分享 SDK、Worker/AI 层任何改动。

## 已知风险与预案

| 风险 | 预案 |
| --- | --- |
| 老师签核慢于开发 | 工程侧完成即停 Task 7 门禁前；站点以「审核中」空态上线，签核一批上一批 |
| 结构数据缺失 | schema 允许 null，演示模式隐藏 3D 区；不伪造坐标 |
| qrcode 包体积 | 仅 ~15KB gzip，可接受；不做懒加载 |
| 机理步骤中文表述学科性 | 内容指南要求对照教材表述；老师签核兜底 |

## 进度日志（执行者追加，勿删）

| 日期 | Task | 结果 | Commit / 备注 |
| --- | --- | --- | --- |
| 2026-08-25 | — | 设计 spec 定稿并获批（ox-alpha），主人选定方案 C／~15h／人教版 | 基于 main fd02715 |
| 2026-08-25 | Task 0 | 分支 feat/classroom-showcase 基线全绿（22 测试） | — |
| 2026-08-25 | Task 1 | routeParams 纯函数 + vitest include 扩展 utils/**：3 用例绿 | 05a10b5 |
| 2026-08-25 | Task 2 | schema/loader/数据完整性测试：4 用例绿；修 tsconfig resolveJsonModule 与三级 import 路径；vitest include 补 src/** | 088308c |
| 2026-08-25 | Task 3 | ReactionPage 双形态 + App 路由接线（slug 优先于 tab，popstate+自定义事件同步） | 54ab074 |
| 2026-08-25 | Task 4 | 全屏演示模式（←→/F/Esc 键控、大字号规格、AI 结果入口） | abc400a |
| 2026-08-25 | Task 5 | qrcode 二维码面板 + 复制链接回退；移动端清单留 Task 7 冒烟 | f84aee5 |
| 2026-08-25 | Task 6 | 草稿 30 条（人教版必修主干）入 _staging + 内容指南 + 策展浏览区 UI（空态）；**老师签核待人工** | 18852e8 |
| 2026-08-25 | Task 7 | 等待：签核 ≥10 条 → 主人确认部署 → Vault 同步 | GATE |
| 2026-08-25 | 6（内容线） | 内容指南 v0.9.1 + 素材库合并收敛为唯一权威 `batch-1-draft-v1.json`（40 条，吸收并行草稿 6 条/裁 6 条）+ 重生成老师审核清单；全部校验通过、基线绿；**待主人签收后才进入老师签核流程**，未提交 commit | 未提交（签收后一并提交）；旧草稿改名 `.superseded.json` 留档 |
| 2026-08-25 | Task 6（完成） | 主人签收「40 个反应直接用、上线后老师签批」→ 40 条晋级正式章节文件（reviewed:true 为授权口径），38/40 回填真实 PubChem 结构（经生产 Worker 收割，31/33 唯一产物命中）；教材反应库独立为第四个 tab，LibraryModule 还原纯检索页；签核台账登记上线口径 | b029658 |
| 2026-08-25 | Task 7 | ALL_GREEN → 合并 main（fd02715..6d8f927）→ Pages 新 bundle index-BcLdNUOB.js 首轮验证命中 → 分享链接探针 200 → 证据归档 evidence-classroom/deploy-probes.md → Vault 同步完成。7.2 三项体验冒烟移交主人 | 6d8f927 |
| 2026-08-25 | 终验 | 计划核心闭环完成：演示模式 + 教材反应库（40 条）+ 分享二维码全部上线。遗留：老师签核后补（勾 ✘ 条目按意见修订/下线）；三项体验冒烟由主人随手确认 | — |

| 2026-08-25 | 热修 | 主人手机实测三问题修复并上线（9878b01，bundle index-Aa9x9gcm.js）：① 移动端滚动（100dvh＋父级 overflow-y-auto，桌面行为不变）② 条目子页点任意标签自动退出子页 ③ 教材反应库移至首位并设为默认落地页；附标题响应式与导航防溢出 | 9878b01 |

| 2026-08-25 | 追加 | 主人提出并批准首页 Dashboard：新增 HomeModule 四卡片入口（教材库卡片带 40 条统计与签批徽章），home 为默认落地页，导航首位加 🏠 首页；沿用现有视觉风格。上线 bundle index-DWYgxkSB.js | 9f2b51a |

> **本计划已完结（含一项移交主人的体验冒烟清单）。** 后续迭代新建计划文档。
