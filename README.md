<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy ChemAI Pro

The browser application calls a Cloudflare Worker proxy. No AI provider key is
required or permitted in the Vite build.

View your app in AI Studio: https://ai.studio/apps/drive/19Kw0VNvpvSmAbiD6LngVyCeBdMmEa-OV

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

The local frontend uses the production Worker by default. Override only the
non-secret endpoint with `VITE_CHEMAI_API_URL` when testing another Worker.

## Verify

```bash
npm test
npx tsc --noEmit
npm run build
npm run worker:check
```

## Deploy the Worker

The Worker source of truth is `worker/src/index.ts`; `wrangler.jsonc` declares
the non-secret upstream URL, model, rate limiter, observability, and the required
`VECTORENGINE_API_KEY` Secret binding.

```bash
npx wrangler secret put VECTORENGINE_API_KEY
npm run worker:deploy
```

Never place the provider key in `.env.local`, Cloudflare Pages build variables,
Vite variables, source files, or Git history.
