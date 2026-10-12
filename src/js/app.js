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

import { ATTRIBUTES, SKILLS, GROUPS } from './character-config.js';
import { renderRulesPage as renderRulesPageFromModule } from './rules.js';

/** 三系分组标题（生理/心智/互动），跨整行。 */
function renderGroupRow(label, colspan) {
  const tr = el('tr', { class: 'group-row' });
  const td = el('td', { text: label, class: 'group-label', colspan });
  tr.appendChild(td);
  return tr;
}
import {
  emptyCharacter,
  newSpell,
  newAttack,
  newEnergyPool,
  newPerk,
  newEquipment,
  newTrait,
  newPurchase,
  newRecord,
  newReduction,
  api,
} from './store.js';

/** 单一状态对象，引用自 store，UI 与它双向同步。 */
let character = emptyCharacter();

/** 应用级导航状态：screen=界面层（landing 主页面 / app 应用界面）；page=应用内页面（角色管理/角色卡/规则书/其他）。 */
const appState = { screen: 'landing', page: 'changelog', activeChar: null };

/** 角色卡内部「表单（sheet）切换」：当前激活的子面板。 */
const sheetState = { active: 'main' };

/* ---------- 各可切换页面（底部菜单）与角色卡子面板（sheet 标签）的定义 ---------- */

const PAGES = [
  { id: 'changelog', label: '更新记录' },
  { id: 'rules', label: '规则书' },
  { id: 'resources', label: '资源列表' },
  { id: 'characters', label: '角色管理' },
  { id: 'realm', label: '轮回之境' },
  { id: 'other', label: '其他' },
];

const SHEETS = [
  { id: 'main', label: '角色总览' },
  { id: 'attrs', label: '角色属性' },
  { id: 'spells', label: '法术列表' },
  { id: 'attacks', label: '特殊攻击' },
  { id: 'energy', label: '能量池' },
  { id: 'perks', label: '专长' },
  { id: 'gear', label: '装备' },
  { id: 'traits', label: '特性' },
  { id: 'resources', label: '资源' },
];

/* ------------------------- DOM 工具函数 ------------------------- */

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

function numberInput({ value, min = 0, max, onChange }) {
  const input = el('input', {
    type: 'number',
    min,
    ...(max != null ? { max } : {}),
    value,
  });
  input.addEventListener('input', (e) => {
    onChange(Number(e.target.value) || 0, input);
    autoGrow(input);
  });
  return input;
}

// 数字/文本输入框宽度锁定：不再随输入内容伸缩，统一由 CSS 宽度固定（无论是否输入都不变长宽）。
function autoGrow() {
  /* 锁死宽度：不做任何宽度调整，保持 CSS 设定的固定宽 */
}

function textInput({ value, placeholder = '', onChange }) {
  const input = el('input', { type: 'text', value, placeholder });
  input.addEventListener('input', (e) => {
    onChange(e.target.value, input);
    autoGrow(input);
  });
  setTimeout(() => autoGrow(input), 0);
  return input;
}

function textarea({ value, placeholder = '', onChange, className }) {
  const area = el('textarea', { value, placeholder });
  if (className) area.className = className;
  area.addEventListener('input', (e) => onChange(e.target.value, area));
  return area;
}

function select({ value, options, onChange }) {
  const sel = el('select');
  options.forEach((o) => {
    const opt = el('option', { value: o.value, text: o.label });
    if (o.value === value) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => onChange(sel.value, sel));
  return sel;
}

/** 一个小节（<section> + <h2> 标题 + 内容容器）。 */
function section(title, contentNode) {
  const container = el('div', { class: 'card-section' });
  container.appendChild(el('h2', { class: 'section-title', text: title }));
  container.appendChild(contentNode);
  return container;
}

/** 一个操作按钮（用于「添加一行」「保存」等）。 */
function actionButton(text, dataset, extraClass = '') {
  return el('button', {
    class: 'btn ' + extraClass,
    text,
    dataset,
  });
}

/* ------------------------- 派生计算（属性部分） -------------------------
 * 规则来源：基础规则.docx
 *   属性值 = 基础 + 内在 + 修行 + 器械 + 完美(修炼) + 其它
 *   传奇属性 = (属性值 - 1) 整除 5
 */
function attrsOf(attrId) {
  return character.attributes[attrId];
}

/*
 * 属性两档（对照 Excel 角色属性信息表，列：属性/属性值/传奇/基础/内在/修行/内在/器械/完美/其它/其它/检定值）：
 *   属性值 attrPool  = 基础 + 内在 + 修行
 *   检定值 attrValue = 属性值 + 内在(第二) + 器械 + 完美 + 其它 + 其它
 *   传奇   = ⌊(属性值 - 1) / 5⌋
 */
function attrPool(attrId) {
  const a = attrsOf(attrId);
  return (a.base || 0) + (a.inner || 0) + (a.practice || 0);
}

function attrValue(attrId) {
  const a = attrsOf(attrId);
  return attrPool(attrId) + (a.inner2 || 0) + (a.gear || 0) + (a.perfect || 0) + (a.other || 0) + (a.other2 || 0);
}

function attrLegendary(attrId) {
  return Math.floor((attrPool(attrId) - 1) / 5);
}

/* ------------------------- 属性表格渲染 ------------------------- */

const ATTR_BONUSES = [
  { key: 'inner', label: '内在' },
  { key: 'practice', label: '修行' },
  { key: 'inner2', label: '内在' },
  { key: 'gear', label: '器械' },
  { key: 'perfect', label: '完美' },
  { key: 'other', label: '其它' },
  { key: 'other2', label: '其它' },
];

function renderAttrRow(attr) {
  const tr = el('tr');
  tr.dataset.attrId = attr.id;
  const a = attrsOf(attr.id);
  const value = attrValue(attr.id);

  tr.appendChild(el('td', { class: 'row-label', text: attr.label }));
  tr.appendChild(el('td', { class: 'value-status', text: attrPool(attr.id) }));
  tr.appendChild(el('td', { class: 'legendary-cell', text: attrLegendary(attr.id) }));

  const baseTd = el('td', { class: 'base-col' });
  baseTd.appendChild(
    numberInput({
      value: a.base,
      min: 0,
      max: attr.max,
      onChange: (v) => {
        a.base = v;
        refreshAttrRow(tr);
        refreshAttrDetail();
        character.meta.dirty = true;
      },
    })
  );
  tr.appendChild(baseTd);

  ATTR_BONUSES.forEach((b) => {
    const td = el('td', { class: 'bonus-col' });
    td.appendChild(
      numberInput({
        value: a[b.key],
        onChange: (v) => {
          a[b.key] = v;
          refreshAttrRow(tr);
          refreshAttrDetail();
          character.meta.dirty = true;
        },
      })
    );
    tr.appendChild(td);
  });

  tr.appendChild(el('td', { class: 'calc-col', text: value }));
  return tr;
}

function refreshAttrRow(tr) {
  const id = tr.dataset.attrId;
  tr.children[1].textContent = attrPool(id);   // 属性值 = 基础+内在+修行
  tr.children[2].textContent = attrLegendary(id);
  tr.children[tr.children.length - 1].textContent = attrValue(id); // 检定值 = 属性值+器械+完美+其它
}

/* ------------------------- 技能表格渲染 ------------------------- */

function skillValue(skillId) {
  const s = character.skills[skillId];
  return (s.base || 0) + s.inner + s.practice + s.gear + s.perfect + s.morale + s.other;
}

/*
 * 附加成功规则（基础规则.docx）：
 *   技能等级达到 5、7、9、11、13、15 时各 +1，最多 6。
 */
function skillExtraSuccess(skillId) {
  const tiers = [5, 7, 9, 11, 13, 15];
  const v = skillValue(skillId);
  return tiers.filter((t) => v >= t).length;
}

const SKILL_BONUSES = [
  { key: 'inner', label: '内在' },
  { key: 'practice', label: '修行' },
  { key: 'gear', label: '器械' },
  { key: 'perfect', label: '完美' },
];

function renderSkillRow(skill) {
  const tr = el('tr');
  tr.dataset.skillId = skill.id;
  const s = character.skills[skill.id];

  tr.appendChild(el('td', { class: 'row-label', text: skill.label }));
  tr.appendChild(el('td', { class: 'value-status', text: skillValue(skill.id) }));
  tr.appendChild(el('td', { class: 'legendary-cell', text: skillExtraSuccess(skill.id) }));

  const baseTd = el('td', { class: 'base-col' });
  baseTd.appendChild(
    numberInput({
      value: s.base,
      min: 0,
      max: skill.max,
      onChange: (v) => {
        s.base = v;
        refreshSkillRow(tr);
        refreshAttrDetail();
      },
    })
  );
  tr.appendChild(baseTd);

  SKILL_BONUSES.forEach((b) => {
    const td = el('td', { class: 'bonus-col' });
    td.appendChild(
      numberInput({
        value: s[b.key],
        onChange: (v) => {
          s[b.key] = v;
          refreshSkillRow(tr);
          refreshAttrDetail();
        },
      })
    );
    tr.appendChild(td);
  });

  [['morale', '士气'], ['other', '其它']].forEach(([key]) => {
    const td = el('td', { class: 'bonus-col' });
    td.appendChild(
      numberInput({
        value: s[key],
        onChange: (v) => {
          s[key] = v;
          refreshSkillRow(tr);
          refreshAttrDetail();
        },
      })
    );
    tr.appendChild(td);
  });

  return tr;
}

function refreshSkillRow(tr) {
  const id = tr.dataset.skillId;
  tr.children[1].textContent = skillValue(id);
  tr.children[2].textContent = skillExtraSuccess(id);
}

function renderTitleRow(titles) {
  const head = el('tr');
  titles.forEach((t, idx) => {
    head.appendChild(el('th', { text: t, class: idx === 0 ? '' : 'num-head' }));
  });
  return head;
}

/* ------------------------- 概念段表单 ------------------------- */

function renderConcepts() {
  const c = character.concepts;
  const wrap = el('div', { class: 'concept-grid' });

  const field = (label, input, cls = '') => {
    const cell = el('label', { class: 'concept-field' + (cls ? ' ' + cls : '') });
    cell.appendChild(el('span', { class: 'field-label', text: label }));
    cell.appendChild(input);
    return cell;
  };

  // 参考 Excel「角色主体信息」：三短字段一行，外貌与背景横跨整行
  wrap.appendChild(field('姓名', textInput({ value: c.name, placeholder: '角色名称', onChange: (v) => (c.name = v) })));
  wrap.appendChild(field('性别', textInput({ value: c.gender, placeholder: '男 / 女 / …', onChange: (v) => (c.gender = v) })));
  wrap.appendChild(field('种族', textInput({ value: c.race, placeholder: '人形种族', onChange: (v) => (c.race = v) })));
  wrap.appendChild(field('总资源量', textInput({ value: c.totalResources, placeholder: '如 D+1000 / 15 专长点', onChange: (v) => (c.totalResources = v) })));
  wrap.appendChild(field('年龄', textInput({ value: c.age, placeholder: '岁', onChange: (v) => (c.age = v) })));
  wrap.appendChild(field('身高体重', textInput({ value: c.build, placeholder: '如 178cm / 70kg', onChange: (v) => (c.build = v) })));
  wrap.appendChild(field('外貌特征', textarea({ value: c.appearance, placeholder: '外貌、气质等描述', onChange: (v) => (c.appearance = v) }), 'span-3'));
  wrap.appendChild(field('背景概述', textarea({ value: c.background, placeholder: '大致背景与人设性格简介', onChange: (v) => (c.background = v) }), 'span-3'));

  return wrap;
}

/* ------------------------- 【角色总览】面板 ------------------------- */

// 总览通用：一个信息卡片（label + 主值 + 附注）
function infoCell(label, value, hint = '') {
  const c = el('div', { class: 'derived-cell' });
  c.appendChild(el('span', { class: 'derived-label', text: label }));
  c.appendChild(el('span', { class: 'derived-value', text: value }));
  if (hint) c.appendChild(el('span', { class: 'derived-hint', text: hint }));
  return c;
}

// n+m 显示：m(=附加成功) 为 0 时隐藏 +m，仅显示 n
function nm(n, m) {
  return Number(m) > 0 ? `${n}+${m}` : `${n}`;
}

// 属性段（总览）：一行三个，三行九项；值显示 n+m（属性检定值 + 附加成功，m=0 隐藏），无 tips
function renderAttrOverview() {
  const wrap = el('div', { class: 'info-grid' });
  ATTRIBUTES.forEach((a) => {
    wrap.appendChild(infoCell(a.label, nm(attrValue(a.id), attrLegendary(a.id))));
  });
  return wrap;
}

// 技能段（总览）：按 生理/心智/互动 分区，每区一行三个；值显示 n+m（检定值 + 附加成功），无 tips
function renderSkillOverview() {
  const wrap = el('div', { class: 'skill-categories' });
  const groups = [
    ['生理系', '生理'],
    ['心智系', '心智'],
    ['互动系', '互动'],
  ];
  groups.forEach(([title, key]) => {
    const block = el('div', { class: 'skill-category' });
    const skills = SKILLS.filter((s) => s.group === key);
    if (!skills.length) return;
    block.appendChild(el('h3', { class: 'skill-group-title', text: title }));
    const grid = el('div', { class: 'info-grid skill-grid' });
    skills.forEach((s) => {
      const cell = el('div', { class: 'derived-cell skill-cell' });
      cell.appendChild(el('span', { class: 'derived-label', text: s.label }));
      cell.appendChild(el('span', { class: 'derived-value skill-value', text: nm(skillValue(s.id), skillExtraSuccess(s.id)) }));
      grid.appendChild(cell);
    });
    block.appendChild(grid);
    wrap.appendChild(block);
  });
  return wrap;
}

// 五种基础攻击：名称 / 检定DP / 伤害上限 / 附加成功
function baseAttackData(atk) {
  const attrV = attrValue(atk.attr);
  const skillV = skillValue(atk.skill);
  const legAttr = attrLegendary(atk.attr);
  const wdmg = atk.weaponDamage != null ? Number(atk.weaponDamage) : 0;
  const ammo = atk.ammoDamage != null ? Number(atk.ammoDamage) : 0;
  const addDmg = wdmg + (atk.id === 'semi' || atk.id === 'full' || atk.id === 'bow' ? ammo : 0);
  const bonusSum = (atk.bonuses || []).reduce((s, b) => s + (Number(b) || 0), 0) + (Number(atk.other) || 0);
  const checkDP = attrV + skillV + addDmg + (Number(atk.specialty) || 0) + bonusSum;
  const damageCap =
    addDmg +
    Number(attrsOf(atk.attr).base) +
    Number(character.skills[atk.skill].base) +
    ((Number(atk.specialty) || 0) > 0 ? 1 : 0) +
    legAttr * 2 +
    (Number(character.geneLock) || 0);
  const extraSuccess = skillExtraSuccess(atk.skill) + legAttr + bonusSum + (atk.extraSuccessBonus || []).reduce((s, b) => s + (Number(b) || 0), 0);
  return { label: atk.label, checkDP, damageCap, extraSuccess };
}

// 基础攻击方式（总览）：一行三个，值显示 n+m（检定DP + 附加成功，m=0 隐藏），tips 仅保留伤害上限
function renderAttackOverview() {
  const wrap = el('div', { class: 'info-grid' });
  character.baseAttacks.forEach((atk) => {
    const d = baseAttackData(atk);
    wrap.appendChild(infoCell(d.label, nm(d.checkDP, d.extraSuccess), `伤害上限 ${d.damageCap}`));
  });
  return wrap;
}

// 派生值（总览）：意志力 / 先攻值 / 移动力 + 三豁免（移入派生值）
function renderOverviewDerived() {
  const d = derivedValues();
  const wrap = el('div', { class: 'derived-wrap' });
  const grid = el('div', { class: 'info-grid' });
  grid.appendChild(infoCell('意志力', d.willpower, '决心 + 沉着 + 传奇决心×3'));
  grid.appendChild(infoCell('先攻值', d.initiative, '敏捷 + 沉着 + 传奇沉着×3'));
  grid.appendChild(infoCell('移动力', d.movement, '5 + 力量 + 敏捷 + 传奇敏捷×3'));
  wrap.appendChild(grid);

  wrap.appendChild(el('h3', { class: 'skill-group-title save-head', text: '豁免检定' }));
  const row = el('div', { class: 'info-grid save-row' });
  // 总览豁免：值显示 n+m（基础豁免 + 附加成功，m=0 隐藏）
  row.appendChild(infoCell('反射豁免', nm(d.reflex, saveOverviewExtra(0)), '敏捷 + 运动'));
  row.appendChild(infoCell('意志豁免', nm(d.willSave, saveOverviewExtra(1)), '决心 + 感受'));
  row.appendChild(infoCell('强韧豁免', nm(d.fortitude, saveOverviewExtra(2)), '耐力 + 求生'));
  wrap.appendChild(row);
  return wrap;
}

// 豁免「附加成功」展示值（不含属性页的附加成功加值）：技能附加成功 + 主属性传奇
function saveOverviewExtra(i) {
  return skillExtraSuccess(SAVE_DEFS[i].skill) + attrLegendary(SAVE_DEFS[i].attr);
}

// 护甲合计（总护甲 + 附加成功）
function overviewArmorTotal() {
  return (
    (character.defense.armor.innate || 0) + (character.defense.armor.base || 0) +
    (character.defense.armor.armor || 0) + (character.defense.armor.block || 0) +
    (character.defense.armor.insight || 0) + (character.defense.armor.other || 0) +
    (character.defense.armorBonus || []).reduce((s, b) => s + (Number(b) || 0), 0)
  );
}
function armorExtraSuccess() {
  return attrLegendary('stamina'); // 防御附加成功：传奇耐力
}

// 伤害减免：汇总「X物理减免，Y能量减免」
function reductionSummary() {
  const reds = (character.defense.reduction || []).filter((r) => Number(r.amount) > 0);
  if (!reds.length) return '无伤害减免';
  return reds.map((r) => `${Number(r.amount)}${r.type}减免`).join('，');
}

// 生命值：单独一部分，展示属性页计算完成的详细状态；总量显示 n+m（n 总量，m 临时生命，m=0 时隐藏 +m）
function renderHealthPanel() {
  const hp = character.hpSlots;
  const d = derivedValues();
  const parts = [];
  if (Number(hp.intact) > 0) parts.push(`${hp.intact}`);
  if (Number(hp.b) > 0) parts.push(`${hp.b}B`);
  if (Number(hp.l) > 0) parts.push(`${hp.l}L`);
  if (Number(hp.a) > 0) parts.push(`${hp.a}A`);
  if (Number(hp.temp) > 0) parts.push(`${hp.temp}临时`);
  const statusText = parts.length ? parts.join(' + ') : '0';
  const temp = Number(hp.temp) || 0;
  const totalText = temp > 0 ? `${d.health}+${temp}` : `${d.health}`;

  const cell = infoCell('生命值总量', totalText, `状态 ${statusText}`);
  // 控制区：右侧两个按钮 + 两个输入框（按钮左、输入框右，各占半行，暂不实现功能）
  const ctrl = el('div', { class: 'health-ctrl' });
  const mkAction = (label, key) => {
    const row = el('div', { class: 'health-action' });
    row.appendChild(actionButton(label, { action: 'health-action' }));
    row.appendChild(numberInput({ value: 0, min: 0, onChange: () => {} }));
    return row;
  };
  ctrl.appendChild(mkAction('回复生命', 'heal'));
  ctrl.appendChild(mkAction('受到伤害', 'damage'));
  cell.appendChild(ctrl);

  const wrap = el('div', { class: 'health-panel' });
  wrap.appendChild(cell);
  return wrap;
}

// 防御信息：护甲（总+附加成功） + 伤害减免
function renderDefenseInfo() {
  const wrap = el('div', { class: 'defense-info' });
  const grid = el('div', { class: 'info-grid' });
  grid.appendChild(infoCell('护甲', nm(overviewArmorTotal(), armorExtraSuccess()), '总护甲+附加成功（传奇耐力）'));
  wrap.appendChild(grid);

  const bar = el('div', { class: 'reduction-bar' });
  bar.appendChild(el('span', { class: 'reduction-label', text: '伤害减免' }));
  bar.appendChild(el('span', { class: 'reduction-value', text: reductionSummary() }));
  wrap.appendChild(bar);
  return wrap;
}

// 敏感范围（总览/属性页共用）：感知属性×10 + 传奇感知×20 + 加成
function sensitiveRangeTotal() {
  const dd = character.derivedDetail.sensitive;
  return (
    attrPool('perception') * 10 + attrLegendary('perception') * 20 +
    (dd.bonus || []).reduce((s, b) => s + (Number(b) || 0), 0)
  );
}

// 其他信息：基因锁熟练度 / 敏感范围
function renderOtherInfo() {
  const wrap = el('div', { class: 'overview-info' });
  const row = el('div', { class: 'info-grid' });
  row.appendChild(infoCell('基因锁熟练度', character.geneLock ?? 0, ''));
  row.appendChild(infoCell('敏感范围', `${sensitiveRangeTotal()} m`, ''));
  wrap.appendChild(row);
  return wrap;
}

function renderMainSheet() {
  const wrap = el('div', { class: 'sheet-panel' });
  wrap.appendChild(section('概念段', renderConcepts()));
  wrap.appendChild(section('属性段', renderAttrOverview()));
  wrap.appendChild(section('技能段', renderSkillOverview()));
  wrap.appendChild(section('生命信息', renderHealthPanel()));
  wrap.appendChild(section('防御信息', renderDefenseInfo())); // 防御信息移至生命信息下方
  wrap.appendChild(section('派生值', renderOverviewDerived()));
  wrap.appendChild(section('基础攻击方式', renderAttackOverview()));
  wrap.appendChild(section('其他信息', renderOtherInfo()));
  return wrap;
}

/* ------------------------- 【角色属性】面板（详细） ------------------------- */

// 属性完整列（含加值栏）：属性 / 属性值 / 传奇 / 基础 / 内在 / 修行 / 内在 / 器械 / 完美 / 其它 / 其它 / 检定值
// 按 生理/心智/互动 三系分组展示（参考角色卡 Excel 与基础规则.docx）
function renderFullAttrTable() {
  const table = el('table', { class: 'stats-table attr-table' });
  table.appendChild(renderTitleRow(['属性', '属性值', '传奇', '基础', '内在', '修行', '内在', '器械', '完美', '其它', '其它', '检定值']));
  GROUPS.forEach((g) => {
    const items = ATTRIBUTES.filter((a) => a.group === g);
    if (!items.length) return;
    table.appendChild(renderGroupRow(`${g}系`, 12));
    items.forEach((a) => table.appendChild(renderAttrRow(a)));
  });
  return table;
}

// 技能完整列（含加值栏）：技能 / 检定值 / 附加成功 / 建卡 / 内在 / 修行 / 器械 / 完美 / 士气 / 其它
// 同样按 生理/心智/互动 三系分组展示
function renderFullSkillTable() {
  const table = el('table', { class: 'stats-table' });
  table.appendChild(renderTitleRow(['技能', '检定值', '附加成功', '建卡', '内在', '修行', '器械', '完美', '士气', '其它']));
  GROUPS.forEach((g) => {
    const items = SKILLS.filter((s) => s.group === g);
    if (!items.length) return;
    table.appendChild(renderGroupRow(`${g}系`, 10));
    items.forEach((s) => table.appendChild(renderSkillRow(s)));
  });
  return table;
}

// 属性细则：派生值计算 + 加成栏位（参考 Excel「属性细则」）
// detailNumber: 绑定写回 + 就近刷新本框合计（避免整页重渲染导致失焦）。
function detailNumber(value, write, recompute) {
  const input = numberInput({
    value,
    onChange: (v) => {
      write(v);
      const box = input.closest('.detail-box');
      const total = box ? box.querySelector('.detail-box-total') : null;
      if (total) total.textContent = recompute();
    },
  });
  return input;
}

function attrDetailBox(title, total, inputs, tip = '') {
  // 派生值框：最左侧加蓝色竖条（参照基础攻击方式 .attack-detail）
  const box = el('div', { class: 'detail-box detail-box-accent' });
  const head = el('div', { class: 'detail-box-head' });
  head.appendChild(el('span', { class: 'detail-box-title', text: title })); // 小标题在左上
  box.appendChild(head);
  // 总值从左下挪到最左侧：参照总览卡片，靠左放入「总值」栏（label + 大号数值）
  const row = el('div', { class: 'detail-box-inputs' });
  const tBlock = el('div', { class: 'detail-total-block' });
  tBlock.appendChild(el('span', { class: 'detail-total-label', text: '总值' }));
  tBlock.appendChild(el('span', { class: 'detail-box-total', text: total }));
  row.appendChild(tBlock);
  inputs.forEach((it) => {
    const c = el('label', { class: 'detail-input' });
    c.appendChild(el('span', { class: 'detail-input-label', text: it.label }));
    c.appendChild(it.node);
    row.appendChild(c);
  });
  box.appendChild(row);
  if (tip) box.appendChild(el('div', { class: 'detail-tip', text: tip })); // 左下角提示
  return box;
}

function renderAttrDetailPanel() {
  const wrap = el('div', { class: 'attr-detail-panel' });
  const dd = character.derivedDetail;
  const base = derivedValues();
  const bon = (arr) => (arr || []).reduce((s, b) => s + (Number(b) || 0), 0);
  const bonusInputs = (arr, writeArr, recompute, featVal, featWrite) => {
    const list = [];
    if (featWrite) {
      list.push({ label: '专长', node: detailNumber(Number(featVal) || 0, featWrite, recompute) });
    }
    for (let i = 0; i < 5; i++) {
      const j = i;
      list.push({ label: `加成${j + 1}`, node: detailNumber(arr[j], (v) => (writeArr[j] = v), recompute) });
    }
    return list;
  };

  const mv = () => base.movement + (Number(dd.movement.feat) || 0) + bon(dd.movement.bonus);
  const it = () => base.initiative + (Number(dd.initiative.feat) || 0) + bon(dd.initiative.bonus);
  const wp = () => base.willpower + (Number(dd.willpower.feat) || 0) + bon(dd.willpower.bonus);
  const hp = () => base.health + (Number(dd.health.feat) || 0) + bon(dd.health.bonus);

  wrap.appendChild(attrDetailBox('移动力', mv(), bonusInputs(dd.movement.bonus, dd.movement.bonus, mv, dd.movement.feat, (v) => (dd.movement.feat = v)), '5 + 力量检定 + 敏捷检定 + 传奇敏捷×3'));
  wrap.appendChild(attrDetailBox('先攻值', it(), bonusInputs(dd.initiative.bonus, dd.initiative.bonus, it, dd.initiative.feat, (v) => (dd.initiative.feat = v)), '敏捷检定 + 沉着检定 + 传奇沉着×3'));
  wrap.appendChild(attrDetailBox('意志力', wp(), [
    { label: '传奇决心', node: el('span', { class: 'detail-static', text: attrLegendary('resolve') * 3 }) },
    { label: '传奇沉着', node: el('span', { class: 'detail-static', text: attrLegendary('presence') }) },
    { label: '专长', node: detailNumber(dd.willpower.feat, (v) => (dd.willpower.feat = v), wp) },
    ...bonusInputs(dd.willpower.bonus, dd.willpower.bonus, wp),
  ], '决心检定 + 沉着检定 + 传奇决心×3 + 传奇沉着'));
  wrap.appendChild(attrDetailBox('生命值', hp(), bonusInputs(dd.health.bonus, dd.health.bonus, hp, dd.health.feat, (v) => (dd.health.feat = v)), '5 + 耐力检定 + 传奇耐力增值 ⌊N(N+1)/2⌋'));

  return wrap;
}

// 通用「圆角外框 + 直角内表 + 左下提示」结构
function tableBox(title, tableNode, tip = '', boxClass = '') {
  const box = el('div', { class: 'detail-box' + (boxClass ? ' ' + boxClass : '') });
  const head = el('div', { class: 'detail-box-head' });
  head.appendChild(el('span', { class: 'detail-box-title', text: title }));
  box.appendChild(head);
  const scroll = el('div', { class: 'table-scroll' });
  scroll.appendChild(tableNode);
  box.appendChild(scroll);
  if (tip) box.appendChild(el('div', { class: 'detail-tip', text: tip }));
  return box;
}

// 豁免检定（参考 Excel「角色属性」A96-M105 与基础规则.docx）：每个豁免 = 表头行 + 值行，共 6 行
const SAVE_DEFS = [
  { name: '反射豁免', attr: 'dexterity', skill: 'athletics', attrName: '敏捷', skillName: '运动', legName: '传奇敏捷' },
  { name: '意志豁免', attr: 'resolve', skill: 'empathy', attrName: '决心', skillName: '感受', legName: '传奇决心' },
  { name: '强韧豁免', attr: 'stamina', skill: 'survival', attrName: '耐力', skillName: '求生', legName: '传奇耐力' },
];

// 单个豁免的「附加成功 m」= 技能附加成功 + 主属性传奇附加成功 + 附加加值1..5(bonus+5..+9)
function saveExtraSuccess(i) {
  const dd = character.derivedDetail.saves;
  const b = dd.bonus;
  return (
    skillExtraSuccess(SAVE_DEFS[i].skill) + attrLegendary(SAVE_DEFS[i].attr) +
    (Number(b[i * 10 + 5]) || 0) + (Number(b[i * 10 + 6]) || 0) + (Number(b[i * 10 + 7]) || 0) +
    (Number(b[i * 10 + 8]) || 0) + (Number(b[i * 10 + 9]) || 0)
  );
}

// 单个豁免的「总计 n」（不含附加成功）：
// 属性检定 + 技能检定 + 传奇属性×3 + 专业 + 专长 + 加成1..5
function saveTotalOf(i) {
  const s = SAVE_DEFS[i];
  const dd = character.derivedDetail.saves;
  const b = dd.bonus;
  return (
    attrValue(s.attr) + skillValue(s.skill) + attrLegendary(s.attr) * 3 +
    (Number(dd.special[i]) || 0) + (Number(dd.feat[i]) || 0) +
    (Number(b[i * 10]) || 0) + (Number(b[i * 10 + 1]) || 0) + (Number(b[i * 10 + 2]) || 0) +
    (Number(b[i * 10 + 3]) || 0) + (Number(b[i * 10 + 4]) || 0)
  );
}

// 豁免总值显示为「n+m」：n = 总计，m = 附加成功；m=0 时隐藏 +m
function saveDisplayOf(i) {
  return nm(saveTotalOf(i), saveExtraSuccess(i));
}

function renderSavesPanel() {
  const dd = character.derivedDetail.saves;
  const wrap = el('div', { class: 'attr-detail-panel save-detail-panel' });

  SAVE_DEFS.forEach((s, i) => {
    const recompute = () => saveDisplayOf(i);
    const box = el('div', { class: 'detail-box save-detail-box detail-box-accent' });
    const head = el('div', { class: 'detail-box-head' });
    head.appendChild(el('span', { class: 'detail-box-title', text: s.name }));
    box.appendChild(head);

    const row = el('div', { class: 'detail-box-inputs' });
    // 总值栏在左，值显示为「总计 + 附加成功」（n+m）
    const tBlock = el('div', { class: 'detail-total-block' });
    tBlock.appendChild(el('span', { class: 'detail-total-label', text: '总值' }));
    tBlock.appendChild(el('span', { class: 'detail-box-total', text: recompute() }));
    row.appendChild(tBlock);

    // 专业 / 专长
    row.appendChild(
      el('label', { class: 'detail-input' }, [
        el('span', { class: 'detail-input-label', text: '专业' }),
        detailNumber(dd.special[i], (v) => (dd.special[i] = v), recompute),
      ])
    );
    row.appendChild(
      el('label', { class: 'detail-input' }, [
        el('span', { class: 'detail-input-label', text: '专长' }),
        detailNumber(dd.feat[i], (v) => (dd.feat[i] = v), recompute),
      ])
    );
    // 加成1..5（并入总计 n）
    for (let k = 0; k < 5; k++) {
      const idx = i * 10 + k;
      row.appendChild(
        el('label', { class: 'detail-input' }, [
          el('span', { class: 'detail-input-label', text: `加成${k + 1}` }),
          detailNumber(dd.bonus[idx], (v) => (dd.bonus[idx] = v), recompute),
        ])
      );
    }
    // 竖线分隔 + 右侧附加加值（附加加值1/2/3/4/5，计入 m；横向排布与主体 input 对齐）
    const esc = el('div', { class: 'detail-extra-succ' });
    for (let k = 5; k < 10; k++) {
      const idx = i * 10 + k;
      esc.appendChild(
        el('label', { class: 'detail-input' }, [
          el('span', { class: 'detail-input-label', text: `附加加值${k - 4}` }),
          detailNumber(dd.bonus[idx], (v) => (dd.bonus[idx] = v), recompute),
        ])
      );
    }
    row.appendChild(esc);
    box.appendChild(row);
    // 灰色 tip：隐含 属性 + 技能 + 传奇属性×3（不单独展示列）
    box.appendChild(el('div', { class: 'detail-tip', text: `${s.attrName}检定 + ${s.skillName}检定 + ${s.legName}×3` }));
    wrap.appendChild(box);
  });

  return wrap;
}

// 防御（护甲来源 + 伤害减免）
function renderDefensePanel() {
  const wrap = el('div', { class: 'attr-detail-panel' });
  const df = character.defense;

  const armorBox = el('div', { class: 'detail-box detail-box-accent' }); // 护甲合计左侧小蓝条
  const aHead = el('div', { class: 'detail-box-head' });
  aHead.appendChild(el('span', { class: 'detail-box-title', text: '护甲合计' }));
  armorBox.appendChild(aHead);
  const aRow = el('div', { class: 'detail-box-inputs' });
  // 总值栏移到最左侧（与其余派生值框一致）
  const aTotal = el('div', { class: 'detail-total-block' });
  aTotal.appendChild(el('span', { class: 'detail-total-label', text: '总值' }));
  aTotal.appendChild(el('span', { class: 'detail-box-total', text: overviewArmorTotal() }));
  aRow.appendChild(aTotal);
  const armorKeys = [
    ['innate', '天生'], ['base', '基础'], ['armor', '盔甲'],
    ['block', '格挡'], ['insight', '洞察'], ['other', '其它'],
  ];
  armorKeys.forEach(([k, lab]) => {
    const c = el('label', { class: 'detail-input' });
    c.appendChild(el('span', { class: 'detail-input-label', text: lab }));
    c.appendChild(numberInput({ value: df.armor[k], onChange: (v) => { df.armor[k] = v; refreshAttrDetail(); } }));
    aRow.appendChild(c);
  });
  (df.armorBonus || []).forEach((b, i) => {
    const c = el('label', { class: 'detail-input' });
    c.appendChild(el('span', { class: 'detail-input-label', text: '加成' + (i + 1) }));
    c.appendChild(numberInput({ value: b, onChange: (v) => { df.armorBonus[i] = v; refreshAttrDetail(); } }));
    aRow.appendChild(c);
  });
  armorBox.appendChild(aRow);
  wrap.appendChild(armorBox);

  // 伤害减免：每行 = 类型 / 减免值 / 来源 的小输入框（各带名称）+ 最右侧删除
  const redBox = el('div', { class: 'detail-box' });
  const redHead = el('div', { class: 'detail-box-head' });
  redHead.appendChild(el('span', { class: 'detail-box-title', text: '伤害减免' }));
  redBox.appendChild(redHead);
  const redList = el('div', { class: 'red-list' });
  (df.reduction || []).forEach((r, i) => {
    const row = el('div', { class: 'red-row' });
    const typeC = el('label', { class: 'detail-input' });
    typeC.appendChild(el('span', { class: 'detail-input-label', text: '类型' }));
    const typeInp = textInput({ value: r.type, placeholder: '如 物理 / 能量', onChange: (v) => (r.type = v) });
    typeInp.style.width = '150px';
    typeC.appendChild(typeInp);
    const amtC = el('label', { class: 'detail-input' });
    amtC.appendChild(el('span', { class: 'detail-input-label', text: '减免值' }));
    amtC.appendChild(numberInput({ value: r.amount, min: 0, onChange: (v) => (r.amount = v) }));
    const srcC = el('label', { class: 'detail-input red-input-wide' });
    srcC.appendChild(el('span', { class: 'detail-input-label', text: '来源' }));
    const srcInp = textInput({ value: r.source, placeholder: '如 血统xx / 装备', onChange: (v) => (r.source = v) });
    srcInp.style.width = '280px'; // 来源栏适当加大，便于填写来源说明
    srcC.appendChild(srcInp);
    row.appendChild(typeC);
    row.appendChild(amtC);
    row.appendChild(srcC);
    row.appendChild(actionButton('删除', { action: 'remove-reduction', index: i }, 'btn-ghost red-op-btn'));
    redList.appendChild(row);
  });
  redBox.appendChild(redList);
  const redAdd = el('div', { class: 'add-bar add-bar-right' });
  redAdd.appendChild(actionButton('添加减免', { action: 'add-reduction' }));
  redBox.appendChild(redAdd);
  wrap.appendChild(redBox);
  return wrap;
}

// 基础攻击详细（参考豁免样式）：n+m 总值，属性/技能隐含于 tip，传奇可见，右侧附加成功加值(3)
function renderBaseAttackDetail() {
  const wrap = el('div', { class: 'attr-detail-panel' });
  const attrName = (id) => (id === 'strength' ? '力量' : '敏捷');
  const skillName = (id) => ({ weaponry: '白刃', brawl: '肉搏', firearms: '枪械', athletics: '运动' }[id] || id);

  character.baseAttacks.forEach((atk) => {
    const aN = attrName(atk.attr);
    const sN = skillName(atk.skill);
    const legN = `传奇${aN}`;

    const recompute = () => {
      const d = baseAttackData(atk);
      return nm(d.checkDP, d.extraSuccess);
    };
    const box = el('div', { class: 'detail-box attack-detail' }); // 蓝绿左边框沿用 attack-detail
    const head = el('div', { class: 'detail-box-head' });
    head.appendChild(el('span', { class: 'detail-box-title', text: atk.label }));
    box.appendChild(head);

    const row = el('div', { class: 'detail-box-inputs' });
    const tBlock = el('div', { class: 'detail-total-block' });
    tBlock.appendChild(el('span', { class: 'detail-total-label', text: '总值' }));
    tBlock.appendChild(el('span', { class: 'detail-box-total', text: recompute() }));
    row.appendChild(tBlock);

    // 传奇不隐含：单独展示（静态，自动计算）
    row.appendChild(
      el('label', { class: 'detail-input' }, [
        el('span', { class: 'detail-input-label', text: legN }),
        el('span', { class: 'detail-static', text: attrLegendary(atk.attr) }),
      ])
    );
    // 武器伤害 / 专业 / 加成1..5 / 其他
    const inp = (label, value, write) => {
      row.appendChild(
        el('label', { class: 'detail-input' }, [
          el('span', { class: 'detail-input-label', text: label }),
          detailNumber(value, write, recompute),
        ])
      );
    };
    if (atk.ammoCount != null) inp('弹药数', atk.ammoCount, (v) => (atk.ammoCount = v));
    if (atk.ammoDamage != null) inp(atk.id === 'bow' ? '箭矢伤害' : '弹药伤害', atk.ammoDamage, (v) => (atk.ammoDamage = v));
    inp('武器伤害', atk.weaponDamage, (v) => (atk.weaponDamage = v));
    inp('专业', atk.specialty, (v) => (atk.specialty = v));
    for (let i = 0; i < 5; i++) {
      const j = i;
      inp(`加成${i + 1}`, atk.bonuses[i], (v) => (atk.bonuses[j] = v));
    }
    inp('其他', atk.other, (v) => (atk.other = v));

    // 竖线分隔 + 右侧附加成功加值（附加加值1..5，计入 m；与主体输入框同一横向/纵向对齐）
    const esc = el('div', { class: 'detail-extra-succ' });
    for (let k = 0; k < 5; k++) {
      const j = k;
      esc.appendChild(
        el('label', { class: 'detail-input' }, [
          el('span', { class: 'detail-input-label', text: `附加加值${k + 1}` }),
          detailNumber(atk.extraSuccessBonus[k], (v) => (atk.extraSuccessBonus[j] = v), recompute),
        ])
      );
    }
    row.appendChild(esc);
    box.appendChild(row);

    const d = baseAttackData(atk);
    // 属性/技能隐含于 tip，传奇可见
    box.appendChild(el('div', { class: 'detail-tip', text: `${aN}检定 + ${sN}检定 · 伤害上限 ${d.damageCap}` }));
    wrap.appendChild(box);
  });
  return wrap;
}

// 敏感范围：仿派生值框（总计+加成小输入框 + 灰色 tip 隐藏属性引用）
function renderSensitiveRangeDetail() {
  const wrap = el('div', { class: 'attr-detail-panel' });
  const dd = character.derivedDetail.sensitive;

  const recompute = () => sensitiveRangeTotal();

  const box = el('div', { class: 'detail-box detail-box-accent' });
  const head = el('div', { class: 'detail-box-head' });
  head.appendChild(el('span', { class: 'detail-box-title', text: '敏感范围' }));
  box.appendChild(head);

  const row = el('div', { class: 'detail-box-inputs' });
  const tBlock = el('div', { class: 'detail-total-block' });
  tBlock.appendChild(el('span', { class: 'detail-total-label', text: '总值' }));
  tBlock.appendChild(el('span', { class: 'detail-box-total', text: recompute() }));
  row.appendChild(tBlock);
  // 加成1..5
  for (let k = 0; k < 5; k++) {
    const j = k;
    row.appendChild(
      el('label', { class: 'detail-input' }, [
        el('span', { class: 'detail-input-label', text: `加成${k + 1}` }),
        detailNumber(dd.bonus[k], (v) => (dd.bonus[j] = v), recompute),
      ])
    );
  }
  box.appendChild(row);
  // 灰色 tip：隐含 感知检定 / 传奇感知（不单独展示列）
  box.appendChild(el('div', { class: 'detail-tip', text: '= 感知检定×10 + 传奇感知×20' }));
  wrap.appendChild(box);
  return wrap;
}

// 基因锁熟练度：独立加值表（总计 = min(基础 + 传奇风度, 10)）
function renderGeneLockDetail() {
  const wrap = el('div', { class: 'attr-detail-panel' });
  const gene = () => Math.min((Number(character.geneLock) || 0) + attrLegendary('composure'), 10);
  const table = el('table', { class: 'stats-table calc-table' });
  const h = el('tr', { class: 'subhead-row' });
  ['名称', '熟练度', '基础', '传奇风度'].forEach((t, idx) => h.appendChild(el('th', { text: t, class: idx === 0 ? '' : 'num-head' })));
  table.appendChild(h);
  const tr = el('tr');
  tr.appendChild(el('td', { class: 'row-label', text: '基因锁熟练度' }));
  tr.appendChild(el('td', { class: 'value-status', text: gene() }));
  const baseTd = el('td', { class: 'base-col' });
  baseTd.appendChild(numberInput({
    value: character.geneLock,
    max: 10,
    onChange: (v, inp) => { character.geneLock = v; const row = inp.closest('tr'); if (row) row.querySelector('.value-status').textContent = Math.min(v + attrLegendary('composure'), 10); refreshAttrDetail(); },
  }));
  tr.appendChild(baseTd);
  tr.appendChild(el('td', { class: 'calc-col', text: attrLegendary('composure') }));
  table.appendChild(tr);
  wrap.appendChild(tableBox('基因锁熟练度', table, '= min(基础 + 传奇风度, 10)'));
  return wrap;
}

// 生命值（属性页）：状态点数 + 明细
function renderHealthDetail() {
  const hp = character.hpSlots;
  const base = derivedValues();
  const hpBox = el('div', { class: 'detail-box detail-box-accent' }); // 左侧小蓝条
  const hHead = el('div', { class: 'detail-box-head' });
  hHead.appendChild(el('span', { class: 'detail-box-title', text: '生命值点数' }));
  hpBox.appendChild(hHead);
  const r2 = el('div', { class: 'detail-box-inputs' });
  // 总值栏移到最左侧（与其余派生值框一致）
  const hpTotal = el('div', { class: 'detail-total-block' });
  hpTotal.appendChild(el('span', { class: 'detail-total-label', text: '总值' }));
  hpTotal.appendChild(el('span', { class: 'detail-box-total', text: base.health }));
  r2.appendChild(hpTotal);
  const hpField = (label, key) => {
    const c = el('label', { class: 'detail-input' });
    c.appendChild(el('span', { class: 'detail-input-label', text: label }));
    // 完好默认值 = 总值（总值修改后同步变动）；其余状态点数照常
    const init = key === 'intact' && (hp.intact || 0) === 0 ? base.health : hp[key];
    const inp = numberInput({ value: init, onChange: (v) => (hp[key] = v) });
    if (key === 'intact') inp._intactInput = true;
    c.appendChild(inp);
    return c;
  };
  r2.appendChild(hpField('完好', 'intact'));
  r2.appendChild(hpField('冲击 B', 'b'));
  r2.appendChild(hpField('严重 L', 'l'));
  r2.appendChild(hpField('恶性 A', 'a'));
  r2.appendChild(hpField('临时', 'temp'));
  hpBox.appendChild(r2);
  const wrap = el('div', { class: 'attr-detail-panel' });
  wrap.appendChild(hpBox);
  return wrap;
}

// 就地刷新激活 sheet 上的所有派生值合计（不重渲染，避免输入失焦）。
function refreshAttrDetail() {
  const host = document.querySelector('.sheet-body');
  if (!host) return;
  const bon = (arr) => (arr || []).reduce((s, b) => s + (Number(b) || 0), 0);
  const dd = character.derivedDetail;
  const base = derivedValues();

  // 计算每个「圆角外框」合计值（按框标题）
  const totalsByTitle = {
    移动力: () => base.movement + (Number(dd.movement.feat) || 0) + bon(dd.movement.bonus),
    先攻值: () => base.initiative + (Number(dd.initiative.feat) || 0) + bon(dd.initiative.bonus),
    意志力: () => base.willpower + (Number(dd.willpower.feat) || 0) + bon(dd.willpower.bonus),
    生命值: () => base.health + (Number(dd.health.feat) || 0) + bon(dd.health.bonus),
    护甲合计: () => overviewArmorTotal(),
    生命值点数: () => base.health,
  };

  host.querySelectorAll('.detail-box').forEach((box) => {
    const titleEl = box.querySelector('.detail-box-title');
    if (!titleEl) return;
    const title = titleEl.textContent;

    // 1) 有「总值栏」的外框（移动/先攻/意志/生命/护甲、生命值点数）
    const totalEl = box.querySelector('.detail-box-total');
    const fn = totalsByTitle[title];
    if (totalEl && fn) totalEl.textContent = fn();

    // 2) 豁免框（仿派生值样式）：更新总值栏「n+m」（n=总计，m=附加成功）
    const saveIdx = SAVE_DEFS.findIndex((s) => s.name === title);
    if (saveIdx >= 0) {
      const svTotal = box.querySelector('.detail-box-total');
      if (svTotal) svTotal.textContent = saveDisplayOf(saveIdx);
    }

    // 3) 敏感范围框（仿派生值样式）：总值 = 感知×10 + 传奇感知×20 + 加成；并同步「完好」输入跟随总值
    if (title === '敏感范围') {
      const d2 = box.querySelector('.detail-box-total');
      if (d2) d2.textContent = sensitiveRangeTotal();
    }
    if (title === '生命值点数') {
      // 完好默认跟随总值（修改后变动）
      const intactLab = [...box.querySelectorAll('.detail-input')].find((l) => l.querySelector('.detail-input-label') && l.querySelector('.detail-input-label')._text === '完好');
      const intactInp = intactLab && intactLab.querySelector('input');
      if (intactInp) intactInp.value = base.health;
    }
    if (title === '基因锁熟练度') {
      const totalCell = box.querySelector('.value-status');
      if (totalCell) totalCell.textContent = Math.min((Number(character.geneLock) || 0) + attrLegendary('composure'), 10);
    }
  });

  // 4) 攻击框：更新 总值栏(n+m) + 底部提示（属性/技能隐含，伤害上限）
  host.querySelectorAll('.detail-box.attack-detail').forEach((box) => {
    const titleEl = box.querySelector('.detail-box-title');
    const atk = character.baseAttacks.find((a) => a.label === titleEl.textContent);
    const tipEl = box.querySelector('.detail-tip');
    const totalEl = box.querySelector('.detail-box-total');
    if (atk) {
      const d = baseAttackData(atk);
      const aN = (id) => (id === 'strength' ? '力量' : '敏捷');
      const sN = (id) => ({ weaponry: '白刃', brawl: '肉搏', firearms: '枪械', athletics: '运动' }[id] || id);
      if (tipEl) tipEl.textContent = `${aN(atk.attr)}检定 + ${sN(atk.skill)}检定 · 伤害上限 ${d.damageCap}`;
      if (totalEl) totalEl.textContent = nm(d.checkDP, d.extraSuccess);
    }
  });
}

function renderAttrDetailSheet() {
  const wrap = el('div', { class: 'sheet-panel' });
  wrap.appendChild(section('属性加值', renderFullAttrTable()));
  wrap.appendChild(section('技能加值', renderFullSkillTable()));
  wrap.appendChild(section('生命值', renderHealthDetail()));
  wrap.appendChild(section('属性细则（派生值）', renderAttrDetailPanel()));
  wrap.appendChild(section('豁免检定', renderSavesPanel()));
  wrap.appendChild(section('防御（护甲 / 伤害减免）', renderDefensePanel()));
  wrap.appendChild(section('基础攻击方式', renderBaseAttackDetail()));
  wrap.appendChild(section('敏感范围', renderSensitiveRangeDetail()));
  wrap.appendChild(section('基因锁熟练度', renderGeneLockDetail()));
  return wrap;
}

/* ------------------------- 派生值面板 -------------------------
 * 规则来源：基础规则.docx
 *   生命值 = 5(基础) + 耐力检定值 + 传奇耐力增值 ⌊N(N+1)/2⌋
 *   意志力 = 决心检定值 + 沉着检定值 + 传奇决心×3
 *   先攻值 = 敏捷检定值 + 沉着检定值 + 传奇沉着×3
 *   移动力 = 5(基础) + 力量检定值 + 敏捷检定值 + 传奇敏捷×3
 *   豁免 DP = 对应属性检定值 + 对应技能检定值 + 传奇对应属性×3
 *      反射豁免：敏捷 + 运动；意志豁免：决心 + 感受；强韧豁免：耐力 + 求生
 */

function derivedValues() {
  const leg = (id) => attrLegendary(id);
  const tri = (id) => leg(id) * 3;
  const shape = (id) => Math.floor((leg(id) * (leg(id) + 1)) / 2); // N(N+1)/2
  return {
    // 移动力/先攻值/意志力/生命值：按 Excel 用「属性值」(基础+内在+修行)
    health: 5 + attrPool('stamina') + shape('stamina'),
    willpower: attrPool('resolve') + attrPool('presence') + tri('resolve') + leg('presence'),
    initiative: attrPool('dexterity') + attrPool('presence') + tri('presence'),
    movement: 5 + attrPool('strength') + attrPool('dexterity') + tri('dexterity'),
    // 豁免：按 Excel 用「检定值」(属性值+器械+完美+其它)
    reflex: attrValue('dexterity') + skillValue('athletics') + tri('dexterity'),
    willSave: attrValue('resolve') + skillValue('empathy') + tri('resolve'),
    fortitude: attrValue('stamina') + skillValue('survival') + tri('stamina'),
  };
}

function renderDerivedPanel() {
  const d = derivedValues();
  const grid = el('div', { class: 'derived-grid' });
  const cell = (label, value, hint = '') => {
    const c = el('div', { class: 'derived-cell' });
    c.appendChild(el('span', { class: 'derived-label', text: label }));
    c.appendChild(el('span', { class: 'derived-value', text: value }));
    if (hint) c.appendChild(el('span', { class: 'derived-hint', text: hint }));
    return c;
  };

  grid.appendChild(cell('生命值', d.health, '5 + 耐力 + 传奇耐力增值 ⌊N(N+1)/2⌋'));
  grid.appendChild(cell('意志力', d.willpower, '决心 + 沉着 + 传奇决心×3'));
  grid.appendChild(cell('先攻值', d.initiative, '敏捷 + 沉着 + 传奇沉着×3'));
  grid.appendChild(cell('移动力', d.movement, '5 + 力量 + 敏捷 + 传奇敏捷×3'));

  const wrap = el('div', { class: 'derived-panel' });
  wrap.appendChild(grid);
  wrap.appendChild(el('h4', { class: 'derived-subhead', text: '豁免检定 DP（传奇对应属性×3）' }));
  const saveGrid = el('div', { class: 'derived-grid' });
  saveGrid.appendChild(cell('反射豁免', d.reflex, '敏捷 + 运动'));
  saveGrid.appendChild(cell('意志豁免', d.willSave, '决心 + 感受'));
  saveGrid.appendChild(cell('强韧豁免', d.fortitude, '耐力 + 求生'));
  wrap.appendChild(saveGrid);
  return wrap;
}

/* ------------------------- 【法术列表】面板 ------------------------- */

// 施法基础检定 = 智力检定值 + 神秘学检定值 + 加成栏总和
function spellBaseDP() {
  const bonusSum = (character.spellBaseBonuses || []).reduce((s, b) => s + (Number(b) || 0), 0);
  return attrValue('intelligence') + skillValue('occult') + bonusSum;
}

function spellDamageCap(spell) {
  const specBonus = Number(spell.specialty || 0) > 0 ? 1 : 0;
  const dmgBonusSum = (spell.dmgBonuses || []).reduce((s, b) => s + (Number(b) || 0), 0);
  return (
    Number(attrsOf('intelligence').base) +
    Number(character.skills.occult.base) +
    specBonus +
    attrLegendary('intelligence') * 2 +
    dmgBonusSum
  );
}

function spellCheckDP(spell) {
  const bonusSum = (spell.bonuses || []).reduce((s, b) => s + (Number(b) || 0), 0);
  return spellBaseDP() + (Number(spell.potency) || 0) + (Number(spell.specialty) || 0) + bonusSum;
}

/** 施法基础检定栏（参照 Excel「法术列表&法术预设」A1-L4：
 *  总计 | 智力 | 神秘学 | 加成1..6，默认置顶，样式与下方法术行统一，无备注栏。） */
function renderSpellBaseBox() {
  const base = el('div', { class: 'spell-base-card' });
  base.appendChild(el('div', { class: 'spell-base-card-title', text: '施法基础检定' }));

  const table = el('table', { class: 'dyn-table spell-base-table' });
  // 表头行
  const head = el('tr');
  head.appendChild(el('th', { text: '总计' }));
  head.appendChild(el('th', { text: '智力' }));
  head.appendChild(el('th', { text: '神秘学' }));
  for (let k = 1; k <= 6; k++) head.appendChild(el('th', { text: '加成' + k }));
  table.appendChild(head);

  // 数值行
  const row = el('tr');
  row.appendChild(el('td', { class: 'calc-col total-cell' }));
  const readOnlyCell = (value) => {
    const td = el('td');
    const input = numberInput({ value, onChange: () => {} });
    input.disabled = true;
    td.appendChild(input);
    return td;
  };
  row.appendChild(readOnlyCell(attrValue('intelligence'))); // 智力检定值
  row.appendChild(readOnlyCell(skillValue('occult'))); // 神秘学检定值
  (character.spellBaseBonuses || []).forEach((b, k) => {
    const td = el('td');
    td.appendChild(numberInput({
      value: b,
      onChange: (v) => {
        character.spellBaseBonuses[k] = v;
        refreshBase();
        refreshAllSpellCells();
      },
    }));
    row.appendChild(td);
  });
  table.appendChild(row);
  base.appendChild(table);

  function refreshBase() {
    const total = row.querySelector('.total-cell');
    if (total) total.textContent = spellBaseDP();
  }
  refreshBase();
  return base;
}

/** 刷新所有法术行的「基础值」与计算列（基础检定变时调用）。 */
function refreshAllSpellCells() {
  document.querySelectorAll('.dyn-table tbody tr').forEach((tr) => {
    const baseCell = tr.querySelector('.base-value-cell');
    if (baseCell) baseCell.textContent = spellBaseDP();
    const dp = tr.querySelector('.spell-dp');
    if (dp) dp.textContent = spellCheckDPFromIndex(tr.dataset.index);
  });
}

// 由行索引读取（用于基础检定变化后整体刷新）
function spellByIndex(index) {
  return character.spells[Number(index)];
}
function spellCheckDPFromIndex(index) {
  const spell = spellByIndex(index);
  if (!spell) return '';
  return spellCheckDP(spell);
}

function renderSpellTable(container) {
  container.innerHTML = '';
  container.appendChild(renderSpellBaseBox());

  const addBtnBar = el('div', { class: 'add-bar' });
  addBtnBar.appendChild(el('span', { class: 'add-hint', text: '检定 DP = 基础值 + 法术威力 + 专业 + 加成 ｜ 伤害上限 = 智力 + 神秘学 + 专业 + 传奇智力×2 + 伤害加成' }));
  addBtnBar.appendChild(actionButton('＋ 添加一行', { action: 'add-spell' }));
  container.appendChild(addBtnBar);

  const table = el('table', { class: 'dyn-table dyn-table-wide' });
  table.appendChild(
    renderTitleRow(
      ['名称', '检定DP', '基础值', '法术威力', '耗能', '专业',
        '加成1', '加成2', '加成3', '加成4', '加成5', '加成6',
        '伤害上限', '伤害加成1', '伤害加成2', '伤害加成3',
        '附加效果', '']
    )
  );
  table.appendChild(el('tbody', { id: 'spell-body' }));
  container.appendChild(table);

  character.spells.forEach((spell, i) => {
    table.querySelector('tbody').appendChild(renderSpellRow(spell, i));
  });

  if (!character.spells.length) {
    container.appendChild(el('p', { class: 'empty-hint', text: '当前还没有法术，点击「＋ 添加一行」开始。' }));
  }
}

function renderSpellRow(spell, index) {
  const tr = el('tr');
  tr.setAttribute('data-index', index);

  // 列顺序与表头一致：
  // 名称|检定DP|基础值|法术威力|耗能|专业|加成1..6|伤害上限|伤害加成1..3|附加效果|删除
  function numCell(value, onChange) {
    const td = el('td');
    td.appendChild(numberInput({ value, onChange }));
    return td;
  }

  const nameTd = el('td', { class: 'name-col' });
  nameTd.appendChild(textInput({ value: spell.name, onChange: (v) => (spell.name = v) }));
  tr.appendChild(nameTd);

  tr.appendChild(el('td', { class: 'calc-col spell-dp' }));
  // 基础值（只读，自动取施法基础检定）
  tr.appendChild(el('td', { class: 'base-value-cell', text: spellBaseDP() }));

  tr.appendChild(numCell(spell.potency, (v) => { spell.potency = v; refreshCalc(); }));
  tr.appendChild(numCell(spell.cost, (v) => (spell.cost = v)));
  tr.appendChild(numCell(spell.specialty, (v) => { spell.specialty = v; refreshCalc(); }));

  for (let k = 0; k < 6; k++) {
    tr.appendChild(numCell(spell.bonuses[k], (v) => { spell.bonuses[k] = v; refreshCalc(); }));
  }

  tr.appendChild(el('td', { class: 'calc-col damage-cap' }));
  for (let k = 0; k < 3; k++) {
    tr.appendChild(numCell(spell.dmgBonuses[k], (v) => { spell.dmgBonuses[k] = v; refreshCalc(); }));
  }

  const effectTd = el('td', { class: 'effect-col' });
  effectTd.appendChild(textarea({ value: spell.effect, placeholder: '附加效果', onChange: (v) => (spell.effect = v) }));
  tr.appendChild(effectTd);

  const delTd = el('td', { class: 'del-col' });
  delTd.appendChild(el('button', { class: 'del-btn', text: '✕', dataset: { action: 'del-row', kind: 'spell', index } }));
  tr.appendChild(delTd);

  function refreshCalc() {
    tr.querySelector('.spell-dp').textContent = spellCheckDP(spell);
    tr.querySelector('.damage-cap').textContent = spellDamageCap(spell);
    const baseCell = tr.querySelector('.base-value-cell');
    if (baseCell) baseCell.textContent = spellBaseDP();
  }
  refreshCalc();
  return tr;
}

/* ------------------------- 【特殊攻击预设】面板 ------------------------- */

const ATTR_OPTIONS = ATTRIBUTES.map((a) => ({ value: a.id, label: a.label }));
const SKILL_OPTIONS = SKILLS.map((s) => ({ value: s.id, label: s.label }));

function attackCheckDP(attack) {
  const bonusSum = (attack.bonuses || []).reduce((s, b) => s + (Number(b) || 0), 0);
  return (
    attrValue(attack.attr) +
    skillValue(attack.skill) +
    (Number(attack.weaponDamage) || 0) +
    (Number(attack.specialty) || 0) +
    bonusSum +
    skillExtraSuccess(attack.skill)
  );
}

function renderAttackPanel(container) {
  container.innerHTML = '';
  const addBar = el('div', { class: 'add-bar' });
  addBar.appendChild(el('span', { class: 'add-hint', text: '检定DP = 属性值 + 技能值 + 武器伤害 + 专业 + 加成 + 附加成功' }));
  addBar.appendChild(actionButton('＋ 添加一行', { action: 'add-attack' }));
  container.appendChild(addBar);

  const table = el('table', { class: 'dyn-table tbl-atk' });
  table.appendChild(
    renderTitleRow(['名称', '检定DP', '属性', '技能', '武器伤害', '专业', '加成1', '加成2', '加成3', '加成4', '加成5', '备注', ''])
  );
  const body = el('tbody', { id: 'attack-body' });
  table.appendChild(body);
  container.appendChild(table);

  character.specialAttacks.forEach((atk, i) => body.appendChild(renderAttackRow(atk, i)));
  if (!character.specialAttacks.length) {
    container.appendChild(el('p', { class: 'empty-hint', text: '当前没有特殊攻击预设，点击「＋ 添加一行」开始。' }));
  }
}

function renderAttackRow(atk, index) {
  const tr = el('tr');
  tr.setAttribute('data-index', index);

  const nameTd = el('td', { class: 'name-col' });
  nameTd.appendChild(textInput({ value: atk.name, placeholder: '攻击名', onChange: (v) => (atk.name = v) }));
  tr.appendChild(nameTd);
  tr.appendChild(el('td', { class: 'calc-col atk-dp' }));

  const attrTd = el('td');
  const attrSel = select({
    value: atk.attr,
    options: ATTR_OPTIONS,
    onChange: (v) => { atk.attr = v; refresh(); },
  });
  attrTd.appendChild(attrSel);
  tr.appendChild(attrTd);

  const skillTd = el('td');
  skillTd.appendChild(select({
    value: atk.skill, options: SKILL_OPTIONS,
    onChange: (v) => { atk.skill = v; refresh(); },
  }));
  tr.appendChild(skillTd);

  const dmgTd = el('td');
  dmgTd.appendChild(numberInput({ value: atk.weaponDamage, onChange: (v) => { atk.weaponDamage = v; refresh(); } }));
  tr.appendChild(dmgTd);

  const specTd = el('td');
  specTd.appendChild(numberInput({ value: atk.specialty, onChange: (v) => { atk.specialty = v; refresh(); } }));
  tr.appendChild(specTd);

  for (let k = 0; k < 5; k++) {
    const td = el('td');
    td.appendChild(numberInput({ value: atk.bonuses[k], onChange: (v) => { atk.bonuses[k] = v; refresh(); } }));
    tr.appendChild(td);
  }

  const noteTd = el('td', { class: 'effect-col' });
  noteTd.appendChild(textarea({ value: atk.note, placeholder: '备注（比如此技能替代了某属性/技能）', onChange: (v) => (atk.note = v) }));
  tr.appendChild(noteTd);

  const delTd = el('td', { class: 'del-col' });
  delTd.appendChild(el('button', { class: 'del-btn', text: '✕', dataset: { action: 'del-row', kind: 'attack', index } }));
  tr.appendChild(delTd);

  function refresh() { tr.querySelector('.atk-dp').textContent = attackCheckDP(atk); }
  refresh();
  return tr;
}

/* ------------------------- 【能量池】面板 ------------------------- */

function energyTotal(pool) {
  const bonusSum = (pool.bonuses || []).reduce((s, b) => s + (Number(b) || 0), 0);
  let total = attrValue(pool.attr1) + bonusSum;
  if (pool.attr2) total += attrValue(pool.attr2);
  return total;
}

function renderEnergyPanel(container) {
  container.innerHTML = '';
  const addBar = el('div', { class: 'add-bar' });
  addBar.appendChild(el('span', { class: 'add-hint', text: '总值 = 关键属性1 + 关键属性2(可选) + 加成1 + 加成2 + 加成3 + 加成4 + 加成5' }));
  addBar.appendChild(actionButton('＋ 添加一行', { action: 'add-energy' }));
  container.appendChild(addBar);

  const table = el('table', { class: 'dyn-table tbl-ene' });
  table.appendChild(renderTitleRow(['名称', '总值', '关键属性1', '关键属性2', '加成1', '加成2', '加成3', '加成4', '加成5', '回复方式', '']));
  const body = el('tbody', { id: 'energy-body' });
  table.appendChild(body);
  container.appendChild(table);

  const emptyOpts = [{ value: '', label: '（无）' }, ...ATTR_OPTIONS];
  character.energyPools.forEach((pool, i) => body.appendChild(renderEnergyRow(pool, i, emptyOpts)));
  if (!character.energyPools.length) {
    container.appendChild(el('p', { class: 'empty-hint', text: '当前没有能量池，点击「＋ 添加一行」开始。' }));
  }
}

function renderEnergyRow(pool, index, emptyOpts) {
  const tr = el('tr');
  tr.setAttribute('data-index', index);

  const nameTd = el('td', { class: 'name-col' });
  nameTd.appendChild(textInput({ value: pool.name, onChange: (v) => (pool.name = v) }));
  tr.appendChild(nameTd);
  tr.appendChild(el('td', { class: 'calc-col energy-total' }));

  const attr1Td = el('td');
  attr1Td.appendChild(select({ value: pool.attr1, options: ATTR_OPTIONS, onChange: (v) => { pool.attr1 = v; refresh(); } }));
  tr.appendChild(attr1Td);

  const attr2Td = el('td');
  attr2Td.appendChild(select({ value: pool.attr2 || '', options: emptyOpts, onChange: (v) => { pool.attr2 = v; refresh(); } }));
  tr.appendChild(attr2Td);

  for (let k = 0; k < 5; k++) {
    const td = el('td');
    td.appendChild(numberInput({ value: pool.bonuses[k], onChange: (v) => { pool.bonuses[k] = v; refresh(); } }));
    tr.appendChild(td);
  }

  const recTd = el('td', { class: 'effect-col' });
  recTd.appendChild(textarea({ value: pool.recovery, placeholder: '回复方式与规则，如：每短休回复 2 点等', onChange: (v) => (pool.recovery = v) }));
  tr.appendChild(recTd);

  const delTd = el('td', { class: 'del-col' });
  delTd.appendChild(el('button', { class: 'del-btn', text: '✕', dataset: { action: 'del-row', kind: 'energy', index } }));
  tr.appendChild(delTd);

  function refresh() { tr.querySelector('.energy-total').textContent = energyTotal(pool); }
  refresh();
  return tr;
}

/* ------------------------- 预留面板 ------------------------- */

function renderPlaceholderSection(title, heading, note) {
  return section(title, renderPlaceholder(heading, note));
}
function renderPlaceholder(title, note) {
  const box = el('div', { class: 'placeholder-block' });
  box.appendChild(el('h3', { class: 'placeholder-title', text: title }));
  box.appendChild(el('p', { class: 'placeholder-note', text: note }));
  return box;
}

/* ===== 专长列表（参考 Excel「专长列表」sheet）===== */

function perkAllocation() {
  let used = 0;
  character.perks.forEach((p) => {
    const t = Number(p.tier) || 0;
    for (let i = 1; i <= t; i++) used += i; // 各等级从 1 累加到 tier
  });
  return used;
}

function renderPerkPanel(container) {
  container.innerHTML = '';

  // 建卡专长点核算（可折叠/展开）
  const sumBox = el('div', { class: 'spell-base-box' });
  const sumHead = el('div', { class: 'collapse-head' });
  sumHead.appendChild(el('h3', { class: 'spell-base-title', text: '建卡专长核算' }));
  sumHead.appendChild(el('button', {
    type: 'button',
    class: 'collapse-btn',
    text: '▲',
    title: '折叠 / 展开',
    dataset: { action: 'toggle-perk-box' },
  }));
  sumBox.appendChild(sumHead);

  const sumBody = el('div', { class: 'collapse-body' });
  const row = el('div', { class: 'spell-base-row' });
  row.appendChild(el('span', { class: 'spell-base-item', text: '已用专长点' }));
  row.appendChild(el('span', { class: 'spell-base-op', text: '=' }));
  row.appendChild(el('span', { class: 'spell-base-total perk-used', text: perkAllocation() }));
  row.appendChild(el('span', { class: 'spell-base-item', text: '/ 15' }));
  sumBody.appendChild(row);
  sumBody.appendChild(el('p', { class: 'spell-base-note', text: '分档专长按等级从 1 累加到目标等级计点（如到 3 级 = 1+2+3=6 点）。' }));
  sumBox.appendChild(sumBody);
  container.appendChild(sumBox);

  const addBar = el('div', { class: 'add-bar' });
  addBar.appendChild(el('span', { class: 'add-hint', text: '请将同一专长的不同等级分开填写' }));
  addBar.appendChild(actionButton('＋ 添加一行', { action: 'add-perk' }));
  container.appendChild(addBar);

  const table = el('table', { class: 'dyn-table tbl-perk' });
  table.appendChild(renderTitleRow(['专长等级', '专长名称', '专长信息', '']));
  const body = el('tbody', { id: 'perk-body' });
  table.appendChild(body);
  container.appendChild(table);

  character.perks.forEach((p, i) => body.appendChild(renderPerkRow(p, i)));
  if (!character.perks.length) {
    container.appendChild(el('p', { class: 'empty-hint', text: '当前没有专长，点击「＋ 添加一行」开始。' }));
  }
}

function renderPerkRow(perk, index) {
  const tr = el('tr');
  const tierTd = el('td', { class: 'tier-col' });
  tierTd.appendChild(numberInput({ value: perk.tier, min: 1, onChange: (v) => { perk.tier = v; refreshPool(); } }));
  tr.appendChild(tierTd);

  const nameTd = el('td', { class: 'name-col' });
  nameTd.appendChild(textInput({ value: perk.name, placeholder: '专长名', onChange: (v) => (perk.name = v) }));
  tr.appendChild(nameTd);

  const infoTd = el('td', { class: 'effect-col' });
  infoTd.appendChild(textarea({ value: perk.info, placeholder: '专长信息（效果 / 前置等）', onChange: (v) => (perk.info = v) }));
  tr.appendChild(infoTd);

  const delTd = el('td', { class: 'del-col' });
  delTd.appendChild(el('button', { class: 'del-btn', text: '✕', dataset: { action: 'del-row', kind: 'perk', index } }));
  tr.appendChild(delTd);

  function refreshPool() {
    const eln = document.querySelector('.perk-used');
    if (eln) eln.textContent = perkAllocation();
  }
  return tr;
}

/** 折叠 / 展开建卡专长核算框。 */
function togglePerkBox(btn) {
  const box = btn.closest('.spell-base-box');
  const body = box ? box.querySelector('.collapse-body') : null;
  if (!body) return;
  const hidden = body.classList.toggle('hidden');
  btn.textContent = hidden ? '▼' : '▲';
  btn.title = hidden ? '展开' : '折叠';
}

/* ===== 装备位 & 特性列表（参考 Excel「装备位&特性列表」sheet）===== */

const EQUIP_SLOTS = ['头部', '躯干', '左臂', '右臂', '左手', '右手', '下身', '足部', '背包', '其它'];

function renderGearPanel(container) {
  container.innerHTML = '';
  const addBar = el('div', { class: 'add-bar' });
  addBar.appendChild(el('span', { class: 'add-hint', text: '装备位与装备名称/效果；特性请到「特性」标签页填写（来源 / 描述）' }));
  addBar.appendChild(actionButton('＋ 添加装备', { action: 'add-equip' }));
  container.appendChild(addBar);

  const table = el('table', { class: 'dyn-table tbl-gear' });
  table.appendChild(renderTitleRow(['装备位', '装备名称', '装备效果', '']));
  const body = el('tbody', { id: 'equip-body' });
  table.appendChild(body);
  container.appendChild(table);

  character.equipment.forEach((eq, i) => body.appendChild(renderEquipmentRow(eq, i)));
  if (!character.equipment.length) {
    container.appendChild(el('p', { class: 'empty-hint', text: '当前没有装备，点击「＋ 添加装备」开始。' }));
  }
}

function renderEquipmentRow(eq, index) {
  const tr = el('tr');
  const slotTd = el('td', { class: 'slot-col' });
  slotTd.appendChild(select({ value: eq.slot, options: EQUIP_SLOTS.map((s) => ({ value: s, label: s })), onChange: (v) => (eq.slot = v) }));
  tr.appendChild(slotTd);

  const enameTd = el('td', { class: 'name-col' });
  enameTd.appendChild(textInput({ value: eq.name, placeholder: '装备名', onChange: (v) => (eq.name = v) }));
  tr.appendChild(enameTd);

  const eeffTd = el('td', { class: 'effect-col' });
  eeffTd.appendChild(textarea({ value: eq.effect, placeholder: '装备效果', onChange: (v) => (eq.effect = v) }));
  tr.appendChild(eeffTd);

  const delTd = el('td', { class: 'del-col' });
  delTd.appendChild(el('button', { class: 'del-btn', text: '✕', dataset: { action: 'del-row', kind: 'equip', index } }));
  tr.appendChild(delTd);
  return tr;
}

/* ===== 特性列表（来源 / 描述，点击添加新行）===== */

function renderTraitPanel(container) {
  container.innerHTML = '';
  const addBar = el('div', { class: 'add-bar' });
  addBar.appendChild(el('span', { class: 'add-hint', text: '特性可来自血统、改造、修炼体系、称号等一系列资源' }));
  addBar.appendChild(actionButton('＋ 添加特性', { action: 'add-trait' }));
  container.appendChild(addBar);

  const table = el('table', { class: 'dyn-table tbl-trait' });
  table.appendChild(renderTitleRow(['特性名称', '特性描述', '']));
  const body = el('tbody', { id: 'trait-body' });
  table.appendChild(body);
  container.appendChild(table);

  character.traits.forEach((t, i) => body.appendChild(renderTraitRow(t, i)));
  if (!character.traits.length) {
    container.appendChild(el('p', { class: 'empty-hint', text: '当前没有特性，点击「＋ 添加特性」开始。' }));
  }
}

function renderTraitRow(trait, index) {
  const tr = el('tr');
  const srcTd = el('td', { class: 'name-col' });
  srcTd.appendChild(textInput({ value: trait.source, placeholder: '名称+来源', onChange: (v) => (trait.source = v) }));
  tr.appendChild(srcTd);

  const descTd = el('td', { class: 'effect-col' });
  descTd.appendChild(textarea({ value: trait.desc, placeholder: '特性描述', onChange: (v) => (trait.desc = v) }));
  tr.appendChild(descTd);

  const delTd = el('td', { class: 'del-col' });
  delTd.appendChild(el('button', { class: 'del-btn', text: '✕', dataset: { action: 'del-row', kind: 'trait', index } }));
  tr.appendChild(delTd);
  return tr;
}

/* ===== 资源统计（参考 Excel「资源统计」sheet）===== */

function renderResourcePanel(container) {
  container.innerHTML = '';

  // 未使用资源
  const leftover = character.resources.leftover || { d: '', score: '', xp: '' };
  const sumBox = el('div', { class: 'spell-base-box' });
  sumBox.appendChild(el('h3', { class: 'spell-base-title', text: '未使用资源' }));
  const row = el('div', { class: 'resource-leftover' });
  const lf = (label, key) => {
    const cell = el('label', { class: 'leftover-field' });
    cell.appendChild(el('span', { class: 'field-label', text: label }));
    cell.appendChild(numberInputTxt('', (v) => (leftover[key] = v)));
    return cell;
  };
  // 用文本输入便于填 D+1000 等
  row.appendChild(lf('支线', 'd'));
  row.appendChild(lf('分数', 'score'));
  row.appendChild(lf('xp', 'xp'));
  sumBox.appendChild(row);
  container.appendChild(sumBox);

  // 资源消耗统计
  container.appendChild(el('h3', { class: 'sub-title', text: '资源消耗统计' }));
  const addBar1 = el('div', { class: 'add-bar add-bar-right' });
  addBar1.appendChild(actionButton('＋ 添加一行', { action: 'add-purchase' }));
  container.appendChild(addBar1);
  const t1 = el('table', { class: 'dyn-table tbl-buy' });
  t1.appendChild(renderTitleRow(['价格', '购买内容', '']));
  const b1 = el('tbody', { id: 'purchase-body' });
  t1.appendChild(b1);
  container.appendChild(t1);
  character.resources.purchases.forEach((p, i) => b1.appendChild(renderPurchaseRow(p, i)));
  if (!character.resources.purchases.length) {
    container.appendChild(el('p', { class: 'empty-hint', text: '暂无购买记录。' }));
  }

  // 资源获取记录
  container.appendChild(el('h3', { class: 'sub-title', text: '资源获取记录' }));
  const addBar2 = el('div', { class: 'add-bar add-bar-right' });
  addBar2.appendChild(actionButton('＋ 添加一行', { action: 'add-record' }));
  container.appendChild(addBar2);
  const t2 = el('table', { class: 'dyn-table tbl-rec' });
  t2.appendChild(renderTitleRow(['数量', '来源', '']));
  const b2 = el('tbody', { id: 'record-body' });
  t2.appendChild(b2);
  container.appendChild(t2);
  character.resources.records.forEach((r, i) => b2.appendChild(renderRecordRow(r, i)));
  if (!character.resources.records.length) {
    container.appendChild(el('p', { class: 'empty-hint', text: '暂无获取记录。' }));
  }
}

function numberInputTxt(value, onChange) {
  const input = el('input', { type: 'text', value });
  input.addEventListener('input', (e) => onChange(e.target.value, input));
  return input;
}

function renderPurchaseRow(p, index) {
  const tr = el('tr');
  const pTd = el('td', { class: 'name-col' });
  pTd.appendChild(textInput({ value: p.price, placeholder: '支线+分数', onChange: (v) => (p.price = v) }));
  tr.appendChild(pTd);
  const cTd = el('td', { class: 'effect-col' });
  cTd.appendChild(textarea({ value: p.content, placeholder: '购买内容', onChange: (v) => (p.content = v) }));
  tr.appendChild(cTd);
  const delTd = el('td', { class: 'del-col' });
  delTd.appendChild(el('button', { class: 'del-btn', text: '✕', dataset: { action: 'del-row', kind: 'purchase', index } }));
  tr.appendChild(delTd);
  return tr;
}

function renderRecordRow(r, index) {
  const tr = el('tr');
  const aTd = el('td', { class: 'name-col' });
  aTd.appendChild(textInput({ value: r.amount, placeholder: '支线+分数', onChange: (v) => (r.amount = v) }));
  tr.appendChild(aTd);
  const sTd = el('td', { class: 'effect-col' });
  sTd.appendChild(textarea({ value: r.source, placeholder: '来源（如 主线奖励）', onChange: (v) => (r.source = v) }));
  tr.appendChild(sTd);
  const delTd = el('td', { class: 'del-col' });
  delTd.appendChild(el('button', { class: 'del-btn', text: '✕', dataset: { action: 'del-row', kind: 'record', index } }));
  tr.appendChild(delTd);
  return tr;
}

/* ------------------------- 角色卡内部 sheet 切换 ------------------------- */

function renderSheetTabs() {
  const tabbar = el('nav', { class: 'sheet-tabs' });
  SHEETS.forEach((s) => {
    const tab = el('button', {
      type: 'button',
      class: 'sheet-tab' + (s.id === sheetState.active ? ' active' : ''),
      text: s.label,
      dataset: { action: 'set-sheet', sheet: s.id },
    });
    tabbar.appendChild(tab);
  });
  return tabbar;
}

function renderSheetBody(host) {
  host.innerHTML = '';
  const active = sheetState.active;

  if (active === 'main') host.appendChild(renderMainSheet());
  else if (active === 'attrs') host.appendChild(renderAttrDetailSheet());
  else if (active === 'spells') renderSpellTable(host);
  else if (active === 'attacks') renderAttackPanel(host);
  else if (active === 'energy') renderEnergyPanel(host);
  else if (active === 'perks') renderPerkPanel(host);
  else if (active === 'gear') renderGearPanel(host);
  else if (active === 'traits') renderTraitPanel(host);
  else if (active === 'resources') renderResourcePanel(host);
}

/** 渲染「角色卡」页面（sheet 标签 + 内容区）。 */
function renderCharacterPage() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  app.appendChild(
    el('div', { class: 'char-head' }, [
      el('header', { class: 'masthead' }, [
        el('h1', { text: '鲲版无限角色卡' }),
        el('p', {
          class: 'subtitle',
          text: '目前正在测试中，仅用于UI展示',
        }),
      ]),
      el('button', {
        type: 'button',
        class: 'char-back',
        dataset: { action: 'back-to-characters' },
        text: '← 返回角色管理',
      }),
    ])
  );

  app.appendChild(renderSheetTabs());
  const host = el('div', { class: 'sheet-body' });
  app.appendChild(host);

  renderSheetBody(host);

  // 操作条（导出 / 删除角色卡）
  const actions = el('div', { class: 'action-bar' });
  actions.appendChild(actionButton('导出角色卡', { action: 'save' }));
  actions.appendChild(actionButton('删除角色卡', { action: 'delete-character' }, 'btn-danger'));
  app.appendChild(actions);
}

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

/* ----- 返回确认弹窗（进度不保留） ----- */
function confirmLeaveNewCharacter() {
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
    appState.page = 'characters';
    renderPage();
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

/* ------------------------- 其它页面（规则书 / 其他） ------------------------- */

function renderEmptyPage(title, note) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(
    el('div', { class: 'blank-page' }, [
      el('h2', { text: title }),
      el('p', { class: 'muted', text: note }),
    ])
  );
}

async function renderRulesPage() {
  await renderRulesPageFromModule();
}

function renderOtherPage() {
  renderEmptyPage('其他', '预留页面，暂无内容。');
}

function renderResourcesPage() {
  renderEmptyPage('资源列表', '资源列表页面预留，后续展示后端资源目录（各资源的 bonus 与描述）。');
}

function renderRealmPage() {
  renderEmptyPage('轮回之境', '轮回之境页面预留，后续开发：游戏组 / 房间 / 多单位施效等。');
}

async function renderChangelogPage() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  app.appendChild(
    el('header', { class: 'masthead' }, [
      el('h1', { text: '更新记录' }),
      el('p', { class: 'subtitle', text: '版本与功能更新一览' }),
    ])
  );

  const listEl = el('div', { class: 'changelog-list' });
  app.appendChild(listEl);

  try {
    // 用「相对于站点根」的绝对路径拉取，兼容本地(/)与 GitHub Pages(/InfWebPages/) 子路径部署。
    // 附加一个时间戳参数，规避浏览器/CDN 对旧 changelog.json 的强缓存。
    const res = await fetch(assetPath('content/updates/changelog.json') + '?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const entries = await res.json();
    buildChangelogRows(listEl, entries);
  } catch (err) {
    listEl.appendChild(
      el('div', { class: 'changelog-error' }, [
        el('span', { class: 'muted', text: '更新记录加载失败：' + err.message }),
      ])
    );
  }
}

// 依据当前文档 URL 推导站点根，再拼上相对路径（返回可 fetch 的绝对路径）。
// 兼容：本地 http://host/ 与 GitHub Pages http://host/InfWebPages/ 子路径；即使地址栏缺尾斜杠也能纠正。
function assetPath(relative) {
  let base;
  try {
    base = new URL('.', document.baseURI).href;
  } catch (e) {
    base = location.href;
  }
  // 若解析到的根不含子路径（如地址栏无尾斜杠导致 . 落到上级），改从 location 推导目录
  const url = new URL(base);
  if (!url.pathname.endsWith('/')) {
    const p = (location.pathname.split('?')[0] || '/');
    const dir = p.slice(0, p.lastIndexOf('/') + 1);
    return new URL(dir + relative, location.href).href;
  }
  return new URL(relative, url).href;
}

// 把 changelog 条目渲染进列表容器（同步、可独立测试）。
// 约定：JSON 数组中越靠上方=越旧、越靠下方=越新；页面展示时最新在上（倒序遍历）。
function buildChangelogRows(host, entries) {
  host.innerHTML = '';
  if (!Array.isArray(entries) || !entries.length) {
    host.appendChild(el('p', { class: 'muted', text: '暂无更新记录。' }));
    return;
  }
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    const row = el('div', { class: 'changelog-item' });
    const head = el('div', { class: 'changelog-head' });
    head.appendChild(el('span', { class: 'changelog-title', text: e.title || '' }));
    head.appendChild(el('span', { class: 'changelog-date', text: fmtDate(e.date) }));
    row.appendChild(head);
    const body = el('div', { class: 'changelog-content' });
    // content 支持两种写法：字符串（旧，按 \n 拆段兼容）或数组（新，每个元素一段）。空段自动跳过。
    schemaifyChangelogContent(e.content).forEach((seg) => {
      const t = seg.trim();
      if (!t) return;
      body.appendChild(el('p', { class: 'changelog-paragraph', text: t }));
    });
    if (body.children.length === 0) body.appendChild(el('p', { class: 'changelog-paragraph', text: '' }));
    row.appendChild(body);
    host.appendChild(row);
  }
}

// 把 changelog 的 content 规整成段落数组：数组→按元素；字符串（旧格式）→按 \n 拆且视为单元素兼容。
function schemaifyChangelogContent(content) {
  if (Array.isArray(content)) return content.slice();
  return String(content == null ? '' : content).split(/\r?\n/);
}

// 时间格式化：仅显示年月日（2016-10-09 或 2016/10/09 皆可），空则显示空字符串。
function fmtDate(d) {
  if (!d) return '';
  const s = String(d).trim();
  // 已形如 YYYY-MM-DD
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  return s;
}

/* ------------------------- 主页面（landing） ------------------------- */

/** 主页面：入口欢迎页。应用界面由「进入」按钮进入。 */
function renderLandingPage() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const page = el('div', { class: 'landing' }, [
    el('div', { class: 'landing-hero' }, [
      el('div', { class: 'landing-mark' }, [el('span', { text: '∞' })]),
      el('h1', { class: 'landing-title', text: '鲲版无限网页角色卡' }),
      el('p', { class: 'landing-sub', text: '角色 · 资源 一站式管理' }),
      el('button', { type: 'button', class: 'landing-enter', dataset: { action: 'enter-app', } }, [
        el('span', { text: '进入' }),
        el('span', { class: 'landing-enter-arrow', text: ' →' }),
      ]),
      el('p', { class: 'landing-hint', text: '点击进入开始使用角色卡' }),
    ]),
  ]);
  app.appendChild(page);
  toggleSidebarForScreen();
}

/** 根据 screen 决定是否显示侧边栏：主页面隐藏侧边栏，应用界面显示。 */
function toggleSidebarForScreen() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.classList.toggle('hidden', appState.screen === 'landing');
}

/* ------------------------- 角色管理（characters） ------------------------- */

/** 占位角色清单：后端就绪前用假数据（角色A-F，总资源量 / 生命值 / 归属房间）。 */
function placeholderCharacters() {
  const rows = [
    { resource: '11D+13000', hp: '10+1L+1A', room: '房间1234' },
    { resource: '9D+9000', hp: '7+5L', room: '房间1235' },
    { resource: '12D+15000', hp: '12+2L+2A', room: '房间1236' },
    { resource: '8D+7000', hp: '6+1L', room: '房间1234' },
    { resource: '10D+11000', hp: '11+3L', room: '房间1237' },
    { resource: '13D+18000', hp: '9+4L+1A', room: '房间1235' },
  ];
  return rows.map((r, i) => ({
    id: 'C' + (i + 1),
    name: '角色' + String.fromCharCode(65 + i), // 角色A-F
    resource: r.resource,
    hp: r.hp,
    room: r.room,
  }));
}

/**
 * 渲染「角色管理」页面：按行展示拥有的角色卡（占位数据）。
 * 点击行 → 打开对应角色卡；右下角悬浮「+」新建按钮。
 */
function renderCharactersPage() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  app.appendChild(
    el('header', { class: 'masthead' }, [
      el('h1', { text: '角色管理' }),
      el('p', { class: 'subtitle', text: '选择要打开的角色卡，或新建一个角色' }),
    ])
  );

  const chars = placeholderCharacters();
  const list = el('div', { class: 'char-list' });
  chars.forEach((c) => {
    const row = el('button', { type: 'button', class: 'char-row', dataset: { charId: c.id } }, [
      el('span', { class: 'char-name', text: c.name }),
      el('div', { class: 'char-meta' }, [
        el('span', { class: 'char-kv' }, [
          el('em', { class: 'char-kv-label', text: '总资源' }),
          el('span', { class: 'char-resource', text: c.resource }),
        ]),
        el('span', { class: 'char-kv' }, [
          el('em', { class: 'char-kv-label', text: '生命值' }),
          el('span', { class: 'char-hp', text: c.hp }),
        ]),
        el('span', { class: 'char-kv' }, [
          el('em', { class: 'char-kv-label', text: '归属房间' }),
          el('span', { class: 'char-room', text: c.room }),
        ]),
      ]),
      el('span', { class: 'char-open', text: '点击查看' }),
    ]);
    list.appendChild(row);
  });
  app.appendChild(list);
  app.appendChild(el('div', { class: 'char-empty-note', text: '（以上为占位数据仅作展示）' }));

  // 右下角悬浮「导入角色卡」（在「＋ 新建」左侧）+「新建角色」按钮
  const importBtn = el('button', {
    type: 'button',
    class: 'fab fab-import',
    dataset: { action: 'open-import' },
    title: '导入角色卡',
    ariaLabel: '导入角色卡',
  });
  importBtn.appendChild(el('span', { class: 'fab-import-icon', text: '⬇' }));
  app.appendChild(importBtn);

  // 右下角悬浮「新建角色」按钮
  const fab = el('button', {
    type: 'button',
    class: 'fab',
    dataset: { action: 'new-character' },
    title: '新建角色',
    ariaLabel: '新建角色',
  });
  fab.appendChild(el('span', { class: 'fab-plus', text: '+' }));
  app.appendChild(fab);
}

/* ------------------------- 应用级页面路由 ------------------------- */

function renderPage() {
  toggleSidebarForScreen();

  // 主页面：只显示 landing，不渲染应用内页面（也避免高亮菜单项）
  if (appState.screen === 'landing') {
    // 回到主界面即清除已保存的应用内位置，下次刷新仍为主界面
    try { localStorage.removeItem(APPSTATE_KEY); } catch (e) {}
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

function deleteRow(kind, index) {
  if (kind === 'spell') character.spells.splice(index, 1);
  else if (kind === 'attack') character.specialAttacks.splice(index, 1);
  else if (kind === 'energy') character.energyPools.splice(index, 1);
  else if (kind === 'perk') character.perks.splice(index, 1);
  else if (kind === 'equip') character.equipment.splice(index, 1);
  else if (kind === 'trait') character.traits.splice(index, 1);
  else if (kind === 'purchase') character.resources.purchases.splice(index, 1);
  else if (kind === 'record') character.resources.records.splice(index, 1);
  renderPage();
}

/* ------------------------- 全局事件绑定（事件委托） ------------------------- */

function setupGlobalEvent() {
  document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('[data-action="toggle-sidebar"]');
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
      confirmLeaveNewCharacter();
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
    else if (act === 'remove-reduction') removeReductionRow(Number(btn.dataset.index));
    else if (act === 'toggle-perk-box') togglePerkBox(btn);
    else if (act === 'del-row') deleteRow(btn.dataset.kind, Number(btn.dataset.index));
  });
}

let flashTimer = null;
function flash(msg) {
  let tip = document.getElementById('flash');
  if (!tip) {
    tip = el('div', { id: 'flash', class: 'flash' });
    document.body.appendChild(tip);
  }
  tip.textContent = msg;
  tip.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => tip.classList.remove('show'), 1600);
}

/* ------------------------- 启动 ------------------------- */

async function boot() {
  const saved = await api.load();
  if (saved) character = saved;

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
