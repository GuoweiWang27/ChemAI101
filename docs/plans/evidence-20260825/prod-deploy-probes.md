# 生产部署验收记录（Task 8.5 · 2026-08-25）

Worker Version ID: 186693f3-1e61-4480-a6da-184bd18fac93
部署时间：主人完成 wrangler login 授权并明确「部署吧」之后

| 探针 | 结果 |
| --- | --- |
| GET https://chemai101.guoweiwang.com/ | 200 |
| OPTIONS /v1/compound（生产 Origin） | 204 |
| GET /v1/compound?name=aspirin | **200**（3.64s，Cloudflare 出口→PubChem，未受本地 IP 限流影响） |
| └ 内容核验 | cid 2244 · C9H8O4 · MW 180.16 · 3D 21 原子/21 键 · IUPAC 2-acetyloxybenzoic acid（原子数与化学式吻合） |
| 坏 Origin | 403 |
| 非法 name | 400 |
| OPTIONS /v1/analyze 回归 | 204 |

原始响应见同目录 prod-aspirin-response.json。
