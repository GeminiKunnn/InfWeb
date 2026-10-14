/**
 * store.vitest.js —— 可替换 api 层 + normalize 回归（Vitest）。
 * 用内存 stub 充当 localStorage，验证 api.save/api.load 往返不丢数据、
 * normalize 能对缺省字段补齐（旧存档/后端缺字段容错）。
 * 运行：npm run test:logic
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { emptyCharacter, normalize, api, STORAGE_KEY } from '../src/js/store.js';

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
    c.attributes.dexterity.base = 6;
    c.skills.firearms.base = 5;
    const ok = await api.save(c);
    expect(ok).toBe(true);
    const loaded = await api.load();
    expect(loaded).not.toBeNull();
    expect(loaded.concepts.name).toBe('测试角色');
    expect(loaded.attributes.dexterity.base).toBe(6);
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
    expect(Object.keys(out.attributes)).toHaveLength(9);
    expect(Object.keys(out.skills)).toHaveLength(21);
  });

  it('对缺少九属性/二十一技能字段的老存档补齐默认值', () => {
    const legacy = { concepts: { name: '旧档' }, attributes: {}, skills: {} };
    const out = normalize(legacy);
    expect(out.concepts.name).toBe('旧档');
    expect(out.attributes.strength.base).toBe(2); // 缺失的属性补默认
    expect(out.skills.athletics.base).toBe(0); // 缺失的技能补默认
    // 防御/派生细则等深层对象也应被补齐
    expect(out.defense).toBeTruthy();
    expect(out.derivedDetail).toBeTruthy();
  });
});