# 课堂展示升级 · 部署验收记录（2026-08-25）

- merge：`fd02715..6d8f927`（main，29 文件 +6697 行）
- Pages 新 bundle：`index-BcLdNUOB.js`（首轮检查即含 `na-h2o` 数据与教材模块代码）
- Worker：本轮零改动（沿用 Version `186693f3`）

| 探针 | 结果 |
| --- | --- |
| GET https://chemai101.guoweiwang.com/ | 200 |
| GET /?r=na-h2o（分享链接） | 200 |
| GET /?r=ch4-cl2&mode=present（演示态链接） | 200 |
| bundle 内容 | 含 40 条反应数据、TextbookModule、PresentationMode |

## 全量验证（Task 7.1 存档）

npm test 29/29 · tsc --noEmit 零错误 · vite build 成功 · worker:check dry-run 通过
· dist 密钥扫描零命中 = ALL_GREEN

## 数据集快照

40 条人教版必修主干反应（5 个章节文件：14+4+11+4+7）；
38/40 携带真实 PubChem 3D 主产物结构（聚乙烯为聚合物、Fe₃O₄ 无单一分子记录，按设计保持 null）；
`reviewed:true` 为弈沐哥 2026-08-25 授权上线，任课老师签核后补（台账 docs/specs/reaction-signoff.md）。

## 移交主人的冒烟清单（Task 7.2 剩余项）

- [ ] DevTools Offline 下打开任一库条目完整可演示
- [ ] 手机宽度（375px）自学态无横向滚动
- [ ] 手机扫码二维码直达正确反应
