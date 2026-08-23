# Cloudflare Pages + Worker 部署配置

## 架构

- 前端：Cloudflare Pages 项目 `chemai101`
- 正式域名：`https://chemai101.guoweiwang.com/`
- API 代理：Worker `chemai101-api`
- 上游：VectorEngine OpenAI-compatible API，模型 `gemini-2.5-flash`

浏览器只向 Worker 发送业务参数；Worker 在服务端补上
`VECTORENGINE_API_KEY` Secret binding。任何 Vite / Pages 构建变量都不得
保存供应商 key。

## 首次部署或换 key

在仓库根目录执行：

```bash
npm install
npm test
npm run worker:check
npx wrangler secret put VECTORENGINE_API_KEY
npm run worker:deploy
```

`wrangler secret put` 会交互读取密钥，密钥不会写入源码或配置文件。

## 前端发布

Cloudflare Pages 从 GitHub `GuoweiWang27/ChemAI101` 的 `main` 分支构建。
前端默认访问：

`https://chemai101-api.guoweiwang27.workers.dev/v1/analyze`

如需临时指向另一套非敏感代理地址，只设置
`VITE_CHEMAI_API_URL`。不要设置 `GEMINI_API_KEY`、
`VITE_GEMINI_API_KEY`、`VECTORENGINE_API_KEY` 或
`VITE_VECTORENGINE_API_KEY`。

## 安全验证

```bash
npm run build
rg -n "api\\.vectorengine\\.ai|Authorization.{0,40}Bearer|sk-[A-Za-z0-9._-]{8,}" dist
```

预期无匹配。Worker 限制允许来源、请求体大小与每分钟调用次数；错误响应
不会回传上游正文。

## 轮换说明

当前线上 key 是 VectorEngine 的 `sk-` key，不是 Google AI Studio key。
轮换必须在持有该 VectorEngine 账号的一侧创建新 key，更新 Worker Secret，
验证成功后再吊销旧 key。
