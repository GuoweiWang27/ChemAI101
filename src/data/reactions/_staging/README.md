# 草稿区（未签核）

未获任课老师签字的反应条目放这里（JSON 片段即可），**不会被 loader 导入**。
签字后：把条目并入对应章节 JSON → 移出本目录 → data.test 自动接管校验。
签核留痕统一登记在 docs/specs/reaction-signoff.md（日期 / 条目 id / 确认方式）。

## 条目 JSON 片段模板

```json
{
  "id": "na-h2o",
  "chapter": "必修1·第二章 海水中的重要元素",
  "title": "钠与水反应",
  "reactants": "Na + H2O",
  "conditions": "常温",
  "equation": "2Na + 2H2O = 2NaOH + H2↑",
  "products": ["NaOH", "H2"],
  "mechanismSteps": ["…", "…"],
  "productStructure": null,
  "smiles": "[OH-]…（可省）",
  "reviewed": true
}
```

注意：`reviewed: true` 只有在老师签字后才允许写；草稿阶段请省略该字段或写注释说明待签。

## 当前批次

- `batch-1-draft-v1.json`：首批 40 条，**唯一权威草稿**（ox-alpha 代拟并合并并行草稿，2026-08-25）。
- `draft-batch-v1.superseded.json`：早期并行草稿（31 条），已被上面文件取代，仅留档备查，勿再编辑或签核。
- 填写规范以 `docs/specs/reaction-content-guide.md` 为准（章节全名、中文产物名、Unicode 下标、主产物排序等）；上方模板仅示意结构。
- 条目中的 `products_pubchem_main` 是 staging 专用来源标注字段（主产物的 PubChem 英文名），晋级时随补 `reviewed: true` 一并删除。
- 给老师的逐条审核卡片（打印用）：`docs/specs/teacher-review-checklist.md`。
