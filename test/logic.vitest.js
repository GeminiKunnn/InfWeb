/**
 * logic.vitest.js —— 纯逻辑层回归测试（Vitest）。
 *
 * 直接 import 复用层源码（character-config / store / state / calc），
 * 断言关键计算/校验规则，确保 Vue 迁移过程 NOT 破坏逻辑层。
 * 运行：npm run test:logic
 */
import { describe, it, expect } from 'vitest';
import { ATTRIBUTES, SKILLS, GROUPS } from '../src/js/character-config.js';
import { emptyCharacter, normalize, newSpell } from '../src/js/store.js';
import { setCharacter } from '../src/js/state.js';
import {
  attrPool,
  attrValue,
  attrLegendary,
  skillValue,
  skillExtraSuccess,
  nm,
  baseAttackData,
  attackCheckDP,
  energyTotal,
  saveTotalOf,
  saveExtraSuccess,
  saveDisplayOf,
  SAVE_DEFS,
} from '../src/js/calc.js';

function fresh() {
  const c = emptyCharacter();
  setCharacter(c);
  return c;
}

describe('character-config：字段数据源', () => {
  it('九属性 / 二十一技能 / 三分组', () => {
    expect(ATTRIBUTES).toHaveLength(9);
    expect(SKILLS).toHaveLength(21);
    expect(GROUPS).toEqual(['生理', '心智', '互动']);
  });
  it('属性默认 2、max 6；技能默认 0、max 15', () => {
    for (const a of ATTRIBUTES) expect(a.default).toBe(2);
    for (const a of ATTRIBUTES) expect(a.max).toBe(6);
    for (const s of SKILLS) expect(s.default).toBe(0);
    for (const s of SKILLS) expect(s.max).toBe(15);
  });
  it('id 稳定且唯一（可作 API 字段名）', () => {
    const ids = [...ATTRIBUTES, ...SKILLS].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('store：emptyCharacter / normalize 结构', () => {
  it('emptyCharacter 含概念段九属性二十一技能且属性基础为默认', () => {
    const c = emptyCharacter();
    expect(c.concepts.name).toBe('');
    expect(Object.keys(c.attributes)).toHaveLength(9);
    expect(Object.keys(c.skills)).toHaveLength(21);
    expect(c.attributes.strength.base).toBe(2);
  });
  it('newSpell 工厂返回可增删行的法术对象', () => {
    const s = newSpell();
    expect(typeof s).toBe('object');
    expect(s).toHaveProperty('name');
  });
});

describe('calc：属性两档 / 传奇值', () => {
  it('属性值 = 基础+内在+修行', () => {
    const c = fresh();
    c.attributes.strength.base = 3;
    c.attributes.strength.inner = 1;
    c.attributes.strength.practice = 1;
    expect(attrPool('strength')).toBe(5);
  });
  it('检定值 = 属性值 + 内在2+器械+完美+其它+其它2', () => {
    const c = fresh();
    c.attributes.strength.base = 4; // pool=4
    c.attributes.strength.inner2 = 1;
    c.attributes.strength.gear = 2;
    expect(attrValue('strength')).toBe(7);
  });
  it('传奇 = ⌊(属性值-1)/5⌋', () => {
    const c = fresh();
    c.attributes.strength.base = 6;
    expect(attrLegendary('strength')).toBe(1);
    c.attributes.strength.base = 11;
    expect(attrLegendary('strength')).toBe(2);
  });
});

describe('calc：技能 / 附加成功', () => {
  it('技能值 = base+inner+practice+gear+perfect+morale+other', () => {
    const c = fresh();
    c.skills.athletics.base = 5;
    c.skills.athletics.gear = 1;
    expect(skillValue('athletics')).toBe(6);
  });
  it('5/7/9/11/13/15 各 +1，≤6', () => {
    const c = fresh();
    c.skills.athletics.base = 4;
    expect(skillExtraSuccess('athletics')).toBe(0);
    c.skills.athletics.base = 5;
    expect(skillExtraSuccess('athletics')).toBe(1);
    c.skills.athletics.base = 15;
    expect(skillExtraSuccess('athletics')).toBe(6);
    c.skills.athletics.base = 17;
    expect(skillExtraSuccess('athletics')).toBe(6); // 封顶 6
  });
  it('n+m：m=0 隐藏', () => {
    expect(nm(8, 0)).toBe('8');
    expect(nm(8, 2)).toBe('8+2');
  });
});

describe('calc：豁免', () => {
  it('SAVE_DEFS 三列：反射/意志/强韧', () => {
    expect(SAVE_DEFS.map((s) => s.name)).toEqual(['反射豁免', '意志豁免', '强韧豁免']);
  });
  it('豁免总计 = 属性检定+技能检定+传奇×3+专业+专长+加成', () => {
    const c = fresh();
    c.attributes.dexterity.base = 6; // dexValue=6, leg=1
    c.skills.athletics.base = 3; // skill=3
    c.derivedDetail.saves.special[0] = 1;
    c.derivedDetail.saves.feat[0] = 0;
    c.derivedDetail.saves.bonus[0] = 2;
    // total = 6 + 3 + 1*3 + 1 + 0 + 2 = 15
    expect(saveTotalOf(0)).toBe(15);
  });
  it('豁免附加成功含技能+传奇属性+额外加值', () => {
    const c = fresh();
    c.attributes.dexterity.base = 9; // leg=1
    c.skills.athletics.base = 6; // extra=2 (5,6→5 gives1;>=6→... 6>=5→1,6<7→no) -> 1
    expect(saveExtraSuccess(0)).toBe(1 + 1); // leg1 + skillExtra(6)=1
  });
  it('复制显示 n+m', () => {
    const c = fresh();
    expect(typeof saveDisplayOf(0)).toBe('string');
  });
});

describe('calc：基础攻击 / 能量池', () => {
  it('攻击检定 DP = 属性检定+技能检定+其他', () => {
    const c = fresh();
    c.attributes.strength.base = 4; // value=4
    c.skills.weaponry.base = 3; // value=3, extra=0 (3<5)
    const atk = {
      id: 'whiteblade', attr: 'strength', skill: 'weaponry',
      weaponDamage: 2, specialty: 0, bonuses: [0, 0, 0, 0, 0], other: 0,
    };
    const d = attackCheckDP(atk);
    expect(d).toBe(4 + 3 + 2); // 9
  });
  it('baseAttackData 含 label/checkDP/damageCap/extraSuccess', () => {
    const c = fresh();
    c.attributes.dexterity.base = 6; // dexValue=6, leg=1
    c.skills.firearms.base = 5; // skill=5, extra=1
    const atk = {
      id: 'semi', label: '半自动枪械攻击', attr: 'dexterity', skill: 'firearms',
      ammoDamage: 0, weaponDamage: 1, specialty: 0, bonuses: [0,0,0,0,0], other: 0,
    };
    const b = baseAttackData(atk);
    expect(b.label).toBe('半自动枪械攻击');
    // checkDP = dexValue(6) + skill(5) + addDmg(1) = 12
    expect(b.checkDP).toBe(12);
    // damageCap = addDmg(1) + 属性基础(6) + 技能基础(5) + 传奇*2(2) + geneLock(0) = 14
    expect(b.damageCap).toBe(14);
    // extraSuccess = 技能附加(1) + 传奇(1) = 2
    expect(b.extraSuccess).toBe(2);
  });
  it('能量池总值 = 主属性检定(+次属性检定)+加成', () => {
    const c = fresh();
    c.attributes.composure.base = 3; // value=3
    const pool = { attr1: 'composure', attr2: null, bonuses: [1, 0, 0, 0, 0] };
    expect(energyTotal(pool)).toBe(3 + 1);
  });
});

describe('calc：关键规则不因加 host 参数而变', () => {
  // 回归：确保 calc 纯函数输出稳定（迁移只动了 character/new-character 的渲染入口 host）
  it('默认空角色的属性检定 = 2（基础默认）', () => {
    fresh();
    expect(attrValue('strength')).toBe(2);
    expect(skillValue('athletics')).toBe(0);
  });
});