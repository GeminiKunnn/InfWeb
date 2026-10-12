/**
 * new-character.js
 * -----------------------------------------------------------------------------
 * 「新建角色（快速创建角色卡流程）」独立模块。
 *
 * 从 app.js 抽取的快速创建角色卡 wizard：概念段 / 属性段 / 技能段 / 专长段，
 * 以及校验、提交、返回确认、导入角色卡弹窗等附属交互。
 *
 * 本模块依赖 app.js 暴露的 renderPage（仅在返回确认弹窗确认后重路由使用），
 * 二者为运行期使用的循环引用（均不在模块求值期调用，ESM live binding 安全）。
 */

import { ATTRIBUTES, SKILLS, GROUPS } from './character-config.js';
import { el, numberInput, textInput, textarea, select, section, flash } from './ui.js';

/* ------------------------- 新建角色（快速创建角色卡流程） ------------------------- */

// 新建角色状态：按「快速创建角色卡」的 概念段/属性段/技能段/专长段 组织（后端就绪前为占位数据）。
const newChar = {
  concept: { name: '', gender: '', race: '', age: '', build: '', appearance: '', background: '' },
  // 三大类定向点数分配：属性用 5/4/3、技能用 6/5/4，互斥（切换一个会联动其余两个）
  attrBudget: { 生理: 5, 心智: 4, 互动: 3 },
  attributes: Object.fromEntries(ATTRIBUTES.map((a) => [a.id, a.default])), // 默认 2
  skillBudget: { 生理: 6, 心智: 5, 互动: 4 },
  skills: Object.fromEntries(SKILLS.map((s) => [s.id, s.default])), // 默认 0
  freeSkillPoints: 5,
  perkPoints: 15,
  perks: [], // { name, level } 占位
};

// 定向点数互斥分配：把某大类的点数设为 v，其余两类自动补上剩余值（保持各自已有值优先）。
function assignBudget(kind, group, values, v) {
  const budget = kind === 'attribute' ? newChar.attrBudget : newChar.skillBudget;
  budget[group] = v;
  const rest = values.filter((n) => n !== v);
  const pool = rest.slice();
  const keep = {};
  GROUPS.filter((g) => g !== group).forEach((g) => {
    const cur = budget[g];
    if (pool.includes(cur)) {
      keep[g] = cur;
      pool.splice(pool.indexOf(cur), 1);
    }
  });
  GROUPS.filter((g) => g !== group).forEach((g) => {
    if (keep[g] == null) keep[g] = pool.shift();
    budget[g] = keep[g];
  });
}
function assignAttrBudget(group, v) {
  assignBudget('attribute', group, [3, 4, 5], v);
}
function assignSkillBudget(group, v) {
  assignBudget('skill', group, [6, 5, 4], v);
}

// 属性从基础 2 升至值 V 的累计点数（4→5 需 2 点，上限 6）
function attrCost(V) {
  if (V <= 2) return 0;
  if (V === 3) return 1;
  if (V === 4) return 2;
  if (V === 5) return 4;
  return 7; // 6
}
// 技能从 0 升至 V 的累计点数（3→4 需 2 点，建卡不可到 5 级规则上限用 5 兜底）
function skillCost(V) {
  if (V <= 0) return 0;
  if (V === 1) return 1;
  if (V === 2) return 2;
  if (V === 3) return 3;
  return 5; // 4（3→4）+2 = 5 → 值 4；升至 5 视作 2 点（建卡规则内不可，留上限）
}

function newCharAttrGroupCount(group) {
  return ATTRIBUTES.filter((a) => a.group === group).reduce((s, a) => s + attrCost(newChar.attributes[a.id] || 2), 0);
}
function newCharSkillGroupCount(group) {
  return SKILLS.filter((s) => s.group === group).reduce((s, sk) => s + skillCost(newChar.skills[sk.id] || 0), 0);
}

function renderNewCharacterPage() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  app.appendChild(
    el('div', { class: 'char-head' }, [
      el('header', { class: 'masthead' }, [
        el('h1', { text: '新建角色' }),
        el('p', { class: 'subtitle', text: '按「快速创建角色卡」流程依次填写以下内容' }),
      ]),
      el('button', {
        type: 'button',
        class: 'char-back',
        dataset: { action: 'cancel-new-character' },
        text: '← 返回',
      }),
    ])
  );

  const body = el('div', { class: 'newchar-body' });

  // ---- 1. 概念段 ----
  body.appendChild(section('1. 概念段', renderNewCharConcept()));

  // ---- 2. 属性段 ----
  const attrNote = '九个属性默认 2；生理/心智/互动分别分配 5/4/3 点定向属性点（4→5 需 2 点，建卡上限 6）。';
  body.appendChild(section('2. 属性段', renderNewCharAllocator('attribute', attrNote)));

  // ---- 3. 技能段 ----
  const skillNote = '技能默认 0；生理/心智/互动分别分配 6/5/4 点定向技能点，另有 5 点自由技能点（3→4 需 2 点，建卡上限 5）。';
  body.appendChild(section('3. 技能段', renderNewCharAllocator('skill', skillNote)));

  // ---- 4. 专长段 ----
  body.appendChild(section('4. 专长段', renderNewCharPerks()));

  app.appendChild(body);

  // ---- 提交栏：所有内容填写后才允许提交 ----
  const bar = el('div', { class: 'action-bar newchar-submit' });
  const submit = el('button', {
    type: 'button',
    class: 'btn btn-primary',
    dataset: { action: 'submit-new-character' },
    text: '提交保存',
  });
  submit.disabled = true;
  submit.id = 'newchar-submit';
  bar.appendChild(submit);
  bar.appendChild(el('span', { class: 'newchar-hint', id: 'newchar-hint', text: '请完整填写所需内容' }));
  app.appendChild(bar);

  refreshNewCharValidation();
}

/* ----- 概念段 ----- */
function renderNewCharConcept() {
  const c = newChar.concept;
  const wrap = el('div', { class: 'concept-grid' });

  const field = (label, input, cls = '') => {
    const cell = el('label', { class: 'concept-field' + (cls ? ' ' + cls : '') });
    cell.appendChild(el('span', { class: 'field-label', text: label }));
    cell.appendChild(input);
    return cell;
  };

  wrap.appendChild(field('姓名 *', textInput({ value: c.name, placeholder: '角色名称', onChange: (v) => { c.name = v; refreshNewCharValidation(); } })));
  wrap.appendChild(field('性别 *', textInput({ value: c.gender, placeholder: '男 / 女 / …', onChange: (v) => { c.gender = v; refreshNewCharValidation(); } })));
  wrap.appendChild(field('种族（来源世界观） *', textInput({ value: c.race, placeholder: '人形种族', onChange: (v) => { c.race = v; refreshNewCharValidation(); } })));
  wrap.appendChild(field('年龄', textInput({ value: c.age, placeholder: '岁', onChange: (v) => { c.age = v; refreshNewCharValidation(); } })));
  wrap.appendChild(field('身高体重', textInput({ value: c.build, placeholder: '如 178cm / 70kg', onChange: (v) => { c.build = v; refreshNewCharValidation(); } })));
  wrap.appendChild(field('性格简介 *', textarea({ value: c.appearance, placeholder: '人设性格、外貌气质等', onChange: (v) => { c.appearance = v; refreshNewCharValidation(); } }), 'span-3'));
  wrap.appendChild(field('背景简介 *', textarea({ value: c.background, placeholder: '大致背景概述', onChange: (v) => { c.background = v; refreshNewCharValidation(); } }), 'span-3'));

  return wrap;
}

/* ----- 属性 / 技能 分配器 -----
 * kind: 'attribute' | 'skill'；按 生理/心智/互动 三大类分区，每区一个定向点数下拉 + 各条目步进器。
 * 实时计算「已用 / 可用」并做预算校验，超支即高亮并禁用提交。
 */
function renderNewCharAllocator(kind, note) {
  const outer = el('div', { class: 'allocator' });
  outer.appendChild(el('p', { class: 'rule-note', text: note }));

  GROUPS.forEach((group) => {
    const block = el('div', { class: 'allocation-group' });

    const head = el('div', { class: 'alloc-head' });
    head.appendChild(el('span', { class: 'alloc-group-title', text: group + '系' }));

    // 定向点数（属性 3/4/5，技能 6/5/4，互斥：改一个大类会联动其余两类）
    const isAttr = kind === 'attribute';
    const budget = isAttr ? newChar.attrBudget[group] : newChar.skillBudget[group];
    const pool = isAttr ? [3, 4, 5] : [6, 5, 4];
    head.appendChild(
      el('label', { class: 'alloc-budget' }, [
        el('span', { class: 'alloc-budget-label', text: isAttr ? '定向属性点' : '定向技能点' }),
        select({
          value: String(budget),
          options: pool.map((n) => ({ value: String(n), label: `${n} 点` })),
          onChange: (v) => {
            const nv = Number(v);
            if (isAttr) assignAttrBudget(group, nv);
            else assignSkillBudget(group, nv);
            renderNewCharAllocatorSync(kind);
            refreshNewCharValidation();
          },
        }),
      ])
    );
    block.appendChild(head);

    const listEl = el('div', { class: 'alloc-list' });
    const items =
      kind === 'attribute' ? ATTRIBUTES.filter((a) => a.group === group) : SKILLS.filter((s) => s.group === group);
    items.forEach((item) => {
      const row = el('label', { class: 'alloc-item' });
      row.appendChild(el('span', { class: 'alloc-item-label', text: item.label }));
      const step = numberInput({
        value: kind === 'attribute' ? newChar.attributes[item.id] : newChar.skills[item.id],
        min: kind === 'attribute' ? 2 : 0,
        max: kind === 'attribute' ? 6 : 5,
        onChange: (v) => {
          if (kind === 'attribute') newChar.attributes[item.id] = v;
          else newChar.skills[item.id] = v;
          refreshNewCharValidation();
        },
      });
      step.className = 'alloc-input';
      row.appendChild(step);
      listEl.appendChild(row);
    });
    block.appendChild(listEl);

    // 各大类「已用 / 可用」实时校验（属性/技能都用各自的互斥定向点）
    {
      const used = el('div', {
        class: 'alloc-used',
        dataset: { kind, group },
      });
      used.appendChild(el('span', { text: `已用 ${groupSpent(kind, group)} / 可用 ${budget} 点` }));
      block.appendChild(used);
    }

    outer.appendChild(block);
  });

  // 技能另加一个全局预算合计（定向 15 + 自由 5 = 20 点）
  if (kind === 'skill') {
    outer.appendChild(
      el('div', { class: 'alloc-used', id: 'newchar-skill-total', dataset: { kind: 'skill' } }, [
        el('span', { text: `技能点合计：已用 ${newCharSkillTotal()} / 可用 20 点（定向 15 + 自由 5）` }),
      ])
    );
  }
  outer.dataset.kind = kind;
  return outer;
}

function groupSpent(kind, group) {
  return kind === 'attribute' ? newCharAttrGroupCount(group) : newCharSkillGroupCount(group);
}

// 预算互斥变更后同步界面：刷新各分配下拉的值与「已用/可用」显示（不重建整页）。
function renderNewCharAllocatorSync() {
  document.querySelectorAll('.alloc-head .alloc-budget select').forEach((sel) => {
    const block = sel.closest('.allocation-group');
    const allocator = block && block.closest('.allocator');
    const groupEl = block && block.querySelector('.alloc-group-title');
    if (!allocator || !groupEl) return;
    const kind = allocator.dataset.kind;
    const g = groupEl.textContent.replace('系', '');
    const val = kind === 'attribute' ? newChar.attrBudget[g] : newChar.skillBudget[g];
    sel.value = String(val);
  });
  document.querySelectorAll('.allocator .alloc-used[data-group]').forEach((used) => {
    const kind = used.dataset.kind;
    const g = used.dataset.group;
    const budget = kind === 'attribute' ? newChar.attrBudget[g] : newChar.skillBudget[g];
    const spent = groupSpent(kind, g);
    const span = used.querySelector('span');
    if (span) span.textContent = `已用 ${spent} / 可用 ${budget} 点`;
    used.classList.toggle('over', spent > budget);
  });
  const skillTotal = document.getElementById('newchar-skill-total');
  if (skillTotal) {
    const span = skillTotal.querySelector ? skillTotal.querySelector('span') : null;
    if (span) span.textContent = `技能点合计：已用 ${newCharSkillTotal()} / 可用 20 点（定向 15 + 自由 5）`;
  }
}

function newCharSkillTotal() {
  // 已用的总技能点 = 各大类定向点花费之和（自由点视为可分配到任意技能，剩余自由点另计）
  return newCharSkillGroupCount('生理') + newCharSkillGroupCount('心智') + newCharSkillGroupCount('互动');
}

/* ----- 专长段 ----- */
function renderNewCharPerks() {
  const wrap = el('div', { class: 'perk-builder' });
  wrap.appendChild(el('p', { class: 'rule-note', text: `建卡拥有 ${newChar.perkPoints} 点专长点数；1 点换 1 级，多级专长须逐级购买。专长列表可在「规则书→快速创建角色卡→C.专长列表」查阅。` }));

  const listEl = el('div', { class: 'perk-list', id: 'newchar-perk-list' });
  wrap.appendChild(listEl);

  // 简易添加入口（占位：名称 + 等级）
  const addRow = el('div', { class: 'perk-add-row' });
  const nameInput = textInput({ value: '', placeholder: '专长名称', onChange: (v) => { addRow.dataset.name = v; refreshNewCharValidation(); } });
  const lvInput = numberInput({ value: 0, min: 1, max: 5, onChange: (v) => { addRow.dataset.level = v; refreshNewCharValidation(); } });
  lvInput.className = 'alloc-input small';
  const addBtn = el('button', { type: 'button', class: 'btn btn-ghost small', text: '添加专长' });
  addBtn.addEventListener('click', () => {
    const name = (addRow.dataset.name || '').trim();
    const level = Number(addRow.dataset.level) || 1;
    if (!name) return;
    newChar.perks.push({ name, level });
    renderNewCharPerkList();
    addRow.dataset.name = '';
    nameInput.value = '';
    refreshNewCharValidation();
  });
  addRow.appendChild(nameInput);
  addRow.appendChild(lvInput);
  addRow.appendChild(addBtn);
  wrap.appendChild(addRow);

  renderNewCharPerkList(listEl);
  return wrap;
}

function renderNewCharPerkList(listEl) {
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!newChar.perks.length) {
    listEl.appendChild(el('span', { class: 'muted', text: '暂无专长（可暂不选择，0 点）。' }));
    return;
  }
  newChar.perks.forEach((p, i) => {
    const row = el('div', { class: 'perk-row' });
    row.appendChild(el('span', { class: 'perk-row-name', text: p.name }));
    row.appendChild(el('span', { class: 'perk-row-level', text: `${p.level} 级` }));
    const del = el('button', { type: 'button', class: 'btn btn-ghost small', text: '移除' });
    del.addEventListener('click', () => {
      newChar.perks.splice(i, 1);
      renderNewCharPerkList(listEl);
      refreshNewCharValidation();
    });
    row.appendChild(del);
    listEl.appendChild(row);
  });
}

/* ----- 校验与提交 ----- */
function newCharRequiredConceptFilled() {
  const c = newChar.concept;
  return !!(c.name.trim() && c.gender.trim() && c.race.trim() && c.appearance.trim() && c.background.trim());
}
function newCharBudgetsValid() {
  // 属性：各大类定向点互不相同的 {3,4,5} 排列，且各大类花费不超过各自定向点
  const attrPerm = Object.values(newChar.attrBudget).slice().sort().join() === [3, 4, 5].join();
  const attrsOk = attrPerm && GROUPS.every((g) => newCharAttrGroupCount(g) <= newChar.attrBudget[g]);
  // 技能：各大类定向点互不相同的 {6,5,4} 排列，且各大类花费不超过其定向点；全局合计 ≤ 定向15+自由5=20
  const skillPerm = Object.values(newChar.skillBudget).slice().sort().join() === [4, 5, 6].join();
  const skillsOk = skillPerm && GROUPS.every((g) => newCharSkillGroupCount(g) <= newChar.skillBudget[g]) && newCharSkillTotal() <= 20;
  return attrsOk && skillsOk;
}
function refreshNewCharValidation() {
  const submit = document.getElementById('newchar-submit');
  const hint = document.getElementById('newchar-hint');
  if (!submit) return;

  const conceptOk = newCharRequiredConceptFilled();
  const budgetsOk = newCharBudgetsValid();
  const ok = conceptOk && budgetsOk;

  submit.disabled = !ok;
  // 刷新各大类「已用 / 可用」
  document.querySelectorAll('.allocator .alloc-used[data-group]').forEach((used) => {
    const kind = used.dataset.kind;
    const g = used.dataset.group;
    const budget = kind === 'attribute' ? newChar.attrBudget[g] : newChar.skillBudget[g];
    const spent = groupSpent(kind, g);
    const span = used.querySelector('span');
    if (span) span.textContent = `已用 ${spent} / 可用 ${budget} 点`;
    used.classList.toggle('over', spent > budget);
  });
  // 技能全局合计
  const skillTotal = document.getElementById('newchar-skill-total');
  if (skillTotal) {
    const span = typeof skillTotal.querySelector === 'function' ? skillTotal.querySelector('span') : null;
    if (span) span.textContent = `技能点合计：已用 ${newCharSkillTotal()} / 可用 20 点（定向 15 + 自由 5）`;
    if (typeof skillTotal.classList !== 'undefined') skillTotal.classList.toggle('over', newCharSkillTotal() > 20);
  }

  if (!conceptOk) hint.textContent = '请填写概念段的必填项（姓名/性别/种族/性格简介/背景简介）';
  else if (!budgetsOk) hint.textContent = '属性/技能存在超出预算的分配，请调整或核对定向点数（属性三类需为 3/4/5、技能三类需为 6/5/4 且互不重复）';
  else hint.textContent = '所有必填内容已填写，可提交保存。';
}

function submitNewCharacter() {
  if (document.getElementById('newchar-submit') && document.getElementById('newchar-submit').disabled) {
    flash('尚有未完成内容，无法提交');
    return;
  }
  // 预留：此处应 POST /api/characters 提交给后端，当前不实现。
  flash('新建角色已提交（演示：后端接入后将从这里创建角色）');
  newChar.perks = [];
  renderNewCharacterPage();
}

/* ---- 返回确认弹窗（进度不保留）----
 * onReturn：确认后由调用方（app.js）注入的重路由回调，避免本模块反向依赖 app.js。
 */
function confirmLeaveNewCharacter(onReturn) {
  const existing = document.getElementById('confirm-dialog');
  if (existing) existing.remove();

  const overlay = el('div', { class: 'modal-overlay', id: 'confirm-dialog' });
  const box = el('div', { class: 'modal' });
  box.appendChild(el('h3', { text: '确认返回' }));
  box.appendChild(el('p', { class: 'muted', text: '确认是否返回，目前进度不会保留。' }));

  const btns = el('div', { class: 'modal-actions' });
  const stay = el('button', { type: 'button', class: 'btn btn-ghost', text: '继续填写' });
  stay.addEventListener('click', () => overlay.remove());
  const leave = el('button', { type: 'button', class: 'btn', text: '确认返回' });
  leave.addEventListener('click', () => {
    overlay.remove();
    if (typeof onReturn === 'function') onReturn();
  });
  btns.appendChild(stay);
  btns.appendChild(leave);
  box.appendChild(btns);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

/* ----- 导入角色卡弹窗（两阶段骨架，真实解析/后端暂未实现） -----
   阶段一：选择文件 → 点击「确定」；
   阶段二：展示解析概要 → 点击「确认导入」→ 向远端发送申请。 */
function openImportDialog() {
  const existing = document.getElementById('import-dialog');
  if (existing) existing.remove();

  const overlay = el('div', { class: 'modal-overlay', id: 'import-dialog' });
  const box = el('div', { class: 'modal import-modal' });
  box.appendChild(el('h3', { text: '导入角色卡' }));

  // 阶段一：选择文件
  const stage1 = el('div', { class: 'import-stage', id: 'import-stage-1' });
  stage1.appendChild(
    el('p', { class: 'muted', text: '选择一份角色卡文件，点击「确定」后进行解析预览。' })
  );
  const fileRow = el('label', { class: 'import-file' }, [
    el('span', { class: 'import-file-label', text: '选择文件' }),
    el('input', { type: 'file', id: 'import-file-input', accept: '.json,.txt,.character' }),
  ]);
  stage1.appendChild(fileRow);
  const stage1Actions = el('div', { class: 'modal-actions' });
  const close1 = el('button', { type: 'button', class: 'btn btn-ghost', text: '取消' });
  close1.addEventListener('click', () => overlay.remove());
  const confirm1 = el('button', { type: 'button', class: 'btn', text: '确定' });
  confirm1.addEventListener('click', () => {
    // 预留：读取文件 → 解析 → 填充概要。当前仅切换阶段并显示占位概要。
    const fileInput = document.getElementById('import-file-input');
    const fileName = (fileInput && fileInput.files && fileInput.files[0] && fileInput.files[0].name) || '未选择文件';
    stage1.hidden = true;
    if (stage2) stage2.hidden = false;
    const summaryFileEl = document.getElementById('import-summary-file');
    if (summaryFileEl) summaryFileEl.textContent = fileName;
  });
  stage1Actions.appendChild(close1);
  stage1Actions.appendChild(confirm1);
  stage1.appendChild(stage1Actions);

  // 阶段二：解析概要（示例信息；真实文件解析尚未实现）
  const stage2 = el('div', { class: 'import-stage', id: 'import-stage-2', hidden: true });
  stage2.appendChild(el('p', { class: 'muted', text: '解析完成，以下是该角色卡的概要信息（示例）。' }));
  const summary = el('div', { class: 'import-summary' });
  summary.appendChild(el('div', { class: 'import-summary-row' }, [
    el('span', { class: 'import-summary-key', text: '文件' }),
    el('span', { class: 'import-summary-val', id: 'import-summary-file', text: '—' }),
  ]));
  // 概要字段：角色名称 / 总资源量 / HP上限（当前为示例信息）
  [
    ['角色名称', '示例·导入者'],
    ['总资源量', 'XD+XXXX'],
    ['HP 上限', '30'],
  ].forEach(([k, v]) => {
    summary.appendChild(el('div', { class: 'import-summary-row' }, [
      el('span', { class: 'import-summary-key', text: k }),
      el('span', { class: 'import-summary-val', text: v }),
    ]));
  });
  stage2.appendChild(summary);

  const stage2Actions = el('div', { class: 'modal-actions' });
  const back2 = el('button', { type: 'button', class: 'btn btn-ghost', text: '返回' });
  back2.addEventListener('click', () => {
    stage2.hidden = true;
    if (stage1) stage1.hidden = false;
  });
  const accept2 = el('button', { type: 'button', class: 'btn', text: '确认导入' });
  accept2.addEventListener('click', () => {
    // 预留：此处应向远端 POST /api/characters/import 递交解析结果。当前仅提示。
    flash('已发送导入申请（骨架：后端接入后将从这里创建并保存角色）');
    overlay.remove();
  });
  stage2Actions.appendChild(back2);
  stage2Actions.appendChild(accept2);
  stage2.appendChild(stage2Actions);

  box.appendChild(stage1);
  box.appendChild(stage2);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

export { renderNewCharacterPage, openImportDialog, confirmLeaveNewCharacter, submitNewCharacter };