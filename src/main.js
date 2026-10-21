import { createApp } from 'vue';
import App from './App.vue';
import './css/style.css';
import { api } from './js/store.js';
import { setCharacter } from './js/state.js';
import { useApp } from './composables/useApp';
import { useTheme } from './composables/useTheme';

// 尽早应用主题（在挂载前写 <html data-theme>，避免首屏闪烁）。
useTheme().initTheme();

// 异步启动：镜像原 app.js boot() 的数据准备（读取已保存角色 + 恢复上次页面）。
async function bootstrap() {
  try {
    const saved = await api.load();
    if (saved) setCharacter(saved);
  } catch (e) {
    /* 忽略：无存档时用空角色 */
  }

  // 恢复上次停留的应用内页面（仅位置，不保存编辑数据）；失败则回到主页面。
  try {
    const raw = localStorage.getItem('infweb.appstate');
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.screen === 'app') {
        const { go, setActiveChar } = useApp();
        go(s.page || 'changelog');
        if (s.activeChar) setActiveChar(s.activeChar);
      }
    }
  } catch (e) {
    /* 忽略 */
  }

  // Vue3 根挂载点：接管 src/index.html 中的 #app 容器。
  createApp(App).mount('#app');
}

bootstrap();