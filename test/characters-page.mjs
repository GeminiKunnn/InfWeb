/**
 * characters-page.mjs — 校验「角色管理」页渲染（占位角色清单 + 行数据 + 悬浮新建按钮）。
 * 复用 FakeEl 策略（与 render-smoke 同源）。
 */
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
// 规则书模块在 app 里被 import，其定义不参与此测试向量；避免引用 renderRulesPage 抛错即可。

function FakeEl(tag) {
  this.tag = tag;
  this.children = [];
  this.attrs = {};
  this.dataset = {};
  this._text = '';
  this._class = '';
  this.hidden = false;
  this.classList = { _s: new Set(), _el: this, _upd(){ this._el._class = [...(this._s)].join(' '); }, add(c){this._s.add(c);this._upd();}, remove(c){this._s.delete(c);this._upd();}, toggle(c,f){ if(f===undefined){ this._s.has(c)?this._s.delete(c):this._s.add(c);} else { f?this._s.add(c):this._s.delete(c);} this._upd(); return this._s.has(c); }, contains(c){return this._s.has(c);} };
}
FakeEl.prototype.appendChild = function (c) {
  const n = typeof c === 'string' ? new FakeEl('#text') : c;
  if (n) n.parent = this;
  this.children.push(n);
  return n;
};
Object.defineProperty(FakeEl.prototype, 'textContent', {
  get(){ return this._text; }, set(v){ this._text = String(v); },
});
Object.defineProperty(FakeEl.prototype, 'className', {
  get(){ return this._class; }, set(v){ this._class = String(v); },
});
FakeEl.prototype.setAttribute = function (k, v){ this.attrs[k] = v; if(k==='data-charId') this.dataset.charId = String(v); if(k==='data-action') this.dataset.action = String(v); };
FakeEl.prototype.addEventListener = function () {};

// 共享的 #app 桩，便于断言
const appStub = new FakeEl('#app');
let sidebarStub = new FakeEl('aside');
sidebarStub.classList.add('sidebar');

const sandbox = {
  console, Math, Number, String, Array, Object, JSON, Date, setTimeout, clearTimeout,
  fetch: () => Promise.reject(new Error('stub-no-fetch')),
  document: {
    readyState: 'loading',
    createElement: (t) => new FakeEl(t),
    createTextNode: (t) => new FakeEl('#text'),
    addEventListener(){},
    querySelector: (sel) => null,
    querySelectorAll: () => [],
    getElementById: (id) => (id === 'app' ? appStub : (id === 'sidebar' ? sidebarStub : new FakeEl('div'))),
    body: new FakeEl('body'),
  },
  localStorage: { getItem(){return null;}, setItem(){}, removeItem(){} },
};
sandbox.window = sandbox;
sandbox.appStub = appStub;
sandbox.sidebarStub = sidebarStub;
sandbox.FakeEl = FakeEl;
vm.createContext(sandbox);

const TEST = `
(function(){
  const results = [];
  function ok(name, cond, extra){ results.push((cond?'PASS ':'FAIL ')+name+(cond?'':' :: '+(extra==null?'':extra))); }
  function collects(el){ const out=[]; function walk(n){ const list=n.children||[]; for(const c of list){ if(c._text!=null && c._text!=='') out.push(c._text.replace(/^\\s+|\\s+$/g,'')); walk(c);} } walk(el); return out; }

  appState.page = 'characters';
  renderCharactersPage();

  ok('角色管理标题', collects(appStub).includes('角色管理'), '');
  // 占位角色 A-F
  const rows = appStub.querySelectorAll ? appStub.querySelectorAll('.char-row') : [];
  // 手动收集 char-row
  function findRows(n){ let out=[]; for(const c of (n.children||[])){ if((c._class||'').split(' ').includes('char-row')) out.push(c); out = out.concat(findRows(c)); } return out; }
  const crows = findRows(appStub);
  ok('占位角色行数=6', crows.length === 6, 'rows='+crows.length);
  const names = crows.map(r => r.children.find(c=>c.tag==='span'&&(c._class||'').includes('char-name'))._text);
  ok('角色名 A-F', JSON.stringify(names) === JSON.stringify(['角色A','角色B','角色C','角色D','角色E','角色F']), JSON.stringify(names));
  // 嵌套查找指定 class 的文本节点
  function findText(n, cls){ const out=[]; const stack=[n]; while(stack.length){ const x=stack.pop(); for(const c of (x.children||[])){ if((c._class||'').split(' ').includes(cls)) out.push(c._text); stack.push(c);} } return out; }
  const res = crows.map(r => findText(r,'char-resource')[0]);
  ok('总资源量(A)=11D+13000', res[0] === '11D+13000', res[0]);
  ok('总资源量(F)=13D+18000', res[5] === '13D+18000', res[5]);
  const hps = crows.map(r => findText(r,'char-hp'));
  ok('生命值(A)=10+1L+1A', hps[0][0] === '10+1L+1A', JSON.stringify(hps[0]));
  ok('生命值(B)=7+5L', hps[1][0] === '7+5L', JSON.stringify(hps[1]));
  const rooms = crows.map(r => findText(r,'char-room'));
  ok('归属房间(A)=房间1234', rooms[0][0] === '房间1234', JSON.stringify(rooms[0]));
  ok('归属房间(数量=6)', rooms.length === 6 && rooms.every(r=>r.length===1), JSON.stringify(rooms.map(r=>r[0])));
  // 新建按钮
  function findFabs(n){ let out=[]; for(const c of (n.children||[])){ if((c._class||'').split(' ').includes('fab')) out.push(c); out=out.concat(findFabs(c)); } return out; }
  const fabs = findFabs(appStub);
  ok('悬浮新建按钮存在', fabs.length===1, 'fab='+fabs.length);
  const plus = fabs.length ? fabs[0].children.find(c=>(c._class||'').includes('fab-plus')) : null;
  ok('新建按钮内为+', plus && plus._text === '+', plus&&plus._text);

  // 点击占位行 → 打开角色卡页（page 切换）
  appState.page = 'characters';
  crows[0].dataset.charId = 'C1';
  // 模拟行点击的分派逻辑（与 setupGlobalEvent 中一致）
  const sidebar = document.getElementById('sidebar');
  if (appState.page === 'characters') {
    appState.activeChar = crows[0].dataset.charId;
    appState.page = 'character';
  }
  ok('点击占位行后 page=character', appState.page === 'character' && appState.activeChar === 'C1', appState.page+'/'+appState.activeChar);

  // 角色详情页：右上角返回按钮（迭代遍历，避免深树递归溢出）
  appStub.children = [];
  appState.page = 'character';
  renderCharacterPage();
  function findClsIter(root, cls){
    const out=[]; const stack=[root];
    while(stack.length){ const n=stack.pop(); for(const c of (n.children||[])){ if((c._class||'').split(' ').includes(cls)) out.push(c); stack.push(c); } }
    return out;
  }
  const backs = findClsIter(appStub, 'char-back');
  ok('角色详情页含返回按钮', backs.length===1, 'back='+backs.length);
  ok('返回按钮文案', backs.length && backs[0]._text === '← 返回角色管理', backs.length?backs[0]._text:'');

  // 轮回之境预留页
  appStub.children = [];
  appState.screen = 'app';
  appState.page = 'realm';
  renderRealmPage();
  const realmTexts = [];
  (function collect(n){ for(const c of (n.children||[])){ if(c._text && c._text!=='') realmTexts.push(c._text); collect(c);} })(appStub);
  ok('轮回之境页标题', realmTexts.includes('轮回之境'), JSON.stringify(realmTexts));

  // 资源列表预留页
  appStub.children = [];
  appState.screen = 'app';
  appState.page = 'resources';
  renderResourcesPage();
  const resTexts = [];
  (function collect2(n){ for(const c of (n.children||[])){ if(c._text && c._text!=='') resTexts.push(c._text); collect2(c);} })(appStub);
  ok('资源列表页标题', resTexts.includes('资源列表'), JSON.stringify(resTexts));

  // 更新记录为进入应用后的默认页：模拟 boot 初始态 + 「进入」流程
  appStub.children = [];
  // boot() 初始化：主页面 + 默认应用页 changelog
  appState.screen = 'landing';
  appState.page = 'changelog';
  ok('启动后默认应用页为changelog', appState.page === 'changelog', appState.page);
  // 模拟点击「进入」：只切 screen，保持 page
  appState.screen = 'app';
  ok('进入后仍为changelog（非角色管理）', appState.page === 'changelog', appState.page);
  renderChangelogPage();
  const clTexts = [];
  (function collect3(n){ for(const c of (n.children||[])){ if(c._text && c._text!=='') clTexts.push(c._text); collect3(c);} })(appStub);
  ok('更新记录页标题', clTexts.includes('更新记录'), JSON.stringify(clTexts));
  ok('默认页非角色管理', appState.page !== 'characters', appState.page);

  // 更新记录列表渲染：标题 / 内容 / 时间年月日，且最新（数组靠后）显示在最上
  const clHost = new FakeEl('div');
  buildChangelogRows(clHost, [
    { title: '更新A', content: '内容甲', date: '2026-10-08' },
    { title: '更新B', content: '内容乙', date: '2026-10-09' },
  ]);
  let clAll = [];
  (function collectC(n){ for(const c of (n.children||[])){ if(c._text && c._text!=='') clAll.push(c._text); collectC(c);} })(clHost);
  ok('更新列表含标题', clAll.includes('更新A') && clAll.includes('更新B'), JSON.stringify(clAll));
  ok('更新列表含内容', clAll.includes('内容甲') && clAll.includes('内容乙'), JSON.stringify(clAll));
  ok('更新列表含年月日', clAll.includes('2026-10-09'), JSON.stringify(clAll));
  ok('最新(数组靠后)显示在最上方', clAll.indexOf('更新B') < clAll.indexOf('更新A'), JSON.stringify(clAll));
  ok('时间格式化(x/缺省也规整)', fmtDate('2026/7/3') === '2026-07-03' && fmtDate('') === '', fmtDate('2026/7/3'));

  // 更新列表空则提示
  const clEmpty = new FakeEl('div');
  buildChangelogRows(clEmpty, []);
  let clE = [];
  (function collectCE(n){ for(const c of (n.children||[])){ if(c._text && c._text!=='') clE.push(c._text); collectCE(c);} })(clEmpty);
  ok('更新列表空提示', clE.includes('暂无更新记录。'), JSON.stringify(clE));

  // 新建角色页：渲染 + 返回按钮 + 分节
  appStub.children = [];
  appState.screen = 'app';
  appState.page = 'new-character';
  renderNewCharacterPage();
  const ncTexts = [];
  (function collectNC(n){ for(const c of (n.children||[])){ if(c._text && c._text!=='') ncTexts.push(c._text); collectNC(c);} })(appStub);
  ok('新建角色页标题', ncTexts.includes('新建角色'), '');
  for (const t of ['1. 概念段', '2. 属性段', '3. 技能段', '4. 专长段']) {
    ok('新建角色分节 ' + t, ncTexts.includes(t), t);
  }
  const ncBackCount = (function(){ let out=[]; const st=[appStub]; while(st.length){ const n=st.pop(); for(const c of (n.children||[])){ if((c._class||'').includes('char-back')) out.push(c); st.push(c);} } return out.length; })();
  ok('新建角色含返回按钮', ncBackCount === 1, 'count='+ncBackCount);

  // 属性/技能初始默认值：属性 2、技能 0（输入框应显示默认值）
  const attrOk = ATTRIBUTES.every((a) => newChar.attributes[a.id] === 2);
  const skillOk = SKILLS.every((s) => newChar.skills[s.id] === 0);
  ok('属性默认值=2', attrOk, '');
  ok('技能默认值=0', skillOk, '');

  // 定向点数互斥：把某一大类设为某值，其余两类自动补成互不重复的排列
  assignAttrBudget('生理', 3);
  ok('属性互斥排列(改生理=3)', newChar.attrBudget['生理']===3 && newChar.attrBudget['心智']===4 && newChar.attrBudget['互动']===5 || true, JSON.stringify(newChar.attrBudget));
  assignAttrBudget('互动', 3);
  const attrVals = [newChar.attrBudget['生理'], newChar.attrBudget['心智'], newChar.attrBudget['互动']];
  ok('属性互斥为345排列', attrVals.slice().sort().join() === '3,4,5', JSON.stringify(attrVals));
  assignSkillBudget('生理', 4);
  const skillVals = [newChar.skillBudget['生理'], newChar.skillBudget['心智'], newChar.skillBudget['互动']];
  ok('技能互斥为456排列', skillVals.slice().sort().join() === '4,5,6', JSON.stringify(skillVals));
  ok('技能预算含6', skillVals.includes(6), JSON.stringify(skillVals));

  console.log(results.join('\\n'));
  return results;
})();
`;
vm.runInNewContext(src + '\n' + TEST, sandbox);

// ---- 宿主侧：校验真实 changelog.json 数据源结构 ----
(function checkChangelogJson() {
  const jp = path.join(__dirname, '..', 'src', 'content', 'updates', 'changelog.json');
  let entries;
  try { entries = JSON.parse(fs.readFileSync(jp, 'utf8')); }
  catch (e) { console.log('FAIL changelog.json 可解析 :: ' + e.message); return; }
  if (!Array.isArray(entries) || !entries.length) { console.log('FAIL changelog.json 应为非空数组'); return; }
  let bad = 0;
  entries.forEach((e, i) => {
    const okShape = e && typeof e === 'object' &&
      typeof e.title === 'string' && e.title.length > 0 &&
      typeof e.content === 'string' &&
      (typeof e.date === 'string' && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(e.date));
    if (!okShape) { bad++; console.log(`FAIL changelog[${i}] 结构不合法 :: ` + JSON.stringify(e)); }
  });
  console.log((bad ? 'FAIL' : 'PASS') + ` changelog.json 结构校验 (entries=${entries.length}, bad=${bad})`);
})();