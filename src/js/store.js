/**
 * store.js
 * -----------------------------------------------------------------------------
 * 极简状态存储层（store）。
 *
 * 职责：
 *   1. 维护一个 character 状态对象（概念段 + 属性 + 技能）。
 *   2. 提供 load() / save()，当前把数据持久化到浏览器 localStorage。
 *   3. 预留 api 接口（get/save）作为「未来后端」的接入点：
 *        - 现在不接后端，save 走 localStorage；
 *        - 将来接后端时，只需把 saveToStorage 换成 fetch 调用即可，
 *          页面其它代码零改动。
 *
 * 迁移到 Vue 时：本模块的 character 状态可直接作为 Vue 的
 * reactive/ref 状态，或作为 Pinia store 的 state 复用。
 */

import { ATTRIBUTES, SKILLS, ATTRIBUTE_POOL_BONUS_LABELS, ATTRIBUTE_CHECK_BONUS_LABELS, BASE_ATTACK_PRESETS } from './character-config.js';

const STORAGE_KEY = 'infrole.character.v1';

function emptyCharacter() {
  // 属性：全部按 ATTRIBUTES 顺序存数组。
  //   base        [9]  属性值基础（建卡点）
  //   poolBonus   [9][n] 属性值加值（n = 属性值加值来源数：内在/修行）
  //   checkBonus  [9][m] 检定值加值（m = 检定值加值来源数：内在/修行/器械/完美/士气/其它）
  //   penalty / checkPenalty     [9]  属性减值 / 检定减值
  const N = ATTRIBUTES.length;
  const poolBonus = [];
  const checkBonus = [];
  for (let i = 0; i < N; i++) {
    poolBonus.push(ATTRIBUTE_POOL_BONUS_LABELS.map(() => 0));
    checkBonus.push(ATTRIBUTE_CHECK_BONUS_LABELS.map(() => 0));
  }
  const attrs = {
    base: ATTRIBUTES.map((a) => a.default),
    poolBonus,
    checkBonus,
    penalty: new Array(N).fill(0),
    checkPenalty: new Array(N).fill(0),
  };

  const skills = {};
  SKILLS.forEach((s) => {
    skills[s.id] = { base: s.default, inner: 0, practice: 0, gear: 0, perfect: 0, morale: 0, other: 0 };
  });

  return {
    meta: {
      version: '0.1.0',
      updatedAt: null,
    },
    concepts: {
      name: '',
      gender: '',
      race: '',
      age: '',
      build: '', // 身高体重
      appearance: '',
      background: '',
      totalResources: '', // 总资源量
    },
    attributes: attrs,
    skills: skills,
    // —— 可动态增删行的列表（在角色卡内用「表单切换」切换）——
    spells: [], // 法术列表 & 法术预设
    spellBaseBonuses: [0, 0, 0, 0, 0, 0, 0], // 施法基础检定栏的 7 个加成位（专长/内在/修行/器械/完美/士气/其它）
    specialAttacks: [], // 特殊攻击预设
    energyPools: [], // 能量池
    perks: [], // 专长列表
    equipment: [], // 装备位（特性已独立到 traits）
    ownedResources: [], // 已拥有资源（拥有凭证：{ resourceId, level, qty, option, instanceId, specialAttackId }）
    traits: [], // 特性列表（来源 / 描述）
    resources: {
      purchases: [], // 资源消耗统计（价格 / 内容）
      leftover: { d: '', score: '', xp: '' }, // 未使用资源（支线/分数/xp）
      records: [], // 资源获取记录（数量 / 来源）
    },
    // —— 角色总览 / 角色属性页（参考 Excel「角色属性」sheet 底部）——
    geneLock: 0, // 基因锁熟练度（基础值）
    hpSlots: { intact: 0, b: 0, l: 0, a: 0, temp: 0 }, // 生命值各状态点数
    otherInfo: { range: '', sensitive: '' }, // 范围 / 敏感范围
    defense: {
      armor: { innate: 0, base: 0, armor: 0, block: 0, insight: 0, other: 0 }, // 护甲各来源
      reduction: [], // 伤害减免列表：{type, amount, source}
    },
    derivedDetail: {
      // 属性细则各派生项的加成栏：唯一 bonus[7]（index0=专长，1-6=内在/修行/器械/完美/士气/其它），不再有独立 feat 字段
      movement: { bonus: [0, 0, 0, 0, 0, 0, 0] },
      initiative: { bonus: [0, 0, 0, 0, 0, 0, 0] },
      willpower: { bonus: [0, 0, 0, 0, 0, 0, 0] },
      health: { bonus: [0, 0, 0, 0, 0, 0, 0] },
      saves: {
        special: [0, 0, 0], // 豁免1-3 的专业
        feat: [0, 0, 0], // 豁免1-3 的专长
        // 豁免1-3 的加值：每豁免一项 12 位数组 = 加成1-6(内在/修行/器械/完美/士气/其它) + 附加加值1-6
        bonus: [
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 反射豁免
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 意志豁免
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 强韧豁免
        ],
      },
      sensitive: { bonus: [0, 0, 0, 0, 0, 0, 0] }, // 敏感范围：专长/内在/修行/器械/完美/士气/其它（7）
    },
    baseAttacks: BASE_ATTACK_PRESETS.map((p) => {
      // 仅存用户可变数据；静态预设（label/attr/skill、弹药输入规则）见 BASE_ATTACK_PRESETS，按 id 关联。
      // 弹药伤害/弹药数为可选可变输入：仅预设声明 ammoDamage/ammoCount 的攻击带这两个字段。
      const d = { id: p.id, weaponDamage: 0, specialty: 0, bonuses: [0, 0, 0, 0, 0, 0, 0], other: 0, effect: '', extraSuccessBonus: [0, 0, 0, 0, 0, 0] };
      if (p.ammoDamage) d.ammoDamage = 0;
      if (p.ammoCount) d.ammoCount = 1;
      return d;
    }),
    // —— 预留 ——
    derived: {}, // 未来：生命值 / 意志 / 先攻 / 移动力 / 豁免等
  };
}

/** 可动态增删行的「新行」默认结构。 */
// 内部稳定 id 生成：优先 crypto.randomUUID()，否则退化为随机 hex（无 crypto 的测试/harness 下可用）。
function newUid(prefix) {
  const c = typeof crypto !== 'undefined' ? crypto : null;
  const raw = (c && typeof c.randomUUID === 'function')
    ? c.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`;
  return `${prefix}_${raw}`;
}

function newSpell() {
  return {
    id: newUid('spell'),
    name: '法术',
    potency: 0, // 法术威力
    cost: 0, // 耗能
    specialty: 0, // 专业
    bonuses: [0, 0, 0, 0, 0, 0, 0], // 检定加成（专长/内在/修行/器械/完美/士气/其它，n 侧）
    extraSuccessBonus: [0, 0, 0, 0, 0, 0], // 附加加值 1..6（m 侧，(附加)内在/修行/…）
    effect: '',
  };
}
function newAttack() {
  return {
    id: newUid('special'),
    name: '攻击',
    note: '',
    attr: 'strength',
    skill: 'brawl',
    weaponDamage: 0,
    specialty: 0,
    bonuses: [0, 0, 0, 0, 0, 0, 0], // 检定加成（专长/内在/修行/器械/完美/士气/其它，n 侧）
    extraSuccessBonus: [0, 0, 0, 0, 0, 0], // 附加加值 1..6（m 侧，(附加)内在/修行/…）
  };
}
function newEnergyPool() {
  return { id: newUid('pool'), name: '能量池', attr1: 'intelligence', attr2: '', bonuses: feat7(), recovery: '' };
}
function newOwnedResource() {
  return { resourceId: '', instanceId: newUid('res'), qty: 1, level: 1, option: '', specialAttackId: '' };
}
function newPerk() {
  return { tier: 1, name: '', info: '' };
}
function newEquipment() {
  return { slot: '其它', name: '', effect: '', resourceId: '', instanceId: '' };
}
function newTrait() {
  return { source: '', desc: '' };
}
function newPurchase() {
  return { price: '', content: '' };
}
function newRecord() {
  return { amount: '', source: '' };
}
function newReduction() {
  return { type: '物理', amount: 0, source: '' };
}

// 把任意加值数组归一化为长度 6、全数值；缺则补默认 0。用于 spells/specialAttacks 的标记.
function normArr6(arr) {
  let out = (arr || []).slice();
  while (out.length < 6) out.push(0);
  return out.slice(0, 6).map((b) => Number(b) || 0);
}

// 7 位加成槽（专长/内在/修行/器械/完美/士气/其它）：专长为 index0，原 0-5 顺延为 1-6。
function feat7() {
  return [0, 0, 0, 0, 0, 0, 0];
}
/**
 * 7 位 n 侧加成槽：[专长, 内在, 修行, 器械, 完美, 士气, 其它]
 * - 旧 6 位：前补 feat=0
 * - 已是 7 位：原样保留（幂等）
 * - 其它长度：补/截到 7
 */
function normFeat7(arr) {
  if (!Array.isArray(arr)) return [0, 0, 0, 0, 0, 0, 0];

  const values = arr.slice(0, 7).map((value) => Number(value) || 0);
  if (arr.length === 6) return [0, ...values];

  while (values.length < 7) values.push(0);
  return values;
}

/**
 * 派生值(movement/initiative/willpower/health)：旧 { feat, bonus[6] } 迁移为 { bonus[7] }。
 * - 旧 feat 并入 index0（专长）；bonus[6] 落到 1..6。
 * - 已是新结构 infinite/7 位：原样保留（幂等）。
 */
function normalizeDerivedItem(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const feat = Number(source.feat) || 0;
  const bonus = Array.isArray(source.bonus) ? source.bonus : [];

  if (bonus.length === 7) {
    return { bonus: bonus.map((value) => Number(value) || 0) };
  }
  if (bonus.length === 6) {
    return { bonus: [feat, ...bonus.map((value) => Number(value) || 0)] };
  }

  const out = bonus.slice(0, 7).map((value) => Number(value) || 0);
  while (out.length < 7) out.push(0);
  if (feat) out[0] = feat;
  return { bonus: out };
}

// 属性子对象规范化：兼容「新数组结构」与「旧 per-属性对象」两种存储，统一为数组结构。
function normalizeAttributes(rawAttr, emptyAttr) {
  const N = ATTRIBUTES.length;
  const out = {
    base: new Array(N).fill(ATTRIBUTES[0] ? ATTRIBUTES[0].default : 2),
    poolBonus: emptyAttr.poolBonus.map((r) => r.slice()),
    checkBonus: emptyAttr.checkBonus.map((r) => r.slice()),
    penalty: new Array(N).fill(0),
    checkPenalty: new Array(N).fill(0),
  };
  const forEachAttr = ATTRIBUTES.forEach.bind(ATTRIBUTES);
  if (Array.isArray(rawAttr.base)) {
    // —— 新数组结构 ——
    forEachAttr((a, i) => { out.base[i] = Number(rawAttr.base[i]) || 0; });
    if (Array.isArray(rawAttr.poolBonus)) forEachAttr((a, i) => { (rawAttr.poolBonus[i] || []).forEach((v, j) => { if (out.poolBonus[i][j] != null) out.poolBonus[i][j] = Number(v) || 0; }); });
    if (Array.isArray(rawAttr.checkBonus)) forEachAttr((a, i) => { (rawAttr.checkBonus[i] || []).forEach((v, j) => { if (out.checkBonus[i][j] != null) out.checkBonus[i][j] = Number(v) || 0; }); });
    if (Array.isArray(rawAttr.penalty)) forEachAttr((a, i) => { out.penalty[i] = Number(rawAttr.penalty[i]) || 0; });
    if (Array.isArray(rawAttr.checkPenalty)) forEachAttr((a, i) => { out.checkPenalty[i] = Number(rawAttr.checkPenalty[i]) || 0; });
  } else {
    // —— 旧结构：attributes = { strength: {base,inner,practice,inner2,practice2,gear,perfect,morale,other}, ... } ——
    forEachAttr((a) => {
      const old = rawAttr[a.id];
      if (old && typeof old === 'object') {
        const i = ATTRIBUTES.indexOf(a);
        out.base[i] = Number(old.base) || 0;
        if (out.poolBonus[i][0] != null && old.inner != null) out.poolBonus[i][0] = Number(old.inner) || 0;
        if (out.poolBonus[i][1] != null && old.practice != null) out.poolBonus[i][1] = Number(old.practice) || 0;
        if (out.checkBonus[i][0] != null && old.inner2 != null) out.checkBonus[i][0] = Number(old.inner2) || 0;
        if (out.checkBonus[i][1] != null && old.practice2 != null) out.checkBonus[i][1] = Number(old.practice2) || 0;
        if (out.checkBonus[i][2] != null && old.gear != null) out.checkBonus[i][2] = Number(old.gear) || 0;
        if (out.checkBonus[i][3] != null && old.perfect != null) out.checkBonus[i][3] = Number(old.perfect) || 0;
        if (out.checkBonus[i][4] != null && old.morale != null) out.checkBonus[i][4] = Number(old.morale) || 0;
        if (out.checkBonus[i][5] != null && old.other != null) out.checkBonus[i][5] = Number(old.other) || 0;
      }
    });
  }
  return out;
}

// 简单的深合并：用外来的已保存数据覆盖默认空角色。
function normalize(raw) {
  const empty = emptyCharacter();
  if (!raw || typeof raw !== 'object') return empty;

  const merged = { ...empty, ...raw };
  if (raw.concepts) merged.concepts = { ...empty.concepts, ...raw.concepts };
  if (raw.attributes) {
    merged.attributes = normalizeAttributes(raw.attributes, empty.attributes);
    // 属性减值 / 检定减值：新结构在 attributes 内；旧档在 derivedDetail.attrPenalty，此处一并迁移
    const oldP = raw.derivedDetail && raw.derivedDetail.attrPenalty;
    if (oldP && Array.isArray(oldP.attr)) ATTRIBUTES.forEach((a, i) => { if (merged.attributes.penalty[i] === 0) merged.attributes.penalty[i] = Number(oldP.attr[i]) || 0; });
    if (oldP && Array.isArray(oldP.check)) ATTRIBUTES.forEach((a, i) => { if (merged.attributes.checkPenalty[i] === 0) merged.attributes.checkPenalty[i] = Number(oldP.check[i]) || 0; });
  } else {
    merged.attributes = empty.attributes;
  }
  if (raw.skills) merged.skills = { ...empty.skills, ...raw.skills };
  if (!Array.isArray(merged.spells)) merged.spells = [];
  if (!Array.isArray(merged.spellBaseBonuses)) merged.spellBaseBonuses = feat7();
  merged.spellBaseBonuses = normFeat7(merged.spellBaseBonuses);
  merged.spells = merged.spells.map((s) => {
    const n = s && typeof s === 'object' ? { ...s } : newSpell();
    if (!n.id) n.id = newUid('spell'); // 稳定 id：缺失才生成
    n.bonuses = normFeat7(n.bonuses); // 专长/内在/修行/器械/完美/士气/其它
    // 旧档 dmgBonuses（伤害上限加成栏）已废弃：不再读取、不再提交
    delete n.dmgBonuses;
    n.extraSuccessBonus = normArr6(n.extraSuccessBonus); // m 侧附加加值1..6
    return n;
  });
  if (!Array.isArray(merged.specialAttacks)) merged.specialAttacks = [];
  if (!Array.isArray(merged.energyPools)) merged.energyPools = [];
  // 特殊攻击 / 能量池的加成补足（n 侧含专长）
  merged.specialAttacks = merged.specialAttacks.map((a) => {
    const n = a && typeof a === 'object' ? { ...a } : newAttack();
    if (!n.id) n.id = newUid('special');
    n.bonuses = normFeat7(n.bonuses);
    n.extraSuccessBonus = normArr6(n.extraSuccessBonus); // m 侧附加加值1..6
    return n;
  });
  merged.energyPools = merged.energyPools.map((p) => {
    const n = p && typeof p === 'object' ? { ...p } : newEnergyPool();
    if (!n.id) n.id = newUid('pool');
    n.bonuses = normFeat7(n.bonuses);
    return n;
  });
  if (!Array.isArray(merged.perks)) merged.perks = [];
  if (!Array.isArray(merged.equipment)) merged.equipment = [];
  if (!Array.isArray(merged.traits)) merged.traits = [];
  // 已拥有资源：默认 []; 每行确保 instanceId 存在，其余字段(level/qty/option/resourceId/specialAttackId)原样保留
  if (!Array.isArray(merged.ownedResources)) merged.ownedResources = [];
  merged.ownedResources = merged.ownedResources.map((r) => {
    const n = r && typeof r === 'object' ? { ...r } : newOwnedResource();
    if (!n.instanceId) n.instanceId = newUid('res');
    return n;
  });
  if (!merged.resources || typeof merged.resources !== 'object') merged.resources = empty.resources;
  if (!Array.isArray(merged.resources.purchases)) merged.resources.purchases = [];
  if (!Array.isArray(merged.resources.records)) merged.resources.records = [];
  if (!merged.resources.leftover) merged.resources.leftover = empty.resources.leftover;
  if (!merged.hpSlots || typeof merged.hpSlots !== 'object') merged.hpSlots = empty.hpSlots;
  if (merged.geneLock == null) merged.geneLock = empty.geneLock;
  if (!merged.otherInfo || typeof merged.otherInfo !== 'object') merged.otherInfo = empty.otherInfo;
  if (!merged.defense || typeof merged.defense !== 'object') merged.defense = empty.defense;
  if (!merged.defense.armor) merged.defense.armor = empty.defense.armor;
  // 旧 armorBonus（护甲额外加成）已废除：累加到 armor.other 后删除
  if (merged.defense.armorBonus != null) {
    merged.defense.armor.other = (Number(merged.defense.armor.other) || 0) + (Number(merged.defense.armorBonus) || 0);
    delete merged.defense.armorBonus;
  }
  delete merged.defense.armorBonus; // 保险：确保字段不残留
  if (!Array.isArray(merged.defense.reduction) || merged.defense.reduction.length < 2) {
    merged.defense.reduction = [
      { type: '物理', amount: 0, source: '' },
      { type: '能量', amount: 0, source: '' },
    ];
  } else {
    merged.defense.reduction = merged.defense.reduction.map((r) =>
      r && typeof r === 'object' ? { type: r.type || '物理', amount: Number(r.amount) || 0, source: r.source || '' } : newReduction()
    );
  }
  if (!merged.derivedDetail || typeof merged.derivedDetail !== 'object') merged.derivedDetail = empty.derivedDetail;
  if (!Array.isArray(merged.baseAttacks)) merged.baseAttacks = empty.baseAttacks;
  // 派生细则四种（move/init/will/health）：统一为 { bonus[7] }（index0=专长），迁移旧 {feat, bonus[6]}
  ['movement', 'initiative', 'willpower', 'health'].forEach((k) => {
    merged.derivedDetail[k] = normalizeDerivedItem(merged.derivedDetail[k]);
  });
  if (!merged.derivedDetail.saves || typeof merged.derivedDetail.saves !== 'object') merged.derivedDetail.saves = empty.derivedDetail.saves;
  if (!Array.isArray(merged.derivedDetail.saves.special)) merged.derivedDetail.saves.special = [0, 0, 0];
  if (!Array.isArray(merged.derivedDetail.saves.feat)) merged.derivedDetail.saves.feat = [0, 0, 0];
  // 豁免加成：二维结构 bonus[i]（i=0..2 对应 反射/意志/强韧），每豁免 12 位 =
  //   加成1-6(下标 0..5) + 附加加值1-6(下标 6..11)。
  // 兼容旧数据（一维扁平）：每豁免 12 位(36) / 旧 10 位(30，下标0..4加成+5..9附加) / 更早 6 位(18)。
  {
    const raw = merged.derivedDetail.saves.bonus;
    const is2D = Array.isArray(raw) && Array.isArray(raw[0]);
    const flat = is2D ? null : (Array.isArray(raw) ? raw : []);
    const n = flat ? flat.length : 0;
    const read = (i, k) => {
      if (is2D) return Number(raw[i] && raw[i][k]) || 0;
      if (n >= 36) return Number(flat[i * 12 + k]) || 0;
      if (n >= 30) {
        if (k < 5) return Number(flat[i * 10 + k]) || 0; // 加成1-5 → 新下标0..4
        return Number(flat[i * 10 + (k - 6) + 5]) || 0; // 附加1-5 → 新下标6..11
      }
      if (k < 3) return Number(flat[i * 6 + k]) || 0; // 加成1-3 → 新下标0..2
      return Number(flat[i * 6 + (k - 6) + 3]) || 0; // 附加1-3 → 新下标6..8
    };
    const out = [];
    for (let i = 0; i < 3; i++) {
      const row = [];
      for (let k = 0; k < 12; k++) row.push(read(i, k));
      out.push(row);
    }
    merged.derivedDetail.saves.bonus = out;
  }
  // 敏感范围加成：补到 6 个
  if (!merged.derivedDetail.sensitive || typeof merged.derivedDetail.sensitive !== 'object') merged.derivedDetail.sensitive = empty.derivedDetail.sensitive;
  if (!Array.isArray(merged.derivedDetail.sensitive.bonus)) merged.derivedDetail.sensitive.bonus = [];
  merged.derivedDetail.sensitive.bonus = normFeat7(merged.derivedDetail.sensitive.bonus);
  // 基础攻击加成补足（7：专长/内在/修行/器械/完美/士气/其它）+ 其他 + 附加成功加成(6)
  merged.baseAttacks = merged.baseAttacks.map((a) => {
    const clean = a && typeof a === 'object' ? { ...a } : { id: 'x', label: '攻击', attr: 'strength', skill: 'brawl', specialty: 0, bonuses: feat7(), other: 0, effect: '' };
    clean.bonuses = normFeat7(clean.bonuses);
    if (clean.other == null) clean.other = 0;
    if (!Array.isArray(clean.extraSuccessBonus)) clean.extraSuccessBonus = [];
    while (clean.extraSuccessBonus.length < 6) clean.extraSuccessBonus.push(0);
    clean.extraSuccessBonus = clean.extraSuccessBonus.slice(0, 6).map((b) => Number(b) || 0);
    return clean;
  });
  return merged;
}

/** 后端预留接口：将来把这里的实现切换为 fetch 即可。 */
const api = {
  async save(character) {
    // 示例（后端就绪后启用）：
    // const res = await fetch('/api/character', {
    //   method: 'PUT',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(character),
    // });
    // return res.ok;
    return saveToStorage(character);
  },
  async load() {
    // 示例：await fetch('/api/character').then((r) => r.json())
    return loadFromStorage();
  },
};

function saveToStorage(character) {
  try {
    const snapshot = {
      ...character,
      meta: { ...character.meta, updatedAt: new Date().toISOString() },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch (error) {
    console.warn('保存到 localStorage 失败：', error);
    return false;
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch (error) {
    console.warn('读取 localStorage 失败：', error);
    return null;
  }
}

export { emptyCharacter, normalize, newSpell, newAttack, newEnergyPool, newOwnedResource, newPerk, newEquipment, newTrait, newPurchase, newRecord, newReduction, api, STORAGE_KEY };