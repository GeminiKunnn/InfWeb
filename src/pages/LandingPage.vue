<script setup>
// 主页面（landing）—— 入口欢迎页。进入按钮 → enterApp
import { computed } from 'vue';
import { useApp } from '../composables/useApp';
import { useTheme } from '../composables/useTheme';

const { enterApp } = useApp();
const { state: themeState, toggleTheme } = useTheme();

const isLight = computed(() => themeState.theme === 'light');
const themeToggleTitle = computed(() => (isLight.value ? '切换到深色主题' : '切换到浅色主题'));
</script>

<template>
  <div class="landing">
    <button type="button" class="landing-theme" :title="themeToggleTitle" @click="toggleTheme">
      <span class="landing-theme-icon">{{ isLight ? '🌙' : '☀️' }}</span>
    </button>
    <div class="landing-hero">
      <div class="landing-mark"><span>∞</span></div>
      <p class="landing-eyebrow">KUN · INFINITE WORLDS</p>
      <h1 class="landing-title">鲲版无限网页角色卡</h1>
      <p class="landing-sub">角色 · 资源 一站式管理</p>

      <ul class="landing-features">
        <li class="landing-feature"><span class="landing-feature-icon">📖</span><span class="landing-feature-text">规则书</span></li>
        <li class="landing-feature"><span class="landing-feature-icon">🧾</span><span class="landing-feature-text">角色卡</span></li>
        <li class="landing-feature"><span class="landing-feature-icon">🗂️</span><span class="landing-feature-text">资源</span></li>
        <li class="landing-feature"><span class="landing-feature-icon">🌀</span><span class="landing-feature-text">轮回之境</span></li>
      </ul>

      <button type="button" class="landing-enter" @click="enterApp">
        <span>进入应用</span><span class="landing-enter-arrow"> →</span>
      </button>
      <p class="landing-hint">点击进入开始使用角色卡</p>
    </div>
  </div>
</template>