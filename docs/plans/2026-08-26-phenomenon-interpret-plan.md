# 反应实验室「现象解读」实施计划

> **For agentic workers:** 断点续接真源。接手 agent：看进度日志最后一行，从第一个未勾选任务继续。

**Goal:** 实验室新增现象模式——用户用大白话描述现象（如「大象牙膏的原理」），AI 解读出 2–3 个候选反应卡（方程式+理由），点选后自动填入反应物/条件并走现有生成管线出完整结果。

**Architecture:** 复用 worker `/v1/analyze` 通道新增 `interpretPhenomenon` 操作；前端 ReactionLab 加双模式 Tab（现象=默认 / 专业=原表单），候选卡确认后一键生成。

**Tech Stack:** 现有 DeepSeek 代理、JSON response_format、限流复用；React 19。

---

### Task 9: Worker interpretPhenomenon 操作

**Files:** Modify `worker/src/index.ts`、`worker/test/track.test.ts`（或新建 analyze 校验测试）

- [x] **Step 9.1** `AnalyzeRequest` 联合类型加 `{ operation:'interpretPhenomenon'; phenomenon:string; language }`
- [x] **Step 9.2** `asAnalyzeRequest` 加分支：phenomenon 非空 string、长度 ≤4000
- [x] **Step 9.3** `buildPrompt` 加解读 prompt：教学级演示实验限定（越界返回空 candidates+note）、2–3 候选、输出 `{candidates:[{reactants,conditions,equation,rationale}],note}`
- [x] **Step 9.4** 上游调用 temperature 分支加 interpretPhenomenon → 0.5
- [x] **Step 9.5** 新增校验测试：非法 phenomenon body → 400
- [x] **Step 9.6** `npm run worker:check && npm test` 绿，commit `feat(worker): interpretPhenomenon operation`

### Task 10: 前端服务层

**Files:** Modify `services/geminiService.ts`

- [x] **Step 10.1** `ReactionCandidate`/`InterpretResult` 接口 + `interpretPhenomenon(phenomenon, language)`，POST `/v1/analyze`，candidates 非数组时抛错
- [x] **Step 10.2** Commit `feat(service): phenomenon interpretation client`

### Task 11: ReactionLab 双模式 UI

**Files:** Modify `components/ReactionLab.tsx`、`contexts/LanguageContext.tsx`

- [x] **Step 11.1** 输入卡顶部 Tab：现象模式（默认）/专业模式；专业模式渲染现有表单零改动
- [x] **Step 11.2** 现象模式：textarea + 示例 chips（中英各一套）+「AI 解读」按钮
- [x] **Step 11.3** 候选卡片区：1–3 张卡（方程式大字+rationale+「就这个，生成」）；「都不对，换个说法」重置
- [x] **Step 11.4** 确认回调：setReactants/setConditions 同步表单 + 直接调生成（handlePredict 改为可传显式参数）
- [x] **Step 11.5** i18n 中英全键位；失败 alert 可重试；空 candidates 显示 note
- [x] **Step 11.6** `npm test && npx tsc --noEmit && npm run build` 绿，commit `feat(lab): phenomenon interpretation mode`

### Task 12: 发布验证

- [x] **Step 12.1** 全量验证 + push main + Pages 构建后 curl bundle 验证特征串
- [ ] **Step 12.2** 手验：大象牙膏→出候选→确认→出结果全链路（留给主人）

---

## 进度日志（追加式）

- [2026-08-26 14:20] 洋米(Mac本地): 设计经主人批准（2–3 候选方案）立此计划，Tasks 9–12 待执行
- [2026-08-26 14:50] 洋米(Mac本地): Tasks 9–12 完成——worker interpretPhenomenon 上线(版本 d421da77)，大象牙膏/暖宝宝实测解读正确且中文输出；前端 Pages 已上线；Step 12.2 手验留给主人
