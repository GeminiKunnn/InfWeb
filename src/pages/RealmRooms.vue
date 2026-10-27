<script setup>
// 轮回之境 · 房间列表（首屏，类似角色管理）。点某房间 → 进入对应战斗界面。
import { useApp } from '../composables/useApp';

const { go } = useApp();

const rooms = [
  { id: 'r1', name: '苏醒的兽群', desc: '地下迷宫 · 遭遇战 1/3', players: '5/5', mode: '进行中', running: true },
  { id: 'r2', name: '教堂深渊', desc: '主线 · 圣光教会地宫', players: '3/5', mode: '等待', running: false },
  { id: 'r3', name: '雾之湖', desc: '支线 · 幽雾与巨兽', players: '4/5', mode: '进行中', running: true },
  { id: 'r4', name: '熔火王座', desc: '团战预演 · S级警戒', players: '0/5', mode: '等待', running: false },
  { id: 'r5', name: '寂静列车', desc: '支线 · 无人生还', players: '2/5', mode: '等待', running: false },
  { id: 'r6', name: '新房间', desc: '空的战斗房间，等待创建遭遇', players: '—', mode: '空房间', running: false },
];

function openRoom() {
  go('realm-combat');
}
</script>

<template>
  <header class="masthead">
    <h1>轮回之境 · 房间</h1>
    <p class="subtitle">选择一个房间进入战斗，或创建新的房间</p>
  </header>

  <div class="char-grid realm-rooms-grid">
    <button
      v-for="r in rooms"
      :key="r.id"
      type="button"
      class="char-card realm-room-card"
      :class="{ 'realm-room-running': r.running }"
      @click="openRoom"
    >
      <span v-if="r.running" class="realm-room-badge">进行中</span>
      <span class="char-avatar">{{ r.name.slice(0, 1) }}</span>
      <span class="char-card-name">{{ r.name }}</span>
      <span class="char-card-desc">{{ r.mode }}</span>

      <div class="char-card-stats">
        <div class="char-card-stat">
          <span class="char-card-k">人数</span>
          <span class="char-card-v">{{ r.players }}</span>
        </div>
        <div class="char-card-stat">
          <span class="char-card-k">简述</span>
          <span class="char-card-v">{{ r.desc }}</span>
        </div>
      </div>

      <span class="char-open">进入房间 →</span>
    </button>
  </div>
  <div class="char-empty-note">（占位数据，仅作展示；点击房间进入战斗界面）</div>

  <button type="button" class="fab" title="新建房间" aria-label="新建房间">
    <span class="fab-plus">+</span>
  </button>
</template>