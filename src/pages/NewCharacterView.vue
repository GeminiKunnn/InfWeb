<script setup>
import { onMounted, ref } from 'vue';
import { renderNewCharacterPage, confirmLeaveNewCharacter, submitNewCharacter, openImportDialog } from '../js/new-character.js';
import { appState } from '../js/state.js';
import { useApp } from '../composables/useApp';

const host = ref(null);
const { go } = useApp();

function reload() {
  if (host.value) renderNewCharacterPage({ host: host.value });
}

// 新建角色向导内容区 data-action 委托（来自原 app.js setupGlobalEvent 的向导部分）
function onDocClick(e) {
  const t = e.target;
  if (!t || !t.closest) return;

  if (t.closest('[data-action="open-import"]')) {
    openImportDialog();
    return;
  }
  const cancel = t.closest('[data-action="cancel-new-character"]');
  if (cancel) {
    confirmLeaveNewCharacter(() => {
      appState.page = 'characters';
      go('characters');
    });
    return;
  }
  if (t.closest('[data-action="submit-new-character"]')) {
    submitNewCharacter();
    return;
  }
}

onMounted(() => {
  reload();
  document.addEventListener('click', onDocClick);
});
</script>

<template>
  <div ref="host"></div>
</template>