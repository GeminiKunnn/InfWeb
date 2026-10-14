import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Vitest 配置：纯逻辑层测试用 node 环境（无需 jsdom），走与 Vite 相同的 @ 别名。
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['test/*.vitest.js'],
  },
});