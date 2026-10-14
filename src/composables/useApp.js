/**
 * src/composables/useApp.js
 * Vue 版应用级路由/导航状态，承接原 state.js 的 appState 语义。
 * screen: 'landing' | 'app'；page: 'changelog'|'rules'|'resources'|'characters'|'realm'|'other'|...
 * 并发式（reactive）以便 Vue 组件随 state 响应式切换。
 */
import { reactive, readonly } from 'vue';

const NAV = [
  { page: 'changelog', icon: '📝', text: '更新记录' },
  { page: 'rules', icon: '📖', text: '规则书' },
  { page: 'resources', icon: '🗂️', text: '资源列表' },
  { page: 'characters', icon: '🧾', text: '角色管理' },
  { page: 'realm', icon: '🌀', text: '轮回之境' },
  { page: 'other', icon: '➕', text: '其他' },
];

const state = reactive({
  screen: 'landing', // 主页面 / 应用
  page: 'changelog',
  activeChar: null,
  sidebarCollapsed: false,
  userMenuOpen: false,
});

function enterApp() {
  state.screen = 'app';
}
function goHome() {
  state.screen = 'landing';
}
function go(menu) {
  state.screen = 'app';
  state.page = menu;
}
function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
}
function toggleUserMenu() {
  state.userMenuOpen = !state.userMenuOpen;
}
function setActiveChar(id) {
  state.activeChar = id;
}
function setScreen(screen) {
  state.screen = screen;
}

export function useApp() {
  return {
    state: readonly(state),
    nav: NAV,
    enterApp,
    goHome,
    go,
    toggleSidebar,
    toggleUserMenu,
    setActiveChar,
    setScreen,
  };
}