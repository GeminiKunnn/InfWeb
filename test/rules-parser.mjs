/**
 * rules-parser.mjs — 校验 rules.js 的 Markdown 块解析器（纯逻辑）。
 * 对这些逻辑做真实规则的 .md 断言：标题层级、列表、表格、无换行残留等。
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const RULES_PATHS = [
  'src/content/rules/基础规则.md',
  'src/content/rules/战斗规则.md',
  'src/content/rules/进阶战斗规则.md',
  'src/content/rules/快速创建角色卡.md',
  'src/content/rules/其他规则.md',
].map((p) => join(root, p));

let rulesSrc = readFileSync(join(root, 'src/js/rules.js'), 'utf8');
// 去除 ESM 关键字，适配 vm 的 CommonJS 上下文（与 render-smoke 相同手法）
rulesSrc = rulesSrc.replace(/export\s+default[\s\S]*$/, '');
rulesSrc = rulesSrc.replace(/export\s+/g, '');
const allMd = RULES_PATHS.map((p) => readFileSync(p, 'utf8'));

const testBody = `
;(function(){
  const results = [];
  function ok(name, cond, extra) { results.push((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' :: ' + (extra==null?'':extra))); }

  // ---- 冒烟：标题与列表 ----
  const sm = parseMarkdownBlocks('# 标题\\n\\n## 章节\\n\\n### 小节\\n\\n- 甲\\n- 乙\\n\\n1. 一\\n2. 二\\n\\n---\\n\\n段落 **加粗** 和 *斜体*。');
  ok('h1解析', sm[0].type==='heading' && sm[0].level===1 && sm[0].text==='标题', JSON.stringify(sm[0]));
  ok('h2解析', sm[1].type==='heading' && sm[1].level===2, '');
  ok('h3解析', sm[2].type==='heading' && sm[2].level===3, '');
  const ulB = sm.find(b=>b.type==='list' && !b.ordered);
  ok('无序列表两项', !!ulB && ulB.items.length===2, JSON.stringify(ulB&&ulB.items));
  const olB = sm.find(b=>b.type==='list' && b.ordered);
  ok('有序列表两项', !!olB && olB.items.length===2, JSON.stringify(olB&&olB.items));
  ok('分隔线', sm.some(b=>b.type==='hr'), '');
  ok('行内加粗', sm.some(b=>b.type==='para' && /<strong>加粗<\\/strong>/.test(b.html)), '');
  ok('行内斜体', sm.some(b=>b.type==='para' && /<em>斜体<\\/em>/.test(b.html)), '');

  // ---- 表格冒烟 ----
  const tb = parseMarkdownBlocks('| a | b |\\n| --- | --- |\\n| 1 | 2 |');
  const tbl = tb.find(b=>b.type==='table');
  ok('表格解析(表头+1数据,2列)', !!tbl && tbl.rows.length===2 && tbl.rows[0][0]==='a' && tbl.rows[1][0]==='1', JSON.stringify(tbl&&tbl.rows));

  // ---- 逐本规则书真实 md ----
  const mds = ${JSON.stringify(allMd)};
  mds.forEach(function(md, idx){
    const blocks = parseMarkdownBlocks(md);
    const heads = blocks.filter(b=>b.type==='heading');
    ok('[文件'+idx+'] 含标题', heads.length>0, 'heading='+heads.length);
    ok('[文件'+idx+'] 标题层级1-6', heads.every(h=>h.level>=1&&h.level<=6), '');
    ok('[文件'+idx+'] 段落无残留换行', blocks.filter(b=>b.type==='para').every(p=>!p.html.includes('\\n')), '');
    // 危险的原文标签应被转义（<script> <iframe> <img）
    const allHtml = blocks.map(b=>b.html||'').join(' ');
    ok('[文件'+idx+'] 危险标签已转义', !/<(script|iframe|img)[\t >]/.test(allHtml), '');
    // 强调标记配平
    const strong = (allHtml.match(/<strong>/g)||[]).length, strongEnd=(allHtml.match(/<\\/strong>/g)||[]).length;
    ok('[文件'+idx+'] <strong>配平', strong===strongEnd, strong+'/'+strongEnd);
  });

  console.log(results.join('\\n'));
  return results;
})();
`;

vm.runInNewContext(rulesSrc + '\n' + testBody, { console }, { filename: 'rules-parser-test' });