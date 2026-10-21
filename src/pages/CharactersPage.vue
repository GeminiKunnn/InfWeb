<script setup>
import { placeholderCharacters } from '../js/pages.js';
import { openImportDialog } from '../js/new-character.js';
import { useApp } from '../composables/useApp';

const { go } = useApp();

const chars = placeholderCharacters();

function openRow(id) {
  go('character');
}
function newCharacter() {
  go('new-character');
}
function openImport() {
  openImportDialog();
}
</script>

<template>
  <header class="masthead">
    <h1>角色管理</h1>
    <p class="subtitle">选择要打开的角色卡，或新建一个角色</p>
  </header>

  <div class="char-grid">
    <button v-for="c in chars" :key="c.id" type="button" class="char-card" @click="openRow(c.id)">
      <span class="char-avatar">{{ c.name.slice(-1) }}</span>
      <span class="char-card-name">{{ c.name }}</span>
      <span class="char-card-desc">角色卡</span>

      <div class="char-card-stats">
        <div class="char-card-stat">
          <span class="char-card-k">总资源</span>
          <span class="char-card-v">{{ c.resource }}</span>
        </div>
        <div class="char-card-stat">
          <span class="char-card-k">生命值</span>
          <span class="char-card-v">{{ c.hp }}</span>
        </div>
        <div class="char-card-stat">
          <span class="char-card-k">归属房间</span>
          <span class="char-card-v">{{ c.room }}</span>
        </div>
      </div>

      <span class="char-open">点击查看 →</span>
    </button>
  </div>
  <div class="char-empty-note">（以上为占位数据仅作展示）</div>

  <!-- 右下角悬浮：导入 + 新建 -->
  <button type="button" class="fab fab-import" title="导入角色卡" aria-label="导入角色卡" @click="openImport">
    <span class="fab-import-icon">⬇</span>
  </button>
  <button type="button" class="fab" title="新建角色" aria-label="新建角色" @click="newCharacter">
    <span class="fab-plus">+</span>
  </button>
</template>