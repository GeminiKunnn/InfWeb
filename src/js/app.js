/**
 * app.js
 * -----------------------------------------------------------------------------
 * 渲染与交互层（entry）。
 *
 * 当前实现方式：原生 DOM 渲染 + 事件绑定。
 *
 * 未来迁移 Vue / 接后端时你只需要：
 *   1. 保留 character-config.js（字段定义）与 store.js（状态 + 持久化 / api）。
 *   2. 把本文件里「构建行 / 渲染表格 / 绑定事件」的 DOM 逻辑，
 *      改为 Vue 模板 + methods —— 其余代码基本可以原样复用。
 */

import {
  renderRulesPage, renderOtherPage, renderResourcesPage,
  renderRealmPage, renderChangelogPage, renderLandingPage, renderCharactersPage,
} from './pages.js';

import {
  newSpell,
  newAttack,
  newEnergyPool,
  newPerk,
  newEquipment,
  newTrait,
  newPurchase,
  newRecord,
  newReduction,
  newOwnedResource,
  api,
} from './store.js';
import { character, setCharacter, appState, sheetState } from './state.js';
import { el, flash } from './ui.js';
import { renderCharacterPage, togglePerkBox } from './character.js';
import { renderNewCharacterPage, openImportDialog, confirmLeaveNewCharacter, submitNewCharacter } from './new-character.js';

/* ----- 删除角色卡确认弹窗（暂不实现实际删除，将来向后端发送删除申请） ----- */
function confirmDeleteCharacter() {
  const existing = document.getElementById('delete-dialog');
  if (existing) existing.remove();

  const overlay = el('div', { class: 'modal-overlay', id: 'delete-dialog' });
  const box = el('div', { class: 'modal' });
  box.appendChild(el('h3', { text: '删除角色卡' }));
  box.appendChild(el('p', { class: 'muted', text: '是否确定要删除？' }));

  const btns = el('div', { class: 'modal-actions' });
  const cancel = el('button', { type: 'button', class: 'btn btn-ghost', text: '取消' });
  cancel.addEventListener('click', () => overlay.remove());
  const confirm = el('button', { type: 'button', class: 'btn btn-danger', text: '确定' });
  confirm.addEventListener('click', () => {
    // 预留：此处应向远端 DELETE /api/characters/:id 发送删除申请。当前仅提示并返回角色管理。
    overlay.remove();
    flash('已发送删除申请（骨架：后端接入后将从这里删除角色）');
    appState.page = 'characters';
    renderPage();
  });
  btns.appendChild(cancel);
  btns.appendChild(confirm);
  box.appendChild(btns);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

/** 根据 screen 决定是否显示侧边栏：主页面隐藏侧边栏，应用界面显示。 */
function toggleSidebarForScreen() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.classList.toggle('hidden', appState.screen === 'landing');
}

/* ------------------------- 应用级页面路由 ------------------------- */

function renderPage() {
  toggleSidebarForScreen();

  // 主页面：只显示 landing，不渲染应用内页面（也避免高亮菜单项）
  if (appState.screen === 'landing') {
    // 回到主界面即清除已保存的应用内位置，下次刷新仍为主界面
    try { localStorage.removeItem(APPSTATE_KEY); } catch (e) { /* 隐私模式等忽略 */ }
    renderLandingPage();
    return;
  }

  // 高亮左侧菜单（查看单个角色卡时高亮「角色管理」）
  const menuKey = appState.page === 'character' ? 'characters' : appState.page;
  document.querySelectorAll('.menu-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.page === menuKey);
  });

  if (appState.page === 'characters') renderCharactersPage();
  else if (appState.page === 'character') renderCharacterPage();
  else if (appState.page === 'new-character') renderNewCharacterPage();
  else if (appState.page === 'rules') renderRulesPage();
  else if (appState.page === 'resources') renderResourcesPage();
  else if (appState.page === 'changelog') renderChangelogPage();
  else if (appState.page === 'other') renderOtherPage();
  else if (appState.page === 'realm') renderRealmPage();

  // 记住当前应用内页面位置，供刷新后恢复（仅页面位置，不保存任何编辑数据）
  saveAppState();
}

/* -------- 应用状态持久化（仅记页面位置，不存数据） -------- */
const APPSTATE_KEY = 'infweb.appstate';
function saveAppState() {
  if (appState.screen !== 'app') return; // 仅在应用内记录
  try {
    localStorage.setItem(
      APPSTATE_KEY,
      JSON.stringify({ screen: appState.screen, page: appState.page, activeChar: appState.activeChar || null })
    );
  } catch (e) {
    /* 忽略（隐私模式等） */
  }
}
function restoreAppState() {
  try {
    const raw = localStorage.getItem(APPSTATE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.screen === 'app' ? s : null;
  } catch (e) {
    return null;
  }
}

/* ------------------------- 侧边栏折叠 / 交互 ------------------------- */

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

/* 用户下拉（顶部下方底部用户栏）：展开/收起 / 关闭 */
function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  if (menu) menu.hidden = !menu.hidden;
}
function closeUserMenu() {
  const menu = document.getElementById('user-menu');
  if (menu) menu.hidden = true;
}

/* ------------------------- 动态行：通用增删 ------------------------- */

function addSpellRow() {
  character.spells.push(newSpell());
  renderPage();
}
function addAttackRow() {
  character.specialAttacks.push(newAttack());
  renderPage();
}
function addEnergyRow() {
  character.energyPools.push(newEnergyPool());
  renderPage();
}
function addPerkRow() {
  character.perks.push(newPerk());
  renderPage();
}
function addEquipmentRow() {
  character.equipment.push(newEquipment());
  renderPage();
}
function addTraitRow() {
  character.traits.push(newTrait());
  renderPage();
}
function addPurchaseRow() {
  character.resources.purchases.push(newPurchase());
  renderPage();
}
function addRecordRow() {
  character.resources.records.push(newRecord());
  renderPage();
}
function addReductionRow() {
  character.defense.reduction.push(newReduction());
  renderPage();
}
function removeReductionRow(index) {
  character.defense.reduction.splice(index, 1);
  renderPage();
}

function deleteRow(kind, index, rowId) {
  // 有稳定 id 的列表按 id 找行（重排后仍精确命中）；其余按 index
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
  renderPage();
}

/* ------------------------- 全局事件绑定（事件委托） ------------------------- */

function setupGlobalEvent() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="toggle-sidebar"]')) {
      toggleSidebar();
      return;
    }

    // 品牌（顶部「无限流」）→ 回到主页面
    if (e.target.closest('[data-action="go-home"]')) {
      appState.screen = 'landing';
      closeUserMenu();
      renderPage();
      return;
    }

    // 主页面「进入」→ 进入应用界面（默认应用内页面为更新记录）
    if (e.target.closest('[data-action="enter-app"]')) {
      appState.screen = 'app';
      renderPage();
      return;
    }

    // 用户栏：展开/收起下拉
    if (e.target.closest('[data-action="toggle-user-menu"]')) {
      toggleUserMenu();
      return;
    }

    // 登出（当前仅界面：展示提示，不接入真实登录）
    if (e.target.closest('[data-action="logout"]')) {
      closeUserMenu();
      flash('已登出（当前为演示，未接入真实账户）');
      return;
    }

    // 点击其它区域时收起用户下拉
    if (document.querySelector('#user-menu') && !e.target.closest('.user-box')) {
      closeUserMenu();
    }

    const menuBtn = e.target.closest('.menu-item[data-page]');
    if (menuBtn) {
      appState.page = menuBtn.dataset.page;
      renderPage();
      return;
    }

    // 角色管理：点击某行 → 打开对应角色卡（占位，后续从后端取数据）
    const charRow = e.target.closest('.char-row');
    if (charRow) {
      appState.activeChar = charRow.dataset.charId;
      appState.page = 'character';
      renderPage();
      return;
    }

    // 新建角色：进入「新建角色」页
    if (e.target.closest('[data-action="new-character"]')) {
      appState.page = 'new-character';
      renderPage();
      return;
    }

    // 导入角色卡：打开导入弹窗
    if (e.target.closest('[data-action="open-import"]')) {
      openImportDialog();
      return;
    }

    // 新建角色页：确认返回（进度不保留）
    const cancelCreate = e.target.closest('[data-action="cancel-new-character"]');
    if (cancelCreate) {
      confirmLeaveNewCharacter(() => {
        appState.page = 'characters';
        renderPage();
      });
      return;
    }
    // 新建角色页：提交保存（预留后端）
    if (e.target.closest('[data-action="submit-new-character"]')) {
      submitNewCharacter();
      return;
    }

    // 角色详情页右上角「返回角色管理」
    if (e.target.closest('[data-action="back-to-characters"]')) {
      appState.activeChar = null;
      appState.page = 'characters';
      renderPage();
      return;
    }

    const tab = e.target.closest('[data-action="set-sheet"]');
    if (tab) {
      sheetState.active = tab.dataset.sheet;
      renderPage();
      return;
    }

    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const act = btn.dataset.action;
    if (act === 'save') {
      const ok = api.save(character);
      flash(ok ? '✔ 角色卡已导出' : '✘ 导出失败');
    } else if (act === 'delete-character') {
      confirmDeleteCharacter();
    } else if (act === 'add-spell') addSpellRow();
    else if (act === 'add-attack') addAttackRow();
    else if (act === 'add-energy') addEnergyRow();
    else if (act === 'add-perk') addPerkRow();
    else if (act === 'add-equip') addEquipmentRow();
    else if (act === 'add-trait') addTraitRow();
    else if (act === 'add-purchase') addPurchaseRow();
    else if (act === 'add-record') addRecordRow();
    else if (act === 'add-reduction') addReductionRow();
    else if (act === 'add-owned') character.ownedResources.push(newOwnedResource()), renderPage();
    else if (act === 'remove-reduction') removeReductionRow(Number(btn.dataset.index));
    else if (act === 'toggle-perk-box') togglePerkBox(btn);
    else if (act === 'del-row') deleteRow(btn.dataset.kind, Number(btn.dataset.index), btn.dataset.rowid);
  });
}

/* ------------------------- 启动 ------------------------- */

async function boot() {
  const saved = await api.load();
  if (saved) setCharacter(saved);

  // 若上次停留在应用界面（screen=app）则自动恢复该页面，否则进入主页面(landing)
  const restored = restoreAppState();
  if (restored) {
    appState.screen = 'app';
    appState.page = restored.page || 'changelog';
    appState.activeChar = restored.activeChar || null;
  } else {
    appState.screen = 'landing';
    appState.page = 'changelog';
  }
  renderPage();
  setupGlobalEvent();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
