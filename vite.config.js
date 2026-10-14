import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { cpSync, mkdirSync, existsSync } from 'node:fs';

// 把运行时按 URL 拉取的静态内容（规则书 .md / changelog.json）复制进 dist/content/**。
function copyContentPlugin() {
  return {
    name: 'copy-infweb-content',
    closeBundle() {
      const src = fileURLToPath(new URL('./src/content', import.meta.url));
      const dest = fileURLToPath(new URL('./dist/content', import.meta.url));
      if (!existsSync(src)) return;
      mkdirSync(dest, { recursive: true });
      cpSync(src, dest, { recursive: true });
    },
  };
}

// InfWeb Vue3 迁移 —— Vite 配置
// 根目录为 src/，以 src/index.html 为入口模板；dist 输出到 dist/ 供 GitHub Pages 部署。
export default defineConfig({
  root: 'src',
  base: './', // 相对路径，保证 gh-pages 子路径部署可用
  plugins: [vue(), copyContentPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});