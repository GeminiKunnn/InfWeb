/**
 * newchar.vitest.js —— 新建角色向导规则回归（Vitest）。
 * 直接 import new-character.js 导出的纯助手，断言关键建卡规则：
 *   硬上限（属性≤5 / 技能≤4）、定向点 生理/心智/互动 5|4|3 与 6|5|4、自由技能点 15+5 模型、组超支判定。
 * 运行：npm run test:logic
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  newChar,
  attrCost,
  skillCost,
  assignAttrBudget,
  assignSkillBudget,
  newCharAttrGroupCount,
  newCharSkillGroupCount,
  newCharGroupDirectedUsed,
  newCharGroupFreeUsed,
  newCharSkillFreeTotal,
  newCharAllocGroupOver,
} from '../src/js/new-character.js';

// 每组测试前重置向导状态
beforeEach(() => {
  newChar.attributes = Object.fromEntries(
    Object.keys(newChar.attributes).map((k) => [k, 2]),
  );
  newChar.skills = Object.fromEntries(
    Object.keys(newChar.skills).map((k) => [k, 0]),
  );
  newChar.attrBudget = { 生理: 5, 心智: 4, 互动: 3 };
  newChar.skillBudget = { 生理: 6, 心智: 5, 互动: 4 };
  newChar.freeSkillPoints = 5;
  newChar.perkPoints = 15;
});

describe('建卡硬上限', () => {
  it('属性成本：默认2→3=1点、4=2点、5=4点；>5 也按 5 计（建卡上限5）', () => {
    expect(attrCost(2)).toBe(0);
    expect(attrCost(3)).toBe(1);
    expect(attrCost(4)).toBe(2);
    expect(attrCost(5)).toBe(4);
    expect(attrCost(9)).toBe(4); // 超上限不爆炸，越界单独标红
  });
  it('技能成本：0→1=1、2=2、3=3、4=5；>4 也按 4 计（建卡上限4）', () => {
    expect(skillCost(0)).toBe(0);
    expect(skillCost(1)).toBe(1);
    expect(skillCost(2)).toBe(2);
    expect(skillCost(3)).toBe(3);
    expect(skillCost(4)).toBe(5);
    expect(skillCost(7)).toBe(5);
  });
});

describe('属性定向点互斥分配（生理5/心智4/互动3）', () => {
  it('assignAttrBudget 联动：设 生理=5 → 心智自动补 4、互动补 3', () => {
    assignAttrBudget('生理', 5);
    expect(newChar.attrBudget).toEqual({ 生理: 5, 心智: 4, 互动: 3 });
  });
  it('组内属性点统计 = Σ attrCost', () => {
    assignAttrBudget('生理', 5);
    newChar.attributes.strength = 5; // cost 4
    newChar.attributes.dexterity = 3; // cost 1
    newChar.attributes.stamina = 2; // cost 0
    expect(newCharAttrGroupCount('生理')).toBe(5);
  });
});

describe('技能 15+5 模型（定向 6|5|4 + 自由 5）', () => {
  it('组定向已用 = min(组总耗点, 组预算)', () => {
    // 生理/心智/互动分别加技能
    newChar.skills.athletics = 4; // 生理：skillCost=5
    assignSkillBudget('生理', 6);
    expect(newCharSkillGroupCount('生理')).toBe(5);
    expect(newCharGroupDirectedUsed('生理')).toBe(5);
    expect(newCharGroupFreeUsed('生理')).toBe(0); // 未超预算
  });
  it('组占用自由点 = max(0, 组耗点 − 组预算)', () => {
    newChar.skills.athletics = 4; // 生理 5 点
    newChar.skills.brawl = 3; // 生理 +3 = 8 点
    expect(newCharSkillGroupCount('生理')).toBe(8);
    expect(newCharGroupDirectedUsed('生理')).toBe(6); // 预算内 6
    expect(newCharGroupFreeUsed('生理')).toBe(2); // 超额 2 点占自由池
  });
  it('全局自由点已用 = Σ 各组超额；不超预算时 userId 方向为 0', () => {
    assignSkillBudget('生理', 6);
    newChar.skills.athletics = 4; // 5 点（<6）
    expect(newCharSkillFreeTotal()).toBe(0);
  });
});

describe('组超支判定 newCharAllocGroupOver', () => {
  it('属性超预算 → 标红', () => {
    assignAttrBudget('生理', 3);
    newChar.attributes.strength = 5; // cost 4 > 3
    expect(newCharAllocGroupOver('attribute', '生理')).toBe(true);
  });
  it('技能超预算但全局自由池未耗竭 → 未超支（自由可补）', () => {
    newChar.skills.athletics = 4; // 生理 5
    newChar.skills.intimidation = 4; // 互动 5 (预算4) → 只占 1 自由，池 5 未竭
    assignSkillBudget('互动', 4);
    expect(newCharSkillFreeTotal()).toBe(1);
    expect(newCharAllocGroupOver('skill', '互动')).toBe(false);
  });
  it('自由池耗尽后仍有组超额 → 超支', () => {
    // 让多组各自超额耗尽自由池
    newChar.skills.athletics = 4; // 生理 5（自由 0，预算内）
    newChar.skills.firearms = 4; // 生理 +5 = 10 → 超额 4
    newChar.skills.intimidation = 4; // 互动 5 → 超额 1（预算4）
    assignSkillBudget('生理', 6);
    assignSkillBudget('互动', 4);
    expect(newCharSkillFreeTotal()).toBe(5); // 自由池已耗尽
    expect(newCharSkillFreeTotal() > newChar.freeSkillPoints).toBe(false); // == 5，未超过
    // 再超额一点（用生理系技能 brawl）→ 超过自由池 → 超支
    newChar.skills.brawl = 3; // 生理 13 → 超额 7
    expect(newCharSkillFreeTotal()).toBeGreaterThan(0);
    expect(newCharAllocGroupOver('skill', '生理')).toBe(true);
  });
});