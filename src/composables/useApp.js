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

// 本次会话（标签页生命周期内）记住当前应用内页面，供刷新后留在原页。
// 用 sessionStorage 而非 localStorage：刷新仍可恢复，而新开标签页/全新会话
// 没有该记录，会回到主页面，避免「打开即直入历史子页面」的问题。
const SESSION_PAGE_KEY = 'infweb.app.page';
function saveCurrentPage() {
  try {
    sessionStorage.setItem(SESSION_PAGE_KEY, state.page);
  } catch (e) {
    /* 忽略（隐私模式等） */
  }
}

function enterApp() {
  state.screen = 'app';
  saveCurrentPage();
}
function goHome() {
  state.screen = 'landing';
  // 回到主页即清空会话记录，避免刷新回退到之前所在页面
  try {
    sessionStorage.removeItem(SESSION_PAGE_KEY);
  } catch (e) {
    /* 忽略 */
  }
}
function go(menu) {
  state.screen = 'app';
  state.page = menu;
  saveCurrentPage();
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