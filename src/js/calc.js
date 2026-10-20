/**
 * calc.js
 * 全部规则计算（纯函数，无 DOM）：输入是 character（读取自 state.js），输出为数值/字符串。
 *
 * 规则来源：基础规则.docx / 角色属性信息表。前端只做展示，计算集中在此便于核对与未来后端化。
 * 仅依赖 state.js（读取 character）；不含任何渲染/事件逻辑。
 */
import { character } from './state.js';
import { ATTRIBUTES, BASE_ATTACK_PRESETS } from './character-config.js';

/* ------------------------- 属性 / 技能基础计算 ------------------------- */

// 属性 id → 在 store.attributes 各数组中的下标（ATTRIBUTES 顺序）
function attrIndexOf(attrId) {
  return ATTRIBUTES.findIndex((a) => a.id === attrId);
}
// 属性「基础」（建卡点）
function attrBaseOf(attrId) {
  const i = attrIndexOf(attrId);
  return i >= 0 && character.attributes.base ? Number(character.attributes.base[i]) || 0 : 0;
}

/* 属性两档（对照 Excel 角色属性信息表）：
 *   属性值 attrPool  = 基础 + 属性值加值(内在/修行) − 属性减值
 *   检定值 attrValue = 属性值 + 检定值加值(内在/修行/器械/完美/士气/其它) − 检定减值
 *   传奇   = ⌊(属性值 - 1) / 5⌋
 * 属性值加值与检定值加值是两套独立来源，分别存在 store.attributes.poolBonus / checkBonus（按属性顺序、全属性共用来源名）。
 */
function sum(arr) {
  return (arr || []).reduce((s, b) => s + (Number(b) || 0), 0);
}
// 该属性的「属性值加值」总和（poolBonus[idx]）
function attrPoolBonusSum(attrId) {
  const i = attrIndexOf(attrId);
  return sum(character.attributes.poolBonus[i]);
}
// 该属性的「检定值加值」总和（checkBonus[idx]）
function attrCheckBonusSum(attrId) {
  const i = attrIndexOf(attrId);
  return sum(character.attributes.checkBonus[i]);
}
// 属性减值 / 检定减值（按属性顺序存于 store.attributes.penalty / checkPenalty）
function attrPenaltyOf(attrId) {
  const i = attrIndexOf(attrId);
  return i >= 0 && character.attributes.penalty ? Number(character.attributes.penalty[i]) || 0 : 0;
}
function checkPenaltyOf(attrId) {
  const i = attrIndexOf(attrId);
  return i >= 0 && character.attributes.checkPenalty ? Number(character.attributes.checkPenalty[i]) || 0 : 0;
}

function attrPool(attrId) {
  return attrBaseOf(attrId) + attrPoolBonusSum(attrId) - attrPenaltyOf(attrId);
}

function attrValue(attrId) {
  return attrPool(attrId) + attrCheckBonusSum(attrId) - checkPenaltyOf(attrId);
}

function attrLegendary(attrId) {
  return Math.floor((attrPool(attrId) - 1) / 5);
}

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

// n+m 显示：m(=附加成功) 为 0 时隐藏 +m，仅显示 n
function nm(n, m) {
  return Number(m) > 0 ? `${n}+${m}` : `${n}`;
}

// 基础攻击：把 store 中的可变数据与静态预设（BASE_ATTACK_PRESETS）合并成渲染/计算用的完整对象
function resolveBaseAttack(atk) {
  const preset = BASE_ATTACK_PRESETS.find((p) => p.id === atk.id) || {};
  return { ...preset, ...atk };
}
function baseAttackData(atk) {
  atk = resolveBaseAttack(atk);
  const skillV = skillValue(atk.skill);
  const wdmg = atk.weaponDamage != null ? Number(atk.weaponDamage) : 0;
  const ammo = atk.ammoDamage != null ? Number(atk.ammoDamage) : 0;
  const ammoCount = atk.ammoCount != null ? Number(atk.ammoCount) : 0;
  const hasAmmo = atk.id === 'semi' || atk.id === 'full' || atk.id === 'bow';
  const bonusSum = sum(atk.bonuses) + (Number(atk.other) || 0);

  // —— 检定 DP ——
  let checkDP;
  if (atk.id === 'full') {
    // 全自动（后端 §3.4）：((武器伤+弹药伤)×弹药数) + ⌊(P敏+P力)/2⌋ + S枪械 + 专业 + Σ加成 + 其他
    const poolAvg = Math.floor((attrPool('dexterity') + attrPool('strength')) / 2);
    checkDP = (wdmg + ammo) * ammoCount + poolAvg + skillV + (Number(atk.specialty) || 0) + sum(atk.bonuses) + (Number(atk.other) || 0);
  } else {
    // 白刃/肉搏/半自动/弓（后端 §3.7）：V(主) + S + 专业 + 武器伤害(+弹药) + Σ加成 + 其他
    const addDmg = wdmg + (hasAmmo ? ammo : 0);
    checkDP = attrValue(atk.attr) + skillV + addDmg + (Number(atk.specialty) || 0) + bonusSum;
  }

  // —— 伤害上限（只读公式，后端 §3.1）：P(主) + S + 2×L(主) + 其他；枪械/弓 + 弹药伤害（不加成、不乘弹药数）——
  const damageCap =
    attrPool(atk.attr) + skillV + attrLegendary(atk.attr) * 2 + (Number(atk.other) || 0) +
    (hasAmmo ? ammo : 0);

  // 附加成功 m = 技能附加 + 传奇 + 附加加值1..6（与豁免口径一致：n 侧加成不重复计入 m）
  const extraSuccess = skillExtraSuccess(atk.skill) + attrLegendary(atk.attr) + sum(atk.extraSuccessBonus);
  return { label: atk.label, checkDP, damageCap, extraSuccess };
}

function sensitiveRangeTotal() {
  const dd = character.derivedDetail.sensitive;
  return (
    attrPool('perception') * 10 + attrLegendary('perception') * 20 +
    (dd.bonus || []).reduce((s, b) => s + (Number(b) || 0), 0)
  );
}

/* ------------------------- 豁免 ------------------------- */

const SAVE_DEFS = [
  { name: '反射豁免', attr: 'dexterity', skill: 'athletics', attrName: '敏捷', skillName: '运动', legName: '传奇敏捷' },
  { name: '意志豁免', attr: 'resolve', skill: 'empathy', attrName: '决心', skillName: '感受', legName: '传奇决心' },
  { name: '强韧豁免', attr: 'stamina', skill: 'survival', attrName: '耐力', skillName: '求生', legName: '传奇耐力' },
];

// 单个豁免的「附加成功 m」= 技能附加成功 + 主属性传奇附加成功 + 附加加值1..6(bonus[i][6..11])
function saveExtraSuccess(i) {
  const dd = character.derivedDetail.saves;
  const b = dd.bonus[i];
  return (
    skillExtraSuccess(SAVE_DEFS[i].skill) + attrLegendary(SAVE_DEFS[i].attr) +
    (Number(b[6]) || 0) + (Number(b[7]) || 0) + (Number(b[8]) || 0) +
    (Number(b[9]) || 0) + (Number(b[10]) || 0) + (Number(b[11]) || 0)
  );
}

// 单个豁免的「总计 n」（不含附加成功）：
// 属性检定 + 技能检定 + 传奇属性×3 + 专业 + 专长 + 加成1..6(bonus[i][0..5])
function saveTotalOf(i) {
  const s = SAVE_DEFS[i];
  const dd = character.derivedDetail.saves;
  const b = dd.bonus[i];
  return (
    attrValue(s.attr) + skillValue(s.skill) + attrLegendary(s.attr) * 3 +
    (Number(dd.special[i]) || 0) + (Number(dd.feat[i]) || 0) +
    (Number(b[0]) || 0) + (Number(b[1]) || 0) + (Number(b[2]) || 0) +
    (Number(b[3]) || 0) + (Number(b[4]) || 0) + (Number(b[5]) || 0)
  );
}

// 豁免总值显示为「n+m」：n = 总计，m = 附加成功；m=0 时隐藏 +m
function saveDisplayOf(i) {
  return nm(saveTotalOf(i), saveExtraSuccess(i));
}

/*
 * 加成栏显示名（前端展示用；存储仍为数字数组，按序号对应）：
 *   DERIVED_BONUS_LABELS  —— 属性派生/豁免的「加成1..6」= 内在/修行/器械/完美/士气/其它（专长走独立 feat 字段）
 *   FEAT_BONUS_LABELS     —— 敏感范围/基础攻击/特殊攻击/能量池的「加成」= 专长/内在/修行/器械/完美/士气/其它（7，专长为 index0）
 *   EXTRA_SUCCESS_LABELS  —— 豁免/攻击的「附加加值1..6」= (附加)内在/修行/器械/完美/士气/其它（仅首项标注附加；不含专长）
 *   SPELL_BONUS_LABELS    —— 法术「加成」= 专长/内在/修行/器械/完美/士气/其它（n 侧，7）
 */
const DERIVED_BONUS_LABELS = ['内在', '修行', '器械', '完美', '士气', '其它'];
const FEAT_BONUS_LABELS = ['专长', '内在', '修行', '器械', '完美', '士气', '其它'];
const EXTRA_SUCCESS_LABELS = ['(附加)内在', '修行', '器械', '完美', '士气', '其它'];
const SPELL_BONUS_LABELS = FEAT_BONUS_LABELS;

/* ------------------------- 攻击 / 能量池 ------------------------- */

function attackCheckDP(attack) {
  const bonusSum = (attack.bonuses || []).reduce((s, b) => s + (Number(b) || 0), 0);
  return (
    attrValue(attack.attr) +
    skillValue(attack.skill) +
    (Number(attack.weaponDamage) || 0) +
    (Number(attack.specialty) || 0) +
    bonusSum
  );
}

function energyTotal(pool) {
  const bonusSum = sum(pool.bonuses);
  // 后端 §3.3：用属性池 P（attrPool），不是检定值 V
  let total = attrPool(pool.attr1) + bonusSum;
  if (pool.attr2) total += attrPool(pool.attr2);
  return total;
}

export {
  attrPool,
  attrValue,
  attrLegendary,
  attrBaseOf,
  attrPenaltyOf,
  checkPenaltyOf,
  resolveBaseAttack,
  baseAttackData,
  skillValue,
  skillExtraSuccess,
  nm,
  sensitiveRangeTotal,
  SAVE_DEFS,
  saveExtraSuccess,
  saveTotalOf,
  saveDisplayOf,
  DERIVED_BONUS_LABELS,
  FEAT_BONUS_LABELS,
  EXTRA_SUCCESS_LABELS,
  SPELL_BONUS_LABELS,
  attackCheckDP,
  energyTotal,
};