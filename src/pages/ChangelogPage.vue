<script setup>
import { onMounted, ref } from 'vue';
import {
  assetPath,
  schemaifyChangelogContent,
  fmtDate,
} from '../js/pages.js';

const entries = ref([]);
const errorMsg = ref('');
const loading = ref(true);

// 复用原 pages.js 的纯函数（与旧测试同一数据源）。
function schemaify(c) {
  return schemaifyChangelogContent(c);
}
function dateText(d) {
  return fmtDate(d);
}
async function load() {
  loading.value = true;
  errorMsg.value = '';
  try {
    const res = await fetch(assetPath('content/updates/changelog.json') + '?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    entries.value = await res.json();
  } catch (err) {
    errorMsg.value = err.message;
    entries.value = [];
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>

<template>
  <header class="masthead">
    <h1>更新记录</h1>
    <p class="subtitle">版本与功能更新一览</p>
  </header>

  <div class="changelog-list">
    <div v-if="loading" class="changelog-loading"><span class="muted">加载中…</span></div>
    <div v-else-if="errorMsg" class="changelog-error">
      <span class="muted">更新记录加载失败：{{ errorMsg }}</span>
    </div>

    <p v-else-if="!entries.length" class="muted">暂无更新记录。</p>

    <template v-else>
      <!-- 倒序遍历：最新在上 -->
      <div v-for="(e, idx) in [...entries].reverse()" :key="'c' + idx" class="changelog-item">
        <div class="changelog-head">
          <span class="changelog-title">{{ e.title || '' }}</span>
          <span class="changelog-date">{{ dateText(e.date) }}</span>
        </div>
        <div class="changelog-content">
          <p
            v-for="(seg, si) in schemaify(e.content)"
            v-show="String(seg).trim() !== ''"
            :key="'s' + si"
            class="changelog-paragraph"
          >
            {{ String(seg).trim() }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>