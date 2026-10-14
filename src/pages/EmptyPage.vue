<script setup>
// 通用空页面骨架（其他 / 资源列表 / 轮回之境 共用）
defineProps({
  title: { type: String, default: '' },
  note: { type: String, default: '' },
});
</script>

<template>
  <div class="blank-page">
    <h2>{{ title }}</h2>
    <p class="muted">{{ note }}</p>
  </div>
</template>