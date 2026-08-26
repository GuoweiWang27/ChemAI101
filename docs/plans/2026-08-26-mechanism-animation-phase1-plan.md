# 机理 3D 动画 Phase 1（重组编舞）实施计划

> **For agentic workers:** 断点续接真源。接手 agent：看进度日志最后一行，从第一个未勾选任务继续。
> Phase 2（反应物飞入全流程动画）另立计划，本文件只覆盖 Phase 1。

**Goal:** 演示模式从「静态高亮」升级为「编舞」——切换机制步骤时，该步涉及的原子以弹簧物理位移/回弹，化学键实时跟随伸缩并在受力时变色，配合火花迸发，让分子真的「演」出机理。

**Architecture:** 新组件 `MechanismMolecule`（R3F）：原子偏移量用弹簧积分（目标=步骤位移向量），键每帧从原子实时位置重建（拉伸自然发生），应变超阈值向琥珀色渐变（过渡态暗示）；PresentationMode 换用该组件，保留点选讲解面板。零新数据依赖（用现有 stepAtomIds），零新依赖包。

**Tech Stack:** 现有 react-three-fiber/drei；无外部动画库，手写弹簧积分。

---

### Task 17: MechanismMolecule 组件

**Files:** Create `components/MechanismMolecule.tsx`

- [ ] **17.1** 基础场景：原子球（CPK 色）+ 键圆柱，键每帧从原子当前位置重建（位置=中点、四元数=轴向、scale.y=当前长/基准长）
- [ ] **17.2** 步骤编舞：stepIndex 变化时为该步原子组生成位移目标（离心方向 + 以 (stepIndex,id) 确定性的抖动，幅度 0.55–0.95）；弹簧积分（stiffness≈42、damping≈9.5）驱动偏移；850ms 后目标衰减到 35%（定格「激活态」）；步骤切走目标归零自然回弹
- [ ] **17.3** 键应力变色：当前长度超基准 0.12 以上开始向琥珀 #f59e0b 插值（上限 0.5 应变）
- [ ] **17.4** 火花迸发：非空步骤切换瞬间在该组质心迸 10 颗小粒子（0.6s 飞散淡出）
- [ ] **17.5** 点选讲解：原子 onClick/onPointerOver 与 Molecule3DViewer 同款（选中描边 + onAtomSelect 回调），面板由父级渲染
- [ ] **17.6** prefers-reduced-motion：偏移恒为零，仅保留静态高亮
- [ ] **17.7** Commit `feat(present): mechanism choreography scene`

### Task 18: PresentationMode 接入

**Files:** Modify `components/PresentationMode.tsx`

- [ ] **18.1** 3D 区换 MechanismMolecule（传 structure/stepAtomIds/stepIndex/选中态）；保留 AtomInsightPanel 与 atomInsights prop
- [ ] **18.2** 移除旧的 chemai-pulse 整盒脉动（编舞取代之）；键盘/步进逻辑不动
- [ ] **18.3** `npm test && tsc && build` 绿，Commit `feat(present): wire choreography into presentation mode`

### Task 19: 发布验证

- [ ] **19.1** push main + Pages 上线 bundle 验证
- [ ] **19.2** 手验（主人）：钠与水/酯化/氨催化氧化逐步切换看编舞；空组步骤（纯现象描述）应只有轻脉动无原子乱动；点原子出讲解；reduced-motion 静态

---

## 进度日志（追加式）

- [2026-08-26 16:20] 洋米(Mac本地): 主人确认 Phase 1 方案（现有数据编舞版），立此计划，Tasks 17–19 待执行；Phase 2 待另立计划
- [2026-08-26 17:00] 洋米(Mac本地): Tasks 17–18 完成并上线（873c39f），bundle 验证编舞场景已部署；19.2 手验留给主人；Phase 2 待另立计划
