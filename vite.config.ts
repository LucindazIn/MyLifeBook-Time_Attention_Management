/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  // 使用代理时不在前端注入 Key，避免暴露
  const injectKey = !env.VITE_GEMINI_PROXY_URL;
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': injectKey ? JSON.stringify(env.GEMINI_API_KEY) : 'undefined',
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // 开发时若设置 VITE_GEMINI_PROXY_URL=/api/gemini，将 /api 转发到本地代理服务（Key 不进入前端）
      ...(env.VITE_GEMINI_PROXY_URL?.startsWith('/')
        ? {
            proxy: {
              '/api/gemini': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/gemini/, ''),
              },
            },
          }
        : {}),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
