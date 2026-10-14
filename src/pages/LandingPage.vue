<script setup>
// 主页面（landing）—— 入口欢迎页。进入按钮 → enterApp
import { useApp } from '../composables/useApp';
const { enterApp } = useApp();
</script>

<template>
  <div class="landing">
    <div class="landing-hero">
      <div class="landing-mark"><span>∞</span></div>
      <h1 class="landing-title">鲲版无限网页角色卡</h1>
      <p class="landing-sub">角色 · 资源 一站式管理</p>
      <button type="button" class="landing-enter" @click="enterApp">
        <span>进入</span><span class="landing-enter-arrow"> →</span>
      </button>
      <p class="landing-hint">点击进入开始使用角色卡</p>
    </div>
  </div>
</template>