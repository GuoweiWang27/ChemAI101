# ChemAI101

AI-assisted chemistry visualization for classroom demos: reaction prediction,
molecule building, IUPAC naming, and a PubChem-backed 3D molecule library.
Built as a showcase product of Guowei Wang's chemistry club; the club's
chemistry teacher uses it for reaction demos in class.

## Architecture

```
Browser (Cloudflare Pages: chemai101.guoweiwang.com)
  └─ Cloudflare Worker: chemai101-api
       ├─ /v1/analyze   → DeepSeek API (deepseek-v4-flash): reaction prediction & naming,
       │                   with deterministic chemistry verification (valence, connectivity,
       │                   heavy-atom composition vs SMILES) attached to every result
       └─ /v1/compound  → PubChem PUG REST: authoritative 2D/3D structures, formula & MW
                           (cached 24h, retried once on ServerBusy, no API key required)
```

The browser never holds an AI provider key. The Worker injects
`DEEPSEEK_API_KEY` from its Secret binding and enforces origin allowlisting,
request size caps, per-IP rate limiting, and JSON error responses that never
leak upstream bodies.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

The local frontend uses the production Worker by default. Override only the
non-secret base URL with `VITE_CHEMAI_API_BASE` when testing another Worker.

## Verify

```bash
npm test
npx tsc --noEmit
npm run build
npm run worker:check
```

## Deploy the Worker

The Worker source of truth is `worker/src/index.ts`; `wrangler.jsonc` declares
the non-secret DeepSeek upstream URL, model, rate limiter, observability, and the
required `DEEPSEEK_API_KEY` Secret binding.

```bash
npx wrangler secret put DEEPSEEK_API_KEY
npm run worker:deploy
```

Never place the provider key in `.env.local`, Cloudflare Pages build variables,
Vite variables, source files, or Git history.
