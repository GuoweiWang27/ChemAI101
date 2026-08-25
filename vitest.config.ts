import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          VECTORENGINE_API_KEY: 'test-only-secret',
        },
      },
    }),
  ],
  test: {
    include: ['worker/test/**/*.test.ts', 'services/**/*.test.ts', 'utils/**/*.test.ts'],
  },
});
