# 分子库「AI 认分子」实施计划

> **For agentic workers:** 断点续接真源。接手 agent：看进度日志最后一行，从第一个未勾选任务继续。

**Goal:** 分子库新增 AI 识别入口——用户描述分子特征（外观/气味/性质），AI 给最多 3 个候选（名称+分子式+理由），用户确认后自动调现有 PubChem 管线查真实条目。

**Architecture:** 完全复用现象解读模式：worker `/v1/analyze` 新增 `identifyMoleculeByDesc` 操作；LibraryModule 加双 Tab（AI 认分子=默认 / 按名字搜索=原样）；确认即以候选名调用现有 `fetchCompound`。

**Tech Stack:** 现有 DeepSeek 代理、PubChem 管线（含 worker 内 zh-names 中文名映射）。

---

### Task 13: Worker identifyMoleculeByDesc 操作

**Files:** Modify `worker/src/index.ts`

- [x] **Step 13.1** `AnalyzeRequest` 加分支 `{operation:'identifyMoleculeByDesc'; description:string; language}`；校验非空 ≤4000
- [x] **Step 13.2** prompt：只认中学教学级常见物质；候选必须 PubChem 可查（标准名）；最多 3 个按可能性排序；认不出给空数组+note；语言指令强制所有文本字段
- [x] **Step 13.3** temperature 0.3；buildPrompt 分派
- [x] **Step 13.4** 校验测试：非法 description → 400
- [x] **Step 13.5** `npm test && npm run worker:check` 绿，commit

### Task 14: 前端服务层

**Files:** Modify `services/geminiService.ts`

- [x] **Step 14.1** `MoleculeCandidate{name,formula,rationale}` + `identifyMolecule(description, language)`
- [x] **Step 14.2** Commit

### Task 15: LibraryModule 双 Tab UI

**Files:** Modify `components/LibraryModule.tsx`、`contexts/LanguageContext.tsx`

- [x] **Step 15.1** Tab 切换：AI 认分子（默认）/按名字搜索（原表单零改动）
- [x] **Step 15.2** AI 面板：textarea + 示例 chips + 识别按钮；候选卡（名称+分子式 mono+理由+「就是它，查库」）；都不对重置
- [x] **Step 15.3** 确认回调：setQuery(候选名) → 走现有 handleSearch → PubChem 结果区原样展示；查询期间沿用生成中提示样式
- [x] **Step 15.4** i18n 中英全键位
- [x] **Step 15.5** `npm test && tsc && build` 绿，commit

### Task 16: 发布验证

- [x] **Step 16.1** worker deploy + push main + curl 实测识别接口（品红褪色→SO₂）+ Pages bundle 验证
- [ ] **Step 16.2** 手验全链路留给主人

---

## 进度日志（追加式）

- [2026-08-26 15:10] 洋米(Mac本地): 主人确认与现象解读同构的方案，立此计划，Tasks 13–16 待执行
- [2026-08-26 15:45] 洋米(Mac本地): Tasks 13–16 完成——worker 4d5b21ff 上线，实测品红褪色→二氧化硫(SO2)→PubChem CID 1119 全链路通；Pages 已上线；16.2 手验留给主人
