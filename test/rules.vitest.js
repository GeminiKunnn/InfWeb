/**
 * rules.vitest.js —— 规则书 Markdown 解析器回归（Vitest）。
 * 直接 import rules.js 的纯函数 parseMarkdownBlocks，验证解析规则不被迁移破坏。
 * 运行：npm run test:logic
 */
import { describe, it, expect } from 'vitest';
import { parseMarkdownBlocks, RULES } from '../src/js/rules.js';

describe('rules: RULES 清单', () => {
  it('含基础规则 / 战斗规则等条目', () => {
    const ids = RULES.map((r) => r.id);
    expect(ids).toContain('base');
    expect(ids.length).toBeGreaterThan(0);
    for (const r of RULES) expect(r.file).toMatch(/^content\/rules\//);
  });
});

describe('rules: parseMarkdownBlocks 块解析', () => {
  it('标题 h1-h4 识别为 heading', () => {
    const md = '# 一级\n## 二级\n### 三级\n#### 四级';
    const blocks = parseMarkdownBlocks(md);
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'heading', 'heading', 'heading']);
    expect(blocks[0].level).toBe(1);
    expect(blocks[1].level).toBe(2);
    expect(blocks[2].level).toBe(3);
    expect(blocks[3].level).toBe(4);
    expect(blocks[2].text).toBe('三级');
  });

  it('普通段落解析为 para', () => {
    const blocks = parseMarkdownBlocks('你好世界');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('para');
  });

  it('无序列表解析为 list(ordered=false) 且空行打断', () => {
    const md = '- 甲\n- 乙\n\n正文';
    const blocks = parseMarkdownBlocks(md);
    expect(blocks[0].type).toBe('list');
    expect(blocks[0].ordered).toBe(false);
    expect(blocks[0].items).toHaveLength(2);
    expect(blocks[1].type).toBe('para');
  });

  it('表格解析为 table 且含表头', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const blocks = parseMarkdownBlocks(md);
    expect(blocks[0].type).toBe('table');
    expect(blocks[0].rows.length).toBeGreaterThanOrEqual(2);
  });

  it('水平线 hr / 空输入', () => {
    expect(parseMarkdownBlocks('')).toEqual([]);
    const blocks = parseMarkdownBlocks('---');
    expect(blocks[0].type).toBe('hr');
  });
});