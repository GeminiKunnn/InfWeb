<script setup>
import { placeholderCharacters } from '../js/pages.js';
import { useApp } from '../composables/useApp';

const { go } = useApp();

const chars = placeholderCharacters();

function openRow(id) {
  go('character');
}
function newCharacter() {
  go('new-character');
}
</script>

<template>
  <header class="masthead">
    <h1>角色管理</h1>
    <p class="subtitle">选择要打开的角色卡，或新建一个角色</p>
  </header>

  <div class="char-list">
    <button v-for="c in chars" :key="c.id" type="button" class="char-row" @click="openRow(c.id)">
      <span class="char-name">{{ c.name }}</span>
      <div class="char-meta">
        <span class="char-kv">
          <em class="char-kv-label">总资源</em>
          <span class="char-resource">{{ c.resource }}</span>
        </span>
        <span class="char-kv">
          <em class="char-kv-label">生命值</em>
          <span class="char-hp">{{ c.hp }}</span>
        </span>
        <span class="char-kv">
          <em class="char-kv-label">归属房间</em>
          <span class="char-room">{{ c.room }}</span>
        </span>
      </div>
      <span class="char-open">点击查看</span>
    </button>
  </div>
  <div class="char-empty-note">（以上为占位数据仅作展示）</div>

  <!-- 右下角悬浮：导入 + 新建 -->
  <button type="button" class="fab fab-import" title="导入角色卡" aria-label="导入角色卡">
    <span class="fab-import-icon">⬇</span>
  </button>
  <button type="button" class="fab" title="新建角色" aria-label="新建角色" @click="newCharacter">
    <span class="fab-plus">+</span>
  </button>
</template>