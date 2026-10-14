<script setup>
import { onMounted, ref } from 'vue';
import renderRulesPage from '../js/rules.js';

const host = ref(null);

onMounted(async () => {
  if (host.value) {
    await renderRulesPage({ host: host.value });
  }
});
</script>

<template>
  <!-- 复用原 rules.js 的整页渲染，原样保持 UI 与交互 -->
  <div ref="host"></div>
</template>