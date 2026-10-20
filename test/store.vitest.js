/**
 * store.vitest.js —— 可替换 api 层 + normalize 回归（Vitest）。
 * 用内存 stub 充当 localStorage，验证 api.save/api.load 往返不丢数据、
 * normalize 能对缺省字段补齐（旧存档/后端缺字段容错）。
 * 运行：npm run test:logic
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { emptyCharacter, normalize, api, STORAGE_KEY, newSpell, newAttack, newEnergyPool } from '../src/js/store.js';

// ---- 内存版 localStorage 桩（Node 无 localStorage）----
function makeLocalStorageStub() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    _map: store,
  };
}

beforeAll(() => {
  globalThis.localStorage = makeLocalStorageStub();
});
beforeEach(() => {
  globalThis.localStorage.clear();
});

describe('api 可替换信息层：保存/读取往返', () => {
  it('api.save 后 api.load 可原样还原角色', async () => {
    const c = emptyCharacter();
    c.concepts.name = '测试角色';
    c.attributes.base[1] = 6; // dexterity
    c.skills.firearms.base = 5;
    const ok = await api.save(c);
    expect(ok).toBe(true);
    const loaded = await api.load();
    expect(loaded).not.toBeNull();
    expect(loaded.concepts.name).toBe('测试角色');
    expect(loaded.attributes.base[1]).toBe(6);
    expect(loaded.skills.firearms.base).toBe(5);
  });

  it('保存时写入 STORAGE_KEY 且写入 meta.updatedAt（时间戳）', async () => {
    const c = emptyCharacter();
    await api.save(c);
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw);
    expect(parsed.meta.updatedAt).toBeTruthy();
    expect(parsed.meta.version).toBe('0.1.0');
  });

  it('无存档时 api.load 返回 null', async () => {
    expect(await api.load()).toBeNull();
  });
});

describe('normalize：缺字段/旧存档容错', () => {
  it('用出厂角色 normalize 自身（幂等）', () => {
    const base = emptyCharacter();
    const out = normalize(base);
    expect(out.concepts.name).toBe('');
    expect(out.attributes.base).toHaveLength(9);
    expect(Object.keys(out.skills)).toHaveLength(21);
  });

  it('对缺少九属性/二十一技能字段的老存档补齐默认值', () => {
    const legacy = { concepts: { name: '旧档' }, attributes: {}, skills: {} };
    const out = normalize(legacy);
    expect(out.concepts.name).toBe('旧档');
    expect(out.attributes.base[0]).toBe(2); // 缺失的属性补默认
    expect(out.skills.athletics.base).toBe(0); // 缺失的技能补默认
    // 防御/派生细则等深层对象也应被补齐
    expect(out.defense).toBeTruthy();
    expect(out.derivedDetail).toBeTruthy();
  });
});

describe('稳定 id + 已拥有资源（对齐后端）', () => {
  it('newSpell/newAttack/newEnergyPool 建行即带唯一 id（spell_/special_/pool_ 前缀）', () => {
    const s1 = newSpell(); const s2 = newSpell();
    const a1 = newAttack(); const p1 = newEnergyPool();
    expect(s1.id).toMatch(/^spell_/); expect(s2.id).toMatch(/^spell_/);
    expect(s1.id).not.toBe(s2.id);
    expect(a1.id).toMatch(/^special_/);
    expect(p1.id).toMatch(/^pool_/);
  });

  it('normalize 给缺 id 的行补 id，已有 id 原样保留（不重生成）', () => {
    const c = emptyCharacter();
    c.spells.push(newSpell(), { name: '旧法术', bonuses: [0,0,0,0,0,0] }); // 第二条缺 id
    const keepId = c.spells[0].id;
    const out = normalize(c);
    expect(out.spells).toHaveLength(2);
    expect(out.spells[0].id).toBe(keepId); // 保留
    expect(out.spells[1].id).toMatch(/^spell_/); // 补齐
    // ownedResources 默认补为空数组
    expect(Array.isArray(out.ownedResources)).toBe(true);
  });

  it('ownedResources 行优先保证 instanceId；旧装备不破坏', () => {
    const c = emptyCharacter();
    c.ownedResources = [{ resourceId: 'bloodline-x', level: 2 }];
    c.equipment = [{ slot: '主武器', name: '剑' }];
    const out = normalize(c);
    expect(out.ownedResources[0].instanceId).toMatch(/^res_/);
    expect(out.ownedResources[0].resourceId).toBe('bloodline-x');
    expect(out.ownedResources[0].level).toBe(2);
    expect(out.equipment[0].name).toBe('剑');
  });

  it('重排 spells 后各行的 id 不变（稳定 id）', () => {
    const c = emptyCharacter();
    c.spells.push(newSpell(), newSpell(), newSpell());
    const ids = c.spells.map((s) => s.id);
    c.spells.reverse();
    const out = normalize(c);
    expect(out.spells.map((s) => s.id).sort()).toEqual([...ids].sort());
  });
});

describe('专长加值槽位（bonus index0=专长，原 0-5 顺延为 1-6）', () => {
  it('新工厂的 n 侧 bonuses 为 7 位，extraSuccessBonus 仍为 6 位', () => {
    expect(newSpell().bonuses).toHaveLength(7);
    expect(newSpell().extraSuccessBonus).toHaveLength(6);
    expect(newAttack().bonuses).toHaveLength(7);
    expect(newAttack().extraSuccessBonus).toHaveLength(6);
    expect(newEnergyPool().bonuses).toHaveLength(7);
  });

  it('normalize 把旧 6 位加成迁移为 7 位（专长=0，旧值顺延 1-6）', () => {
    const c = emptyCharacter();
    c.spellBaseBonuses = [2, 3, 4, 5, 6, 7]; // 旧 6 位
    c.spells = [{ name: 'a', bonuses: [1, 2, 3, 4, 5, 6], extraSuccessBonus: [0,0,0,0,0,0] }]; // 旧法术 6 位 bonuses
    const out = normalize(c);
    expect(out.spellBaseBonuses).toEqual([0, 2, 3, 4, 5, 6, 7]);
    expect(out.spells[0].bonuses).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(out.spells[0].extraSuccessBonus).toHaveLength(6); // m 侧不受影响
  });

  it('emptyCharacter 默认加成数组为 7 位（sensitive/spellBaseBonuses/baseAttacks）', () => {
    const c = emptyCharacter();
    expect(c.spellBaseBonuses).toHaveLength(7);
    expect(c.derivedDetail.sensitive.bonus).toHaveLength(7);
    expect(c.baseAttacks[0].bonuses).toHaveLength(7);
    expect(c.baseAttacks[0].extraSuccessBonus).toHaveLength(6);
  });

  it('normFeat7 幂等：7 位数组多次 normalize 不变（专长恒在 index0，other 不丢）', () => {
    const c = emptyCharacter();
    // 模拟一次 bias 之后已带专长的 7 位法术：专长=1,内在=2,...其它=7
    c.spells = [{ name: 'a', bonuses: [1, 2, 3, 4, 5, 6, 7], extraSuccessBonus: [0,0,0,0,0,0] }];
    c.spellBaseBonuses = [1, 2, 3, 4, 5, 6, 7];
    c.specialAttacks = [{ name: 'x', attr: 'strength', skill: 'brawl', weaponDamage: 0, specialty: 0, bonuses: [1, 2, 3, 4, 5, 6, 7], extraSuccessBonus: [0,0,0,0,0,0] }];
    c.energyPools = [{ name: 'p', attr1: 'intelligence', attr2: '', bonuses: [1, 2, 3, 4, 5, 6, 7], recovery: '' }];
    const c1 = normalize(c);
    const c2 = normalize(c1);
    [c1.spells[0].bonuses, c1.spellBaseBonuses, c1.specialAttacks[0].bonuses, c1.energyPools[0].bonuses].forEach((b) => {
      expect(b).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(b).toHaveLength(7); // 专长恒在 index0
    });
    [c2.spells[0].bonuses, c2.spellBaseBonuses, c2.specialAttacks[0].bonuses, c2.energyPools[0].bonuses].forEach((b) => {
      expect(b).toEqual([1, 2, 3, 4, 5, 6, 7]); // 再 normalize 不变
    });
    expect(c2.spells[0].extraSuccessBonus).toHaveLength(6); // m 侧仍 6
  });

  it('normFeat7 迁移语义与后端一致（6 位→[0,...旧]；非数值→0；长于 7 截断）', () => {
    const c = emptyCharacter();
    c.spellBaseBonuses = [1, 2, 3, 4, 5, 6];           // 旧 6 位
    c.specialAttacks = [{ name: 'x', attr: 'strength', skill: 'brawl', weaponDamage: 0, specialty: 0, bonuses: ['a', 2, null, 4, 5, 6], extraSuccessBonus: [0,0,0,0,0,0] }]; // 非数值→0
    c.energyPools = [{ name: 'p', attr1: 'intelligence', attr2: '', bonuses: [1,2,3,4,5,6,7,8,9], recovery: '' }]; // 超长截到头 7
    const out = normalize(c);
    expect(out.spellBaseBonuses).toEqual([0, 1, 2, 3, 4, 5, 6]);      // 6位前补0
    expect(out.specialAttacks[0].bonuses).toEqual([0, 0, 2, 0, 4, 5, 6]); // 专长=前补0，非数值→0
    expect(out.energyPools[0].bonuses).toEqual([1, 2, 3, 4, 5, 6, 7]);    // 截断到7
  });

  it('derivedDetail 四项：旧 {feat, bonus[6]} → {bonus[7]}，feat 并入 index0，且幂等', () => {
    const c = emptyCharacter();
    // 旧结构：四种均 { feat, bonus[6] }
    c.derivedDetail.movement = { feat: 2, bonus: [1, 2, 3, 4, 5, 6] };
    c.derivedDetail.initiative = { feat: 0, bonus: [1, 2, 3, 4, 5, 6] };
    c.derivedDetail.willpower = { feat: 7, bonus: [1, 2, 3, 4, 5, 6] };
    c.derivedDetail.health = { feat: 3, bonus: [] }; // feat 落 index0，其余补 0
    const out = normalize(c);
    expect(out.derivedDetail.movement).toEqual({ bonus: [2, 1, 2, 3, 4, 5, 6] });
    expect(out.derivedDetail.initiative).toEqual({ bonus: [0, 1, 2, 3, 4, 5, 6] });
    expect(out.derivedDetail.willpower).toEqual({ bonus: [7, 1, 2, 3, 4, 5, 6] });
    expect(out.derivedDetail.health).toEqual({ bonus: [3, 0, 0, 0, 0, 0, 0] });
    // 四项不再有独立 feat 字段
    ['movement', 'initiative', 'willpower', 'health'].forEach((k) => {
      expect(out.derivedDetail[k]).not.toHaveProperty('feat');
      expect(out.derivedDetail[k].bonus).toHaveLength(7);
    });
    // 幂等：再 normalize 不变
    const out2 = normalize(out);
    expect(out2.derivedDetail.movement).toEqual({ bonus: [2, 1, 2, 3, 4, 5, 6] });
    expect(out2.derivedDetail.willpower).toEqual({ bonus: [7, 1, 2, 3, 4, 5, 6] });
    // 迁移后总值不变：base + sum(bonus[7]) 与 base + feat + sum(bonus[6]) 相等
    const sum7 = (b) => b.reduce((s, x) => s + x, 0);
    expect(sum7(out.derivedDetail.movement.bonus)).toBe(2 + (1 + 2 + 3 + 4 + 5 + 6));
    expect(sum7(out.derivedDetail.health.bonus)).toBe(3);
  });
});