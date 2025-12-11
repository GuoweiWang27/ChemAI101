import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // 从环境变量读取，支持本地 .env 和 Cloudflare 环境变量
    const env = loadEnv(mode, '.', '');
    const geminiApiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // 支持多种环境变量名称，优先使用 VITE_ 前缀（Vite 标准）
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiApiKey),
        'import.meta.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
        // 保持向后兼容
        'process.env.API_KEY': JSON.stringify(geminiApiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
