# 机理 3D 动画 Phase 2（全程反应动画）实施计划

> **For agentic workers:** 断点续接真源。接手 agent：看进度日志最后一行，从第一个未勾选任务继续。
> Phase 1（步骤编舞）已上线，见 2026-08-26-mechanism-animation-phase1-plan.md。

**Goal:** 精选反应新增「全程动画」：反应物分子飞入 → 原子挣脱反应物键、带着映射飞向产物位 → 产物键依次生长 → 脉冲定格。演示模式加「全程动画」按钮切换播放。

**Architecture:** `CuratedReaction` 新增可选 `reactionFlow`（反应物结构片段 + 摆位 + 原子映射 atomMap）；新组件 `ReactionFlowScene` 单一时间轴状态机（入场→激发→发射→组装→定格），原子逐个插值飞行、反应物键随端点离开而淡出、产物键双端到达后生长；未映射原子（副产物）淡出。数据由子代理按签核管线生成 10 条精选反应。

**Tech Stack:** 现有 R3F 栈，零新依赖。

---

### Task 20: 数据模型与校验

**Files:** Modify `src/data/reactions/schema.ts`、`src/data/reactions/data.test.ts`

- [ ] 20.1 schema 加 `reactionFlow?: { reactants: {label,structure,position}[]; atomMap: {reactant,atom,to}[] }`
- [ ] 20.2 data.test 校验：to 必须是产物原子 id 且不重复；reactant 索引/原子 id 存在；position 三维
- [ ] 20.3 Commit

### Task 21: 精选反应数据生成（子代理 + 签核）

**Files:** 10 条精选：na-h2o、cl2-na、cl2-fe、cl2-h2、c2h4-br2、c2h4-hydration、esterification、ethanol-cat-oxidation、nh3-hcl-smoke、nh3-cat-oxidation

- [ ] 21.1 导出产物结构 → 2 个子代理并行生成 reactionFlow JSON
- [ ] 21.2 合并校验（to 唯一、id 合法）写回章节 JSON
- [ ] 21.3 化学抽查（映射方向、副产物处理）→ draft 提交待签核

### Task 22: ReactionFlowScene 场景

**Files:** Create `components/ReactionFlowScene.tsx`

- [ ] 22.1 单一时间轴（playKey 重播）：入场 0–1.2s → 激发抖动 1.4–2.2s → 逐原子发射飞行 2.4s 起（每颗错峰 0.12s、飞行 1.1s）→ 产物键双端到达后生长 → 7.2s 脉冲 → 定格慢转
- [ ] 22.2 反应物键：任一端点已发射/淡出即 0.3s 淡出；未映射原子 3.0–4.2s 淡出（副产物暗示）
- [ ] 22.3 到达火花 + 产物脉冲；点原子回调接讲解面板
- [ ] 22.4 reduced-motion：直接呈现产物完成态
- [ ] 22.5 Commit

### Task 23: PresentationMode 集成 + 发布

**Files:** Modify `components/PresentationMode.tsx`、`contexts/LanguageContext.tsx`

- [ ] 23.1 有 reactionFlow 的反应显示「▶ 全程动画」按钮：切换播放/返回编舞；重播按钮
- [ ] 23.2 i18n 中英；全量验证；push 上线 bundle 验证
- [ ] 23.3 手验留给主人

---

## 进度日志（追加式）

- [2026-08-26 17:10] 洋米(Mac本地): 主人拍板继续 Phase 2，立此计划；数据生成与场景开发并行推进
