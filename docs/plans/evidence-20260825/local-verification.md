# 本地验证记录（部署前 · ox-alpha）

时间：2026-08-25 12:05–12:10（本机）

## 环境

- vite dev server：http://localhost:3000（HTTP 200）
- 本地 Worker：`npx wrangler dev --port 8788`（worker/src/index.ts 当前分支版本）
- 生产 Worker：chemai101-api（未部署新代码）

## 新端点防护路径（本地 Worker，真实 HTTP）

| 探针 | 期望 | 实际 |
| --- | --- | --- |
| GET /v1/compound，Origin=evil.example.com | 403 | 403 ✅ |
| GET ?name=%3Cscript%3E | 400 | 400 ✅ |
| POST /v1/compound | 405 | 405 ✅ |

## PubChem 上游状态说明

- 直连 `pubchem.ncbi.nlm.nih.gov` 返回 503（PUGREST.ServerBusy）——本机 IP 因
  2026-08-25 上午的计划调研请求触发限流，与本项目代码无关。
- Worker 行为符合设计：重试一次后降级 503，前端有对应 busy 文案。
- 已挂后台轮询（每 2 分钟，至多 1 小时），解禁后自动补 aspirin 端到端成功证据。

## 生产端点回归确认

- OPTIONS https://chemai101-api.guoweiwang27.workers.dev/v1/analyze
  （Origin: http://localhost:3000）→ **204**，预览环境 AI 功能不受影响。

## 全量四件套（Task 8.2 存档）

npm test 22/22 · tsc --noEmit 零错误 · vite build 成功 · wrangler deploy --dry-run 通过
· dist 密钥扫描零命中 = ALL_GREEN（2026-08-25，commit af64243 之后复核）
