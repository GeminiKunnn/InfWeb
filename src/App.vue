<script setup>
import { computed } from 'vue';
import { useApp } from './composables/useApp';

import LandingPage from './pages/LandingPage.vue';
import ChangelogPage from './pages/ChangelogPage.vue';
import RulesPage from './pages/RulesPage.vue';
import CharactersPage from './pages/CharactersPage.vue';
import CharacterSheetView from './pages/CharacterSheetView.vue';
import NewCharacterView from './pages/NewCharacterView.vue';
import EmptyPage from './pages/EmptyPage.vue';

const { state, nav, enterApp, goHome, go, toggleSidebar, toggleUserMenu } = useApp();

// 应用内页面 → 组件映射（分批迁移：sheet / new-character 复用原有渲染管线）。
const pageComponents = {
  changelog: ChangelogPage,
  rules: RulesPage,
  resources: EmptyPage,
  realm: EmptyPage,
  other: EmptyPage,
  characters: CharactersPage,
  character: CharacterSheetView,
  'new-character': NewCharacterView,
};

const currentPage = computed(() => pageComponents[state.page] || EmptyPage);

const pageProps = computed(() => {
  switch (state.page) {
    case 'resources':
      return { title: '资源列表', note: '资源列表页面预留，后续展示后端资源目录（各资源的 bonus 与描述）。' };
    case 'realm':
      return { title: '轮回之境', note: '轮回之境页面预留，后续开发：游戏组 / 房间 / 多单位施效等。' };
    case 'other':
      return { title: '其他', note: '预留页面，暂无内容。' };
    default:
      return {};
  }
});
</script>

<template>
  <!-- 主页面（landing）：隐藏侧边栏，仅欢迎页 -->
  <div v-if="state.screen === 'landing'" class="landing-screen">
    <LandingPage @enter="enterApp" />
  </div>

  <!-- 应用界面：左侧侧边栏 + 右侧内容区 -->
  <div v-else class="layout">
    <aside class="sidebar" :class="{ collapsed: state.sidebarCollapsed }" id="sidebar">
      <!-- 折叠 / 展开 -->
      <button type="button" class="collapse-btn" aria-label="折叠或展开菜单" title="折叠 / 展开" @click="toggleSidebar">
        <span class="collapse-icon">☰</span>
      </button>

      <!-- 品牌 -->
      <button type="button" class="brand" title="回到首页" @click="goHome">
        <span class="brand-mark">∞</span>
        <span class="brand-text">无限流</span>
      </button>

      <!-- 菜单 -->
      <nav class="menu" id="menu">
        <button
          v-for="item in nav"
          :key="item.page"
          type="button"
          class="menu-item"
          :class="{ active: state.page === item.page }"
          @click="go(item.page)"
        >
          <span class="menu-icon">{{ item.icon }}</span>
          <span class="menu-text">{{ item.text }}</span>
        </button>
      </nav>

      <!-- 用户信息 -->
      <div class="user-box" id="user-box">
        <button type="button" class="user-trigger" title="账户" @click="toggleUserMenu">
          <span class="user-name" id="user-name">未登录</span>
          <span class="user-caret">▲</span>
        </button>
        <div class="user-menu" id="user-menu" :hidden="!state.userMenuOpen">
          <button type="button" class="user-menu-item">
            <span class="user-menu-icon">⎋</span>
            <span>登出</span>
          </button>
          <div class="user-menu-sep"></div>
          <div class="user-menu-ver">v0.1.0</div>
        </div>
      </div>
    </aside>

    <main class="content" id="content">
      <component :is="currentPage" v-bind="pageProps" />
    </main>
  </div>
</template>