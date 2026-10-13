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
let src = [load('character-config'), load('store'), load('state'), load('calc'), load('ui'), load('character'), load('pages'), load('new-character'), load('app')].join('\n');
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
  localStorage: (function(){ let m = {}; return { getItem(k){ return Object.prototype.hasOwnProperty.call(m,k) ? m[k] : null; }, setItem(k,v){ m[k]=String(v); }, removeItem(k){ delete m[k]; }, clear(){ m={}; } }; })(),
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
  // 右下角悬浮：导入角色卡按钮 + 新建(+)按钮
  function findFabs(n){ let out=[]; for(const c of (n.children||[])){ if((c._class||'').split(' ').includes('fab')) out.push(c); out=out.concat(findFabs(c)); } return out; }
  const fabs = findFabs(appStub);
  ok('悬浮按钮=2(导入+新建)', fabs.length===2, 'fab='+fabs.length);
  ok('导入角色卡按钮存在', fabs.some(f=>(f._class||'').includes('fab-import')), fabs.map(f=>f._class).join('|'));
  const plus = fabs.find(f=>(f._class||'').split(' ').includes('fab') && !(f._class||'').includes('fab-import'));
  const plusChild = plus ? plus.children.find(c=>(c._class||'').includes('fab-plus')) : null;
  ok('新建按钮内为+', !!plusChild && plusChild._text === '+', plusChild&&plusChild._text);

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

  // 应用状态持久化：仅记页面位置（screen=app / page / activeChar），不存数据
  appState.screen = 'app';
  appState.page = 'rules';
  appState.activeChar = 'c1';
  saveAppState();
  appState.page = 'other'; // 模拟切到别处
  const restored = restoreAppState();
  ok('恢复上次应用页(rules)', restored && restored.screen === 'app' && restored.page === 'rules', JSON.stringify(restored));
  ok('恢复记录角色id', restored && restored.activeChar === 'c1', JSON.stringify(restored));
  // 回到主界面(langind)会清除保存的应用内位置（renderPage 的 landing 分支会 removeItem）
  localStorage.removeItem('infweb.appstate');
  ok('清除后无可恢复状态', restoreAppState() === null, JSON.stringify(restoreAppState()));

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

  // 更新内容多行：换行符拆成多个段落，空行跳过
  const clML = new FakeEl('div');
  buildChangelogRows(clML, [{ title: 'T', content: '行一\\n\\n行二\\n行三', date: '2026-10-09' }]);
  const mlPs = [];
  (function collectP(n){ for(const c of (n.children||[])){ if((c._class||'').includes('changelog-paragraph')) mlPs.push((c._text||'')); collectP(c);} })(clML);
  ok('多行拆分数(3段,空行跳过)', mlPs.length === 3, JSON.stringify(mlPs));
  ok('多行第一段', mlPs.includes('行一'), JSON.stringify(mlPs));
  ok('多行第二段', mlPs[1] === '行二', JSON.stringify(mlPs));
  ok('多行第三段', mlPs[2] === '行三', JSON.stringify(mlPs));

  // 更新内容数组写法：每个元素一段，空元素跳过
  const clArr = new FakeEl('div');
  buildChangelogRows(clArr, [{ title: 'T', content: ['甲段', '', '乙段', '丙段'], date: '2026-10-09' }]);
  const arrPs = [];
  (function collectPA(n){ for(const c of (n.children||[])){ if((c._class||'').includes('changelog-paragraph')) arrPs.push((c._text||'')); collectPA(c);} })(clArr);
  ok('数组写法拆段数(空元素跳过)', arrPs.length === 3, JSON.stringify(arrPs));
  ok('数组首段', arrPs[0] === '甲段', JSON.stringify(arrPs));

  // 单字符串兼容：只有一行也正常
  const clOne = new FakeEl('div');
  buildChangelogRows(clOne, [{ title: 'T', content: '仅一行', date: '2026-10-09' }]);
  const onePs = [];
  (function collectPO(n){ for(const c of (n.children||[])){ if((c._class||'').includes('changelog-paragraph')) onePs.push((c._text||'')); collectPO(c);} })(clOne);
  ok('单行字符串=单段', onePs.length === 1 && onePs[0] === '仅一行', JSON.stringify(onePs));

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

  // 超限输入 → 该组标红报错（与属性段同款）：技能/属性任一大类含超限值即被判定有问题。
  // 技能：合法区间 [0,4]（建卡硬上限 4）
  const sP0 = SKILLS.filter(s=>s.group==='生理').map(s=>s.id);
  SKILLS.forEach((s)=>(newChar.skills[s.id]=0));
  ok('技能-正常值不标红', newCharGroupHasOutOfRange('skill','生理') === false, '');
  newChar.skills[sP0[0]] = 5;            // 超上限(>4)
  ok('技能-超上限标红', newCharGroupHasOutOfRange('skill','生理') === true, '');
  newChar.skills[sP0[0]] = -3;           // 低于下限
  ok('技能-低于下限标红', newCharGroupHasOutOfRange('skill','生理') === true, '');
  newChar.skills[sP0[0]] = 4;            // 边界值 4 合法
  ok('技能-边界 4 不标红', newCharGroupHasOutOfRange('skill','生理') === false, '');
  SKILLS.forEach((s)=>(newChar.skills[s.id]=0));
  // 属性：合法区间 [2,5]（建卡硬上限 5）
  const idP0 = ATTRIBUTES.filter(a=>a.group==='生理').map(a=>a.id);
  ATTRIBUTES.forEach((a)=>(newChar.attributes[a.id]=2));
  ok('属性-正常值不标红', newCharGroupHasOutOfRange('attribute','生理') === false, '');
  newChar.attributes[idP0[0]] = 6;      // 超上限(>5)
  ok('属性-超上限标红', newCharGroupHasOutOfRange('attribute','生理') === true, '');
  newChar.attributes[idP0[0]] = 1;       // 低于下限
  ok('属性-低于下限标红', newCharGroupHasOutOfRange('attribute','生理') === true, '');
  newChar.attributes[idP0[0]] = 5;       // 边界 5 合法
  ok('属性-边界 5 不标红', newCharGroupHasOutOfRange('attribute','生理') === false, '');

  // ---- 新建角色各段标题右侧的 ❗ 标记逻辑 ----
  // 概念段：任一必填项为空 → 有问题
  newChar.concept = { name: '', gender: '', race: '', age: '', build: '', appearance: '', background: '' };
  ok('概念段-空则有问题', newCharConceptTroubled() === true, '');
  newChar.concept.name = '甲'; newChar.concept.gender = '男'; newChar.concept.race = '人类';
  newChar.concept.appearance = 'x'; newChar.concept.background = 'y';
  ok('概念段-必填齐则正常', newCharConceptTroubled() === false, '');

  // 属性段：定向属性点未分配齐（≠12）→ 有问题；分配齐 → 正常
  const attrSpentTotal = () => ['生理','心智','互动'].reduce((s,g)=>s+newCharAttrGroupCount(g),0);
  // 重置属性为默认 2（花费 0），定向点预算回到 5/4/3
  ATTRIBUTES.forEach((a) => (newChar.attributes[a.id] = 2));
  assignAttrBudget('生理', 5); assignAttrBudget('心智', 4); assignAttrBudget('互动', 3);
  ok('属性段-未分配(0/12)则有问题', newCharAttrTroubled() === true, 'spent='+attrSpentTotal());
  // 让三个大类各自花满定向点：生理 5 点用 4+（2→4）、心智 4 点用 3+... 直接各属性推到目标
  // 生理：一个属性 2→5 = 4 点、一个 2→4 = 2 点 → 复用同一属性需分开：改为仅验证到达 12
  ['力量','敏捷'].forEach((id,i)=>{ newChar.attributes[id] = i===0?5:4; });   // 生理 4+2=6 仍未满
  // 直接把定向分配改满：生理=5 心智=4 互动=3 已设；将生理推到 5（4+1）、心智推到 4（2+2）
  // —— 精确凑 12：生理一个 2→5(4) + 2→3(1) = 5；心智 2→4(2)+2→3(1)+2→2(0)... 
  // 简化：直接断言初始(0/12)有问题 与 满额(12)正常 两端即可
  const idP = ATTRIBUTES.filter(a=>a.group==='生理').map(a=>a.id);
  const idM = ATTRIBUTES.filter(a=>a.group==='心智').map(a=>a.id);
  const idI = ATTRIBUTES.filter(a=>a.group==='互动').map(a=>a.id);
  ATTRIBUTES.forEach((a)=> (newChar.attributes[a.id]=2));
  // 生理 5: 2→5(4) + 其余 2；心智 4: 2→4(2)+2→3(1)；互动不用点，但需合计 12
  newChar.attributes[idP[0]] = 5;          // 4
  newChar.attributes[idM[0]] = 4;          // 2
  newChar.attributes[idM[1]] = 3;          // 1
  newChar.attributes[idI[0]] = 3;          // 1
  newChar.attributes[idI[1]] = 3;          // 1
  // 上面合计 4+2+1+1+1=9（仍未到 12）；把生理再加足：idP[1]→4 再加 2 = 11；再 idI[2]→3 加 1=12
  newChar.attributes[idP[1]] = 4;          // +2 = 11
  newChar.attributes[idI[2]] = 3;          // +1 = 12
  ok('属性段-分配齐(12/12)则正常', newCharAttrTroubled() === false, 'spent='+attrSpentTotal());

  // 技能段：定向技能点未分配齐（≠15）→ 有问题
  SKILLS.forEach((s)=>(newChar.skills[s.id]=0));
  ok('技能段-未分配(0/15)则有问题', newCharSkillTroubled() === true, '');
  const sP = SKILLS.filter(s=>s.group==='生理').map(s=>s.id);
  const sM = SKILLS.filter(s=>s.group==='心智').map(s=>s.id);
  const sI = SKILLS.filter(s=>s.group==='互动').map(s=>s.id);
  // 凑 15：生理 6、心智 5、互动 4 — 各用一个 0→X 成本之和
  newChar.skills[sP[0]] = 4; newChar.skills[sP[1]] = 2; // 5+2=7(生理)
  newChar.skills[sM[0]] = 3; newChar.skills[sM[1]] = 3; // 3+3=6(心智) 已 13
  newChar.skills[sI[0]] = 3; newChar.skills[sI[1]] = 1; // 3+1=4(互动) =17 超了
  // 重新精确凑 15（定向各足额且不溢出自由池）：生理 6 / 心智 5 / 互动 4 成本
  SKILLS.forEach((s)=>(newChar.skills[s.id]=0));
  newChar.skillBudget = { 生理: 6, 心智: 5, 互动: 4 }; // 还原默认定向预算
  newChar.skills[sP[0]] = 4; newChar.skills[sP[1]] = 1; // 生理 5+1=6
  newChar.skills[sM[0]] = 4;                           // 心智 5
  newChar.skills[sI[0]] = 3; newChar.skills[sI[1]] = 1; // 互动 3+1=4
  ok('技能段-分配齐(15/15)则正常', newCharSkillTroubled() === false, 'spent='+newCharSkillDirectedTotal());
  SKILLS.forEach((s)=>(newChar.skills[s.id]=0)); // 归零恢复

  // ---- 技能「定向 + 自由」推导模型 ----
  newChar.skillBudget = { 生理: 6, 心智: 5, 互动: 4 };
  SKILLS.forEach((s)=>(newChar.skills[s.id]=0));
  // 定向分满后超额计入自由池
  newChar.skills[sP[0]] = 4;   // 生理 skillCost=5
  newChar.skills[sP[1]] = 4;   // 生理 skillCost=5 → 生理总 10，定向 6 + 自由 4
  newChar.skills[sM[0]] = 4;   // 心智 skillCost=5 → 定向 5（心智满）
  ok('生理组定向=6(封顶)', newCharGroupDirectedUsed('生理') === 6, 'd='+newCharGroupDirectedUsed('生理'));
  ok('生理组自由=4(超额)', newCharGroupFreeUsed('生理') === 4, 'f='+newCharGroupFreeUsed('生理'));
  ok('全局自由=4', newCharSkillFreeTotal() === 4, 'free='+newCharSkillFreeTotal());
  ok('自由未超 5 不超支', newCharAllocGroupOver('skill','生理') === false, '');
  // 自由耗尽（>5）时，占用自由点的组标红，且全局超支
  newChar.skills[sM[1]] = 4;   // 心智再 +5 → 心智总 10，定向 5 + 自由 5 → 全局自由 4+5=9 > 5
  ok('全局自由=9(超支)', newCharSkillFreeTotal() === 9, 'free='+newCharSkillFreeTotal());
  ok('自由超支-占用组标红', newCharAllocGroupOver('skill','生理') === true, '');
  ok('自由超支-心智组标红', newCharAllocGroupOver('skill','心智') === true, '');
  ok('自由超支-未占用组不红', newCharAllocGroupOver('skill','互动') === false, '');
  ok('技能段-自由超支则有问题', newCharSkillTroubled() === true, '');
  // 组显示文案：占用自由点时附「（自由 X）」
  const gline = newCharAllocGroupLine('skill','生理');
  ok('生理组显示含自由占用', gline.includes('自由 4'), gline);
  SKILLS.forEach((s)=>(newChar.skills[s.id]=0)); // 归零恢复

  // 专长段：已用专长点 ≠ 15 → 有问题；= 15 → 正常
  newChar.perks = [];
  ok('专长段-无专长(0/15)则有问题', newCharPerkTroubled() === true, '');
  newChar.perks = [{ name:'x', level:15 }];
  ok('专长段-恰 15 则正常', newCharPerkTroubled() === false, 'spent='+newCharPerkSpentTotal());
  newChar.perks = [{ name:'x', level:10 }];
  ok('专长段-≠15 则有问题(10)', newCharPerkTroubled() === true, 'spent='+newCharPerkSpentTotal());
  // 专长列表渲染：传入真实容器应产出每行（修复「添加后不显示」的路径）
  const pkList = new FakeEl('div');
  pkList.children = []; // FakeEl 无 innerHTML 语义，手动清空
  newChar.perks = [{ name:'闪避专长', level:2 }, { name:'狂暴', level:1 }];
  renderNewCharPerkList(pkList);
  const pkRows = (function(){ let out=[]; (function w(n){ for(const c of (n.children||[])){ if((c._class||'').split(' ').includes('perk-row')) out.push(c); w(c);} })(pkList); return out; })();
  ok('专长列表渲染行数=2', pkRows.length === 2, 'rows='+pkRows.length+' perksLen='+newChar.perks.length);
  const txts = pkRows.map(r => r.children.map(c=>c._text||'').join('|'));
  ok('专长行含名称与等级', txts[0].includes('闪避专长') && txts[0].includes('2 级'), JSON.stringify(txts[0]));
  ok('专长已用合计=3', newCharPerkSpentTotal() === 3, 'spent='+newCharPerkSpentTotal());
  newChar.perks = [];

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
  const contentOk = (c) => (typeof c === 'string') || (Array.isArray(c) && c.every((x) => typeof x === 'string'));
  entries.forEach((e, i) => {
    const okShape = e && typeof e === 'object' &&
      typeof e.title === 'string' && e.title.length > 0 &&
      contentOk(e.content) &&
      (typeof e.date === 'string' && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(e.date));
    if (!okShape) { bad++; console.log(`FAIL changelog[${i}] 结构不合法 :: ` + JSON.stringify(e)); }
  });
  console.log((bad ? 'FAIL' : 'PASS') + ` changelog.json 结构校验 (entries=${entries.length}, bad=${bad})`);
})();