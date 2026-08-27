import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const KIB = 1024;

function enforceBundleBudgets(): Plugin {
  return {
    name: 'enforce-bundle-budgets',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        const budgetKib = output.isEntry ? 500 : 1000;
        const sizeKib = Buffer.byteLength(output.code, 'utf8') / KIB;
        if (sizeKib > budgetKib) {
          throw new Error(
            `${output.fileName} is ${sizeKib.toFixed(1)} KiB; budget is ${budgetKib} KiB`,
          );
        }
      }
    },
  };
}

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react(), enforceBundleBudgets()],
  build: {
    // Three.js is isolated behind route-level lazy loading; keep the initial entry under 500 KiB.
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
