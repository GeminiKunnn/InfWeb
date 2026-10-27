import { createApp } from 'vue';
import App from './App.vue';
import './css/style.css';
import './css/realm.css';
import { api } from './js/store.js';
import { setCharacter } from './js/state.js';
import { useApp } from './composables/useApp';
import { useTheme } from './composables/useTheme';

// 尽早应用主题（在挂载前写 <html data-theme>，避免首屏闪烁）。
useTheme().initTheme();

// 异步启动：镜像原 app.js boot() 的数据准备（读取已保存角色）。
async function bootstrap() {
  try {
    const saved = await api.load();
    if (saved) setCharacter(saved);
  } catch (e) {
    /* 忽略：无存档时用空角色 */
  }

  // 刷新后停留原页面：本会话（同一标签页）内记录的应用内页面走 sessionStorage 恢复；
  // 全新打开 / 新标签页没有该记录，仍默认展示主页面（landing）。
  // 同时清掉旧版本遗留在 localStorage 的 infweb.appstate，杜绝「打开直达历史子页面」。
  try {
    localStorage.removeItem('infweb.appstate'); // 旧版残留，见 App.vue 路由说明
    const raw = sessionStorage.getItem('infweb.app.page');
    if (raw) {
      const { go } = useApp();
      go(raw);
    }
  } catch (e) {
    /* 忽略（隐私模式等） */
  }

  // Vue3 根挂载点：接管 src/index.html 中的 #app 容器。
  createApp(App).mount('#app');
}

bootstrap();