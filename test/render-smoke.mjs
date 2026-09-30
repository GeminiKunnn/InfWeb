// Render smoke test for the attrs sheet. Uses a small but functional DOM fake.
// Run: node test/render-smoke.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const js = path.join(__dirname, '..', 'src', 'js');
function load(name) {
  let c = fs.readFileSync(path.join(js, name + '.js'), 'utf8');
  c = c.replace(/import\s+[\s\S]*?from\s*['"][^'"]+['"]\s*;?/g, '');
  c = c.replace(/export\s+\{[^}]*\}\s*;?/g, '');
  c = c.replace(/export\s+/g, '');
  return c;
}
let src = [load('character-config'), load('store'), load('app')].join('\n');
src = src.replace(/if\s*\(document\.readyState[\s\S]*$/, '');

function FakeEl(tag) {
  this.tag = tag;
  this.children = [];
  this.attrs = {};
  this.dataset = {};
  this.style = {};
  this._text = '';
  this._class = '';
  this.classList = { _s: new Set(), add(c){this._s.add(c); this._class=[...(this.classList._s)].join(' ');}, remove(c){this._s.delete(c); this._class=[...(this.classList._s)].join(' ');}, toggle(c){this._s.has(c)?this._s.delete(c):this._s.add(c); this._class=[...(this.classList._s)].join(' '); return this._s.has(c);}, contains(c){return this._s.has(c);} };
}
FakeEl.prototype.appendChild = function (c) {
  const n = typeof c === 'string' ? new FakeEl('#text') : c;
  if (n) n.parent = this;
  this.children.push(n);
  return n;
};
Object.defineProperty(FakeEl.prototype, 'textContent', {
  get() { return this._text; }, set(v) { this._text = String(v); },
});
Object.defineProperty(FakeEl.prototype, 'className', {
  get() { return this._class; }, set(v) { this._class = String(v); },
});
FakeEl.prototype.setAttribute = function (k, v) { this.attrs[k] = v; if (k === 'data-index') this.dataset.index = String(v); };
FakeEl.prototype.addEventListener = function () {};
FakeEl.prototype.matches = function (sel) {
  const cls = (this._class || '').split(' ').filter(Boolean);
  const mClass = sel.match(/^\.([\w-]+)$/);
  if (mClass) return cls.includes(mClass[1]);
  if (sel === this.tag) return true;
  const neg = sel.match(/^([\w-]+):not\(\.([\w-]+)\)$/);
  if (neg) return this.tag === neg[1] && !cls.includes(neg[2]);
  const negOnly = sel.match(/^:not\(\.([\w-]+)\)$/);
  if (negOnly) return !cls.includes(negOnly[1]);
  return false;
};
FakeEl.prototype.querySelectorAll = function (sel) {
  const out = [];
  const walk = (n) => {
    for (const c of n.children) {
      if (c && c.children && c.matches) {
        if (c.matches(sel)) out.push(c);
        if (c.children.length) walk(c);
      }
    }
  };
  walk(this);
  return out;
};
FakeEl.prototype.querySelector = function (sel) { const a = this.querySelectorAll(sel); return a.length ? a[0] : null; };

let currentHost = null;
function hostEl() { if (!currentHost) currentHost = new FakeEl('div'); return currentHost; }

const sandbox = {
  console, Math, Number, String, Array, Object, JSON, Date, setTimeout, clearTimeout,
  document: {
    readyState: 'loading',
    createElement: (t) => new FakeEl(t),
    createTextNode: (t) => new FakeEl('#text'),
    addEventListener(){},
    querySelector: (sel) => (sel === '.sheet-body' ? hostEl() : null),
    querySelectorAll: () => [],
    getElementById: () => new FakeEl('div'),
    body: new FakeEl('body'),
  },
  localStorage: { getItem(){return null;}, setItem(){}, removeItem(){} },
};
sandbox.window = sandbox;
vm.createContext(sandbox);

const TEST = `
(function(){
  const results = [];
  const ok = (name, cond, detail) => results.push((cond?'PASS':'FAIL')+': '+name);

  character.attributes.presence.base = 7;
  character.attributes.resolve.base = 7;
  character.attributes.dexterity.base = 11;
  character.defense.reduction = [{ type: '物理', amount: 3, source: '血统强化' }];

  const wrap = renderAttrDetailSheet();
  document.querySelector('.sheet-body').appendChild(wrap);
  const host = document.querySelector('.sheet-body');

  const boxes = host.querySelectorAll('.detail-box');
  const boxByTitle = (t)=>boxes.find(b => b.querySelector('.detail-box-title') && b.querySelector('.detail-box-title')._text === t);
  const boxLabels = (t)=>{ const b=boxByTitle(t); return b ? b.querySelectorAll('.detail-input-label').map(l=>l._text) : []; };

  ok('F4 弓箭攻击框含箭矢伤害标签', boxLabels('弓箭攻击').includes('箭矢伤害'), boxLabels('弓箭攻击'));
  ok('F4 半自动枪械攻击框含弹药伤害标签', boxLabels('半自动枪械攻击').includes('弹药伤害'), boxLabels('半自动枪械攻击'));

  // Req1: 派生值框总值栏在左侧（label=总值）
  const moveBox = boxByTitle('移动力');
  const firstInput = moveBox ? moveBox.querySelector('.detail-box-inputs').children[0] : null;
  ok('Req1 移动力框总值栏在左(label=总值)', firstInput && firstInput.querySelector('.detail-total-label') && firstInput.querySelector('.detail-total-label')._text === '总值');
  ok('Req1 移动力框总值栏数值=24', firstInput && firstInput.querySelector('.detail-box-total') && firstInput.querySelector('.detail-box-total')._text === '24', firstInput?firstInput.querySelector('.detail-box-total')._text:'n/a');

  const wpBox = boxByTitle('意志力');
  const wpFirst = wpBox ? wpBox.querySelector('.detail-box-inputs').children[0] : null;
  ok('Req1 意志力框总值栏在左', wpFirst && wpFirst.querySelector('.detail-total-label') && wpFirst.querySelector('.detail-total-label')._text === '总值');
  const wpTotalText = wpBox && wpBox.querySelector('.detail-box-total') ? wpBox.querySelector('.detail-box-total')._text : '(none)';
  ok('F3 意志力总计=18', wpTotalText === '18', 'got '+wpTotalText);

  // 豁免：仿派生值框，总值 = n+m（n 总计，m 附加成功），属性/技能隐含于 tip
  const saveDisp = (name) => { const b = boxByTitle(name); return b && b.querySelector('.detail-box-total') ? b.querySelector('.detail-box-total')._text : '(none)'; };
  ok('豁免框存在(反射)', !!boxByTitle('反射豁免'));
  ok('豁免框存在(意志)', !!boxByTitle('意志豁免'));
  ok('豁免框存在(强韧)', !!boxByTitle('强韧豁免'));
  ok('反射豁免总值=n+m(17+2)', saveDisp('反射豁免') === '17+2', saveDisp('反射豁免'));
  ok('意志豁免总值=n+m(10+1)', saveDisp('意志豁免') === '10+1', saveDisp('意志豁免'));
  ok('强韧豁免总值=2(m0隐藏+m)', saveDisp('强韧豁免') === '2', saveDisp('强韧豁免'));
  // 每个豁免框：主体 专业+专长+加成1..3，右侧附加成功 加值1..3（竖线分隔）
  const refRow = boxByTitle('反射豁免').querySelector('.detail-box-inputs');
  const labelTexts = refRow.querySelectorAll('.detail-input-label').map(l=>l._text);
  ok('豁免框含专业/专长/加成1..3+加值1..3', JSON.stringify(labelTexts) === JSON.stringify(['专业','专长','加成1','加成2','加成3','加值1','加值2','加值3']), labelTexts);
  ok('豁免框输入数=8(主体5+附加成功3)', refRow.querySelectorAll('.detail-input').length === 8, refRow.querySelectorAll('.detail-input').length);
  ok('豁免框附加成功区存在(带竖线)', !!boxByTitle('反射豁免').querySelector('.detail-extra-succ'), 'extra-succ');
  ok('豁免框附加成功小字标题=附加成功', boxByTitle('反射豁免').querySelector('.detail-extra-succ-label')._text === '附加成功', 'label');
  const refTip = boxByTitle('反射豁免').querySelector('.detail-tip');
  ok('反射豁免tip含敏捷+运动+传奇敏捷x3', refTip && refTip._text === '敏捷检定 + 运动检定 + 传奇敏捷×3', refTip?refTip._text:'(no tip)');

  // 需求：表示属性的矩形外框最左侧加蓝竖条（detail-box-accent）
  const moveClass = moveBox ? moveBox.className : '';
  ok('移动力框带蓝竖条(detail-box-accent)', moveClass.includes('detail-box-accent'), moveClass);
  const refClass = boxByTitle('反射豁免').className;
  ok('豁免框带蓝竖条(detail-box-accent)', refClass.includes('detail-box-accent'), refClass);

  // 需求：属性/技能表格按 生理/心智/互动 三系分组
  const groupLabels = host.querySelectorAll('.group-label').map((g)=>g._text);
  ok('属性/技能分组行含 生理系/心智系/互动系', ['生理系','心智系','互动系'].every((x)=>groupLabels.includes(x)), groupLabels);
  ok('分组行出现6次(属性3+技能3)', groupLabels.length === 6, groupLabels.length);
  // 属性表头部下有分组行：生理系 之后是 力量/敏捷/耐力
  const attrRows = host.querySelectorAll('tr');
  const firstGroupIdx = attrRows.findIndex((tr)=>tr.querySelector('.group-label') && tr.querySelector('.group-label')._text === '生理系');
  const physiologyAttrs = ['力量','敏捷','耐力'];
  const attrCells = attrRows.slice(firstGroupIdx+1, firstGroupIdx+4).map((tr)=>tr.querySelector('.row-label') && tr.querySelector('.row-label')._text);
  ok('生理系下依次为 力量/敏捷/耐力', JSON.stringify(attrCells) === JSON.stringify(physiologyAttrs), attrCells);

  // 敏感范围：仿派生值框（总计+加成 + 灰 tip 隐藏属性）
  const sensBox = boxByTitle('敏感范围');
  ok('敏感范围外框存在', !!sensBox);
  if (sensBox) {
    const t = sensBox.querySelector('.detail-box-total');
    ok('敏感范围总值=20', t && t._text === '20', t ? t._text : '(none)');
    ok('敏感范围带蓝竖条', sensBox.className.includes('detail-box-accent'), sensBox.className);
    const sensLabels = sensBox.querySelectorAll('.detail-input-label').map((l)=>l._text);
    ok('敏感范围含加成1..5', JSON.stringify(sensLabels) === JSON.stringify(['加成1','加成2','加成3','加成4','加成5']), sensLabels);
    const sensTip = sensBox.querySelector('.detail-tip');
    ok('敏感范围tip隐藏感知引用', sensTip && sensTip._text === '= 感知检定×10 + 传奇感知×20', sensTip?sensTip._text:'(no tip)');
  }
  const allSensLabels = host.querySelectorAll('.detail-input-label').map((l)=>l._text);
  ok('敏感范围目标值已删除', !allSensLabels.includes('敏感范围目标值（手动）'), allSensLabels);

  // 护甲合计带蓝竖条；伤害减免改版标题 + 类型/减免值/来源标签 + 删除
  const armorBox = boxByTitle('护甲合计');
  ok('护甲合计带蓝竖条', armorBox && armorBox.className.includes('detail-box-accent'), armorBox?armorBox.className:'(none)');
  const redBox = host.querySelectorAll('.detail-box').find((b)=>b.querySelector('.detail-box-title') && b.querySelector('.detail-box-title')._text === '伤害减免');
  ok('伤害减免框存在(标题已改)', !!redBox);
  if (redBox) {
    const redLabels = redBox.querySelectorAll('.detail-input-label').map((l)=>l._text);
    ok('伤害减免一行含 类型/减免值/来源', JSON.stringify(redLabels) === JSON.stringify(['类型','减免值','来源']), redLabels);
    ok('伤害减免含删除按钮', !!redBox.querySelector('.red-op-btn'), 'delete btn');
  }

  // 基础攻击：仿豁免 n+m 框；属性/技能隐含于 tip，传奇可见；右侧附加成功加值(3)
  const atkBox = boxByTitle('白刃攻击');
  ok('白刃攻击框存在(派生框)', !!atkBox);
  if (atkBox) {
    const atkTotal = atkBox.querySelector('.detail-box-total')._text;
    ok('白刃攻击总值=2(m0隐藏+m)', atkTotal === '2', atkTotal);
    ok('白刃攻击含右侧附加成功区', !!atkBox.querySelector('.detail-extra-succ'), 'extra-succ');
    const atkLabels = atkBox.querySelectorAll('.detail-input-label').map((l)=>l._text);
    ok('白刃攻击含传奇力量(可见)', atkLabels.includes('传奇力量'), atkLabels);
    ok('白刃攻击含加值1..3', ['加值1','加值2','加值3'].every((x)=>atkLabels.includes(x)), atkLabels);
    ok('白刃攻击tip隐藏属性/技能', atkBox.querySelector('.detail-tip')._text === '力量检定 + 白刃检定 · 伤害上限 2', atkBox.querySelector('.detail-tip')._text);
  }
  const semiBox = boxByTitle('半自动枪械攻击');
  ok('半自动攻击总值=n+m(11+2)', semiBox && semiBox.querySelector('.detail-box-total')._text === '11+2', semiBox?semiBox.querySelector('.detail-box-total')._text:'(none)');

  const geneBox = boxByTitle('基因锁熟练度');
  ok('基因锁外框存在', !!geneBox);
  if (geneBox) {
    const t = geneBox.querySelector('.value-status');
    ok('基因锁总计=0', t && t._text === '0', t ? t._text : '(none)');
  }

  // F1: 修改耐力基础后活刷生命值框；完好默认跟随总值
  character.attributes.stamina.base = 6; // leg1
  refreshAttrDetail();
  const hpBox = boxByTitle('生命值点数');
  const hpTotal = hpBox ? hpBox.querySelector('.detail-box-total')._text : '(none)';
  ok('F1 生命值派生活刷=12', hpTotal === '12', hpTotal);
  ok('生命值点数带蓝竖条', hpBox && hpBox.className.includes('detail-box-accent'), hpBox?hpBox.className:'(none)');
  const intactInp = hpBox ? hpBox.querySelectorAll('input')[0] : null;
  ok('完好默认=总值(12)', intactInp && Number(intactInp.value) === 12, intactInp ? String(intactInp.value) : '(none)');

  // ===== 总览(renderMainSheet)：n+m 值、无 tips、生命信息/防御信息顺序、生命按钮 =====
  document.querySelector('.sheet-body').appendChild(renderMainSheet());
  const secTitles = host.querySelectorAll('.section-title').map((x)=>x._text);
  ok('总览有「生命信息」与「防御信息」', secTitles.includes('生命信息') && secTitles.includes('防御信息'), secTitles);
  ok('防御信息紧跟生命信息之后', secTitles.indexOf('防御信息') === secTitles.indexOf('生命信息') + 1, secTitles);
  const byLab = (t)=>{ const c=host.querySelectorAll('.derived-cell').find((d)=>d.querySelector('.derived-label') && d.querySelector('.derived-label')._text === t); return c ? c.querySelector('.derived-value')._text : '(none)'; };
  const hintOf = (t)=>{ const c=host.querySelectorAll('.derived-cell').find((d)=>d.querySelector('.derived-label') && d.querySelector('.derived-label')._text === t); return c && c.querySelector('.derived-hint') ? c.querySelector('.derived-hint')._text : null; };
  ok('总览力量=2(m0隐藏+m)', byLab('力量') === '2', byLab('力量'));
  ok('总览敏捷=n+m(11+2)', byLab('敏捷') === '11+2', byLab('敏捷'));
  ok('总览运动=0(m0隐藏+m)', byLab('运动') === '0', byLab('运动'));
  ok('总览属性/技能无 tips', hintOf('力量') === null && hintOf('运动') === null, 'hints');
  ok('总览反射豁免=n+m(17+2)', byLab('反射豁免') === '17+2', byLab('反射豁免'));
  ok('总览反射tips保留', hintOf('反射豁免') === '敏捷 + 运动', hintOf('反射豁免'));
  ok('总览白刃攻击=2(m0隐藏+m)', byLab('白刃攻击') === '2', byLab('白刃攻击'));
  ok('总览白刃攻击tips仅含伤害上限', hintOf('白刃攻击') === '伤害上限 2', hintOf('白刃攻击'));
  const hpCell = host.querySelectorAll('.derived-cell').find((d)=>d.querySelector('.derived-label') && d.querySelector('.derived-label')._text === '生命值总量');
  ok('总览生命值总量=12(temp0隐藏+m)', hpCell && hpCell.querySelector('.derived-value')._text === '12', hpCell?hpCell.querySelector('.derived-value')._text:'(none)');
  const hpBtns = hpCell ? hpCell.querySelectorAll('.btn').map((b)=>b._text) : [];
  ok('生命信息含 回复生命/受到伤害 按钮', JSON.stringify(hpBtns) === JSON.stringify(['回复生命','受到伤害']), hpBtns);
  ok('生命控制区两个按钮行', hpCell ? hpCell.querySelectorAll('.health-action').length === 2 : 0, 'actions');
  ok('生命控制区两个输入框', hpCell ? hpCell.querySelectorAll('input').length === 2 : 0, 'inputs');

  console.log(results.join('\\n'));
  return results;
})();
`;
vm.runInContext(src + '\n' + TEST, sandbox);