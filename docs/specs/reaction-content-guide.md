# 教材反应内容生产指南（人教版高中化学）· 草稿 v0.9

> **状态：草稿，待主人签收后生效。** 生效前不得据此向正式库晋级任何条目。
> 目标：首批 40 条典型反应；每条须经任课老师逐条签字后才可从 `_staging/` 晋级到正式章节数据文件。
> 机读素材库：`src/data/reactions/_staging/batch-1-draft-v1.json`（与本文档第 8 节清单一一对应）。
> 上游依据：`docs/specs/2026-08-25-classroom-showcase-design.md` §4；执行计划 Task 6 Step 6.1。

## 一、章节对照（人教版 2019 课标）

| 数据文件 | 教材范围 | 首批条目数 |
| --- | --- | --- |
| `mustate-1-01.json` | 必修第一册 第一章 物质及其变化（离子反应/氧化还原，视需要） | 0 |
| `mustate-1-02-na-cl.json` | 必修第一册 第二章 海水中的重要元素——钠和氯 | 14 |
| `mustate-1-03-fe.json` | 必修第一册 第三章 铁 金属材料 | 4 |
| `mustate-1-04-periodicity.json` | 必修第一册 第四章 物质结构 元素周期律 | 0 |
| `mustate-2-05-sn.json` | 必修第二册 第五章 化工生产中的重要非金属元素 | 11 |
| `mustate-2-06-energy.json` | 必修第二册 第六章 化学反应与能量 | 4 |
| `mustate-2-07-organic.json` | 必修第二册 第七章 有机化合物 | 7 |

章节全名（写入条目 `chapter` 字段的唯一合法值，与上表右列一致）：

```
必修1·第二章 海水中的重要元素——钠和氯
必修1·第三章 铁 金属材料
必修2·第五章 化工生产中的重要非金属元素
必修2·第六章 化学反应与能量
必修2·第七章 有机化合物
```

后续批次扩展备查：选择性必修 1 化学反应原理 / 2 物质结构与性质 / 3 有机化学基础，视余量再排。

## 二、来源基线（真实来源要求）

| 层级 | 来源 | 使用规则 |
| --- | --- | --- |
| 章节、方程式、机理表述 | 人教版《普通高中教科书·化学》（2019 年版）纸质教材 | **唯一权威**。目录交叉核对可用 [最新人教版(2019年)高中化学教材目录](https://wenku.baidu.com/view/5cd27bb84a649b6648d7c1c708a1284ac8500591.html)、[2019年人教版高中化学必修课目录](https://wenku.baidu.com/view/92a35d6c57270722192e453610661ed9ac515570)，但不得替代纸质教材 |
| 教材页码 | 国维对照手头纸质教材逐条补填 | 页码登记在签核台账备注列，签核前完成 |
| 3D 结构 | PubChem 同名主产物（PUG REST，3D 记录优先、缺 3D 回退 2D） | 复用现有 `worker/src/pubchem.ts` 的解析逻辑在构建期预取、静态打包，运行时零请求。每条主产物的 PubChem 英文名见第 8 节清单末列 |
| 结构兜底 | `productStructure: null` | 盐类/聚合物等无合适单分子 3D 记录时保持 null，前端隐藏 3D 区；**禁止手工编造坐标** |

## 三、条目字段规范（CuratedReaction）

| 字段 | 规范 |
| --- | --- |
| `id` | 全小写短横线 slug（`^[a-z0-9-]{1,64}$`），全局唯一。命名模式 `反应物-关键条件`，如 `na-h2o`、`nahco3-heat`、`fecl3-cu` |
| `chapter` | 只能取第一节列出的章节全名 |
| `title` | 中文短标题（≤12 字为宜），面向投屏大字显示 |
| `reactants` | 中文反应物列举，顿号分隔，如「钠、水」 |
| `conditions` | 单一短语：常温 / 点燃 / 加热 / 高温 / 光照 / 放电或高温 / 催化剂·加热 / 浓硫酸·加热；多条件用「·」连接 |
| `equation` | 配平后的方程式；Unicode 下标字符（H₂O、CO₂）；无机反应用 `=`，有机反应用 `→`，可逆反应用 `⇌`；气体 `↑`、沉淀 `↓` 按教材标注。反应条件一律完整填在 `conditions` 字段，方程式内不重复书写（浓度限定除外，如 `(浓)` `(稀)` `(g)` 保留在方程式内） |
| `products` | 中文产物名数组；**主产物放第一位**（其 PubChem 结构作为 3D 展示对象） |
| `mechanismSteps` | 2–5 步简体中文，按「现象 → 微观本质 → 能量变化」顺序；每步一句完整话。首句优先写可见实验现象，末句尽量落到教学落点（考点/生活应用/对比结论） |
| `productStructure` | 初稿阶段统一 `null`；签核晋级时由脚本按主产物 PubChem 名批量抓取回填 |
| `smiles` | 可选。仅当主产物 SMILES 无歧义且撰写者确信时填写（首批仅 5 条有机物填写），不确定就省略 |
| `reviewed` | **老师签字后才允许写 `true`**；签字前该字段整体省略（省略状态被复制进正式文件会直接触发 TS 类型报错，构成编译期门禁） |

## 四、晋级流程（_staging → 正式库）

1. 草稿放 `src/data/reactions/_staging/`（loader 不导入，不会进 bundle）；
2. 打印本指南第 8 节清单或发微信给任课老师逐条勾确认；
3. 签核结果登记到 `docs/specs/reaction-signoff.md`（日期 / 条目 id / 确认方式 / 备注含教材页码）；
4. 已签条目从 `_staging/batch-N-draft.json` 按 `chapter` 归入对应正式章节 JSON，补 `"reviewed": true`，同时删除 staging 专用字段 `products_pubchem_main`；
5. 在 `src/data/reactions/index.ts` 登记 import → `npm test` 由 `data.test.ts` 自动校验（slug 格式唯一、字段齐全、机理 2–5 步、结构元素/键合法性）；
6. 每批一次 commit（计划 Task 6 Step 6.5 文案）。

### 签核台账回填要求

| 列 | 要求 |
| --- | --- |
| 日期 | 签字当天 YYYY-MM-DD |
| 条目 id | 与 JSON 的 `id` 完全一致 |
| 老师确认方式 | 「纸质签字」「微信文字确认」「当面口头确认」三选一；微信确认需截图存档 |
| 备注 | 对应教材页码 + 老师修改意见（如有） |

发布门槛：Task 7 门禁要求台账 ≥10 行且与正式库内 `reviewed:true` 条目一一对应。

## 五、质量红线

- 方程式必须配平；条件信息不得丢失（写在 `conditions` 字段）。
- 不收录教材外的炫技反应；不确定准确性的条目宁可不上。
- 演示安全备注（如「氯气需通风」「强光直射爆炸风险」）写在 `mechanismSteps` 首步或 `conditions` 中。
- 主产物排序决定 3D 展示对象，调整顺序前先确认 PubChem 结构可得性。
- agent 永远不得代替老师置 `reviewed:true` 或伪造台账记录。

## 六、完整样例条目（钠与水）

```json
{
  "id": "na-h2o",
  "chapter": "必修1·第二章 海水中的重要元素——钠和氯",
  "title": "钠与水反应",
  "reactants": "钠、水",
  "conditions": "常温",
  "equation": "2Na + 2H₂O = 2NaOH + H₂↑",
  "products": ["氢氧化钠", "氢气"],
  "mechanismSteps": [
    "钠的密度比水小，浮在水面上",
    "反应放热，钠熔成闪亮小球（钠熔点低）",
    "小球四处游动并发出嘶嘶声（生成的气体推动）",
    "向反应后溶液滴入酚酞变红，证明生成碱（NaOH）",
    "收集气体靠近火焰有爆鸣声，证明是 H₂"
  ],
  "productStructure": null
}
```

> 晋级时由脚本按主产物「Sodium hydroxide」从 PubChem 抓取结构回填 `productStructure`；无可用记录则保持 null。

## 七、待确认池（首批不入库，签核时顺带问老师）

| 反应 | 未定原因 |
| --- | --- |
| 铝与氢氧化钠溶液（设计文档示例清单提到） | 2019 版人教中所属章节位置待对照纸质教材确认 |
| MnO₂ 与浓盐酸制氯气 | 新教材实验室制氯气的呈现位置/深度待确认 |
| SO₂ 使溴水褪色 | 正文还是习题呈现待确认 |
| 蔗糖/淀粉水解 | 第七章第四节深度视课时取舍 |

## 八、首批 40 条总清单（人审速览版）

下表供老师和主人逐条勾签；机读全文见 `_staging/batch-1-draft-v1.json`，逐条审核卡片版式见 `docs/specs/teacher-review-checklist.md`（打印用）。

### 必修1·第二章 海水中的重要元素——钠和氯（14 条）

| # | id | 标题 | 方程式 | 条件 | 主产物(PubChem 名) |
| --- | --- | --- | --- | --- | --- |
| 1 | na-h2o | 钠与水反应 | 2Na + 2H₂O = 2NaOH + H₂↑ | 常温 | Sodium hydroxide |
| 2 | na-o2-heat | 钠在氧气中燃烧 | 2Na + O₂ = Na₂O₂ | 点燃 | Sodium peroxide |
| 3 | na2o2-h2o | 过氧化钠与水 | 2Na₂O₂ + 2H₂O = 4NaOH + O₂↑ | 常温 | Oxygen |
| 4 | na2o2-co2 | 过氧化钠与二氧化碳 | 2Na₂O₂ + 2CO₂ = 2Na₂CO₃ + O₂ | 常温 | Carbon dioxide |
| 5 | nahco3-hcl | 碳酸氢钠与盐酸 | NaHCO₃ + HCl = NaCl + H₂O + CO₂↑ | 常温 | Carbon dioxide |
| 6 | nahco3-heat | 碳酸氢钠受热分解 | 2NaHCO₃ = Na₂CO₃ + H₂O + CO₂↑ | 加热 | Carbon dioxide |
| 7 | cl2-na | 钠在氯气中燃烧 | 2Na + Cl₂ = 2NaCl | 点燃 | Sodium chloride |
| 8 | cl2-fe | 铁在氯气中燃烧 | 2Fe + 3Cl₂ = 2FeCl₃ | 点燃 | Ferric chloride |
| 9 | cl2-cu | 铜在氯气中燃烧 | Cu + Cl₂ = CuCl₂ | 点燃 | Cupric chloride |
| 10 | cl2-h2 | 氢气在氯气中燃烧 | H₂ + Cl₂ = 2HCl | 点燃 | Hydrogen chloride |
| 11 | cl2-h2o | 氯气与水（氯水） | Cl₂ + H₂O ⇌ HCl + HClO | 常温 | Hypochlorous acid |
| 12 | cl2-nabr-displace | 氯气置换溴（与溴化钠） | Cl₂ + 2NaBr = 2NaCl + Br₂ | 常温 | Bromine |
| 13 | cl2-naoh | 氯气与氢氧化钠（尾气吸收） | Cl₂ + 2NaOH = NaCl + NaClO + H₂O | 常温 | Sodium hypochlorite |
| 14 | cl2-caoh2 | 氯气与石灰乳（制漂白粉） | 2Cl₂ + 2Ca(OH)₂ = Ca(ClO)₂ + CaCl₂ + 2H₂O | 常温 | Calcium hypochlorite |

### 必修1·第三章 铁 金属材料（4 条）

| # | id | 标题 | 方程式 | 条件 | 主产物(PubChem 名) |
| --- | --- | --- | --- | --- | --- |
| 15 | fe-h2o-steam | 铁与水蒸气 | 3Fe + 4H₂O(g) = Fe₃O₄ + 4H₂ | 高温 | Triiron tetraoxide |
| 16 | fecl2-cl2 | 氯气氧化氯化亚铁 | 2FeCl₂ + Cl₂ = 2FeCl₃ | 常温 | Ferric chloride |
| 17 | fecl3-fe | 铁与氯化铁 | 2FeCl₃ + Fe = 3FeCl₂ | 常温 | Ferrous chloride |
| 18 | fecl3-cu | 氯化铁与铜（电路板蚀刻） | 2FeCl₃ + Cu = 2FeCl₂ + CuCl₂ | 常温 | Cupric chloride |

### 必修2·第五章 化工生产中的重要非金属元素（11 条）

| # | id | 标题 | 方程式 | 条件 | 主产物(PubChem 名) |
| --- | --- | --- | --- | --- | --- |
| 19 | s-o2 | 硫在氧气中燃烧 | S + O₂ = SO₂ | 点燃 | Sulfur dioxide |
| 20 | so2-cat-oxidation | 二氧化硫催化氧化 | 2SO₂ + O₂ ⇌ 2SO₃ | 催化剂·加热 | Sulfur trioxide |
| 21 | cu-conc-h2so4 | 铜与浓硫酸 | Cu + 2H₂SO₄(浓) = CuSO₄ + SO₂↑ + 2H₂O | 加热 | Copper(II) sulfate |
| 22 | n2-o2 | 氮气与氧气 | N₂ + O₂ = 2NO | 放电或高温 | Nitric oxide |
| 23 | no2-h2o | 二氧化氮与水 | 3NO₂ + H₂O = 2HNO₃ + NO | 常温 | Nitric acid |
| 24 | nh3-fountain | 氨的喷泉实验 | NH₃ + H₂O ⇌ NH₃·H₂O | 常温 | Ammonia |
| 25 | nh3-hcl-smoke | 氨与氯化氢（白烟） | NH₃ + HCl = NH₄Cl | 常温 | Ammonium chloride |
| 26 | nh3-cat-oxidation | 氨的催化氧化 | 4NH₃ + 5O₂ = 4NO + 6H₂O | 催化剂·加热 | Nitric oxide |
| 27 | nh4cl-caoh2-lab | 实验室制氨气 | 2NH₄Cl + Ca(OH)₂ = CaCl₂ + 2NH₃↑ + 2H₂O | 加热 | Ammonia |
| 28 | cu-dil-hno3 | 铜与稀硝酸 | 3Cu + 8HNO₃(稀) = 3Cu(NO₃)₂ + 2NO↑ + 4H₂O | 常温 | Copper(II) nitrate |
| 29 | cu-conc-hno3 | 铜与浓硝酸 | Cu + 4HNO₃(浓) = Cu(NO₃)₂ + 2NO₂↑ + 2H₂O | 常温 | Copper(II) nitrate |

### 必修2·第六章 化学反应与能量（4 条）

| # | id | 标题 | 方程式 | 条件 | 主产物(PubChem 名) |
| --- | --- | --- | --- | --- | --- |
| 30 | zn-cu-cell | 铜锌原电池（总反应） | Zn + H₂SO₄(稀) = ZnSO₄ + H₂↑ | 常温 | Zinc sulfate |
| 31 | cao-water-exothermic | 生石灰与水（放热） | CaO + H₂O = Ca(OH)₂ | 常温 | Calcium hydroxide |
| 32 | baoh2-nh4cl-endothermic | 氢氧化钡晶体与氯化铵（吸热） | Ba(OH)₂·8H₂O + 2NH₄Cl = BaCl₂ + 2NH₃↑ + 10H₂O | 常温 | Barium chloride |
| 33 | al-fe2o3-thermite | 铝热反应 | 2Al + Fe₂O₃ = Al₂O₃ + 2Fe | 高温 | Iron |

### 必修2·第七章 有机化合物（7 条）

| # | id | 标题 | 方程式 | 条件 | 主产物(PubChem 名) |
| --- | --- | --- | --- | --- | --- |
| 34 | ch4-cl2-light | 甲烷与氯气取代 | CH₄ + Cl₂ → CH₃Cl + HCl | 光照 | Chloromethane |
| 35 | c2h4-br2 | 乙烯与溴加成 | CH₂=CH₂ + Br₂ → CH₂Br—CH₂Br | 常温 | 1,2-Dibromoethane |
| 36 | c2h4-hydration | 乙烯水化制乙醇 | CH₂=CH₂ + H₂O → CH₃CH₂OH | 催化剂·加压·加热 | Ethanol |
| 37 | c2h4-polymerization | 乙烯聚合 | nCH₂=CH₂ → 聚乙烯 | 催化剂 | Polyethylene |
| 38 | ethanol-cat-oxidation | 乙醇催化氧化 | 2C₂H₅OH + O₂ → 2CH₃CHO + 2H₂O | 催化剂(Cu)·加热 | Acetaldehyde |
| 39 | esterification | 乙酸与乙醇酯化 | CH₃COOH + C₂H₅OH ⇌ CH₃COOC₂H₅ + H₂O | 浓硫酸·加热 | Ethyl acetate |
| 40 | glucose-cuoh2 | 葡萄糖与新制氢氧化铜 | CH₂OH(CHOH)₄CHO + 2Cu(OH)₂ → CH₂OH(CHOH)₄COOH + Cu₂O↓ + 2H₂O | 加热 | Glucose |

> 合并说明：早期另一份草稿 `draft-batch-v1.superseded.json`（31 条）与本清单初版已收敛为本清单；吸收对方独有的 6 条（cl2-nabr-displace、so2-cat-oxidation、nh3-fountain、cao-water-exothermic、baoh2-nh4cl-endothermic、al-fe2o3-thermite），裁掉独立教学价值较低的 6 条（na2co3-hcl 并入对比步、caclo2-air 并入保存提示、fe-hcl、so2-water、caco3-decompose、ethanol-na）。

## 九、变更记录

| 日期 | 版本 | 说明 |
| --- | --- | --- |
| 2026-08-25 | v0.9 | 扩充为完整版：来源基线、字段规范细化、签核台账要求、样例、40 条素材清单（ox-alpha，待主人签收） |
| 2026-08-25 | v0.9.1 | 与并行草稿（31 条）合并收敛为单一权威清单：吸收 6 条、裁掉 6 条、总数保持 40；重生成老师审核清单（ox-alpha，待主人签收） |
