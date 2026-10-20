<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { SHEETS, renderSheetBody, togglePerkBox } from '../js/character.js';
import {
  newSpell, newAttack, newEnergyPool, newPerk, newEquipment,
  newTrait, newPurchase, newRecord, newReduction, newOwnedResource, api,
} from '../js/store.js';
import { character, appState, sheetState } from '../js/state.js';
import { useApp } from '../composables/useApp';
import { flash } from '../js/ui.js';

const body = ref(null);
const { go } = useApp();

// 当前活动表（默认 main），切换后原地重渲染 sheet 面板
const activeTab = ref(sheetState.active || 'main');

function reloadBody() {
  sheetState.active = activeTab.value;
  if (body.value) {
    body.value.innerHTML = '';
    renderSheetBody(body.value);
  }
}

function selectTab(id) {
  activeTab.value = id;
  reloadBody();
}

function back() {
  appState.activeChar = null;
  go('characters');
}

function confirmDeleteCharacter() {
  // 预留：后端 DELETE /api/characters/:id
  flash('已发送删除申请（骨架：后端接入后将从这里删除角色）');
  go('characters');
}
function saveCharacter() {
  const ok = api.save(character);
  flash(ok ? '✔ 角色卡已导出' : '✘ 导出失败');
}

// sheet 面板内部仍为原来（imperative 渲染）的 DOM：保留 data-action 委托给加行/删行/保存等。
function onDocClick(e) {
  const t = e.target;
  if (!t || !t.closest) return;
  const btn = t.closest('[data-action]');
  if (!btn) return;
  const act = btn.dataset.action;
  if (act === 'save') saveCharacter();
  else if (act === 'delete-character') confirmDeleteCharacter();
  else if (act === 'set-sheet') return; // 标签切换由 Vue 处理
  else if (act === 'add-spell') { character.spells.push(newSpell()); reloadBody(); }
  else if (act === 'add-attack') { character.specialAttacks.push(newAttack()); reloadBody(); }
  else if (act === 'add-energy') { character.energyPools.push(newEnergyPool()); reloadBody(); }
  else if (act === 'add-perk') { character.perks.push(newPerk()); reloadBody(); }
  else if (act === 'add-equip') { character.equipment.push(newEquipment()); reloadBody(); }
  else if (act === 'add-trait') { character.traits.push(newTrait()); reloadBody(); }
  else if (act === 'add-purchase') { character.resources.purchases.push(newPurchase()); reloadBody(); }
  else if (act === 'add-record') { character.resources.records.push(newRecord()); reloadBody(); }
  else if (act === 'add-reduction') { character.defense.reduction.push(newReduction()); reloadBody(); }
  else if (act === 'add-owned') { character.ownedResources.push(newOwnedResource()); reloadBody(); }
  else if (act === 'remove-reduction') { character.defense.reduction.splice(Number(btn.dataset.index), 1); reloadBody(); }
  else if (act === 'toggle-perk-box') togglePerkBox(btn);
  else if (act === 'del-row') deleteRow(btn.dataset.kind, Number(btn.dataset.index), btn.dataset.rowid);
}

function deleteRow(kind, index, rowId) {
  const byId = (arr) => (typeof rowId === 'string' && rowId ? arr.findIndex((x) => x.id === rowId) : index);
  if (kind === 'spell') character.spells.splice(byId(character.spells), 1);
  else if (kind === 'attack') character.specialAttacks.splice(byId(character.specialAttacks), 1);
  else if (kind === 'energy') character.energyPools.splice(byId(character.energyPools), 1);
  else if (kind === 'perk') character.perks.splice(index, 1);
  else if (kind === 'equip') character.equipment.splice(index, 1);
  else if (kind === 'trait') character.traits.splice(index, 1);
  else if (kind === 'purchase') character.resources.purchases.splice(index, 1);
  else if (kind === 'record') character.resources.records.splice(index, 1);
  else if (kind === 'owned') character.ownedResources.splice(index, 1);
  reloadBody();
}

onMounted(() => {
  reloadBody();
  document.addEventListener('click', onDocClick);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick);
});
</script>

<template>
  <div class="char-head">
    <header class="masthead">
      <h1>鲲版无限角色卡</h1>
      <p class="subtitle">目前正在测试中，仅用于UI展示</p>
    </header>
    <button type="button" class="char-back" @click="back">← 返回角色管理</button>
  </div>

  <!-- 标签栏（Vue 原生渲染） -->
  <nav class="sheet-tabs">
    <button
      v-for="s in SHEETS"
      :key="s.id"
      type="button"
      class="sheet-tab"
      :class="{ active: activeTab === s.id }"
      @click="selectTab(s.id)"
    >
      {{ s.label }}
    </button>
  </nav>

  <!-- 面板主体：复用原 renderSheetBody 渲染（UI/计算与旧一致） -->
  <div class="sheet-body" ref="body"></div>

  <div class="action-bar">
    <button type="button" class="btn action-button" @click="saveCharacter">导出角色卡</button>
    <button type="button" class="btn action-button btn-danger" @click="confirmDeleteCharacter">删除角色卡</button>
  </div>
</template>