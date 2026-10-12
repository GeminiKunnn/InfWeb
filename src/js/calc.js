/**
 * calc.js
 * 全部规则计算（纯函数，无 DOM）：输入是 character（读取自 state.js），输出为数值/字符串。
 *
 * 规则来源：基础规则.docx / 角色属性信息表。前端只做展示，计算集中在此便于核对与未来后端化。
 * 仅依赖 state.js（读取 character）；不含任何渲染/事件逻辑。
 */
import { character } from './state.js';

/* ------------------------- 属性 / 技能基础计算 ------------------------- */

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

/* ------------------------- 攻击 / 能量池 ------------------------- */

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

function energyTotal(pool) {
  const bonusSum = (pool.bonuses || []).reduce((s, b) => s + (Number(b) || 0), 0);
  let total = attrValue(pool.attr1) + bonusSum;
  if (pool.attr2) total += attrValue(pool.attr2);
  return total;
}

export {
  attrsOf,
  attrPool,
  attrValue,
  attrLegendary,
  skillValue,
  skillExtraSuccess,
  nm,
  baseAttackData,
  sensitiveRangeTotal,
  SAVE_DEFS,
  saveExtraSuccess,
  saveTotalOf,
  saveDisplayOf,
  attackCheckDP,
  energyTotal,
};