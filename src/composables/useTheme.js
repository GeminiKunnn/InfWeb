/**
 * src/composables/useTheme.js
 * 主题切换：dark / light。
 * - 通过 <html data-theme="..."> 驱动 CSS 变量覆盖（见 style.css 的 :root[data-theme='light']）。
 * - 持久化到 localStorage；未显式选择时跟随系统偏好。
 */
import { reactive, readonly } from 'vue';

const STORAGE_KEY = 'infweb.theme';

function systemPrefersDark() {
  try {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch (e) {
    return true;
  }
}

const state = reactive({
  theme: 'dark',
});

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
}

function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    /* 忽略：无 localStorage 时走默认 */
  }
  const theme = saved === 'light' || saved === 'dark' ? saved : (systemPrefersDark() ? 'dark' : 'light');
  applyTheme(theme);
}

function toggleTheme() {
  const next = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch (e) {
    /* 忽略 */
  }
}

export function useTheme() {
  return {
    state: readonly(state),
    initTheme,
    toggleTheme,
  };
}
