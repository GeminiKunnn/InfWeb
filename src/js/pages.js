/**
 * pages.js
 * 页面级渲染：主页面(landing)、角色管理(characters)、规则书、资源、轮回之境、其他、更新记录。
 * 每个函数负责把一个「应用内页面」渲染进 #app。不含用户交互委托（事件委托在 app.js）。
 *
 * 依赖：ui.js(el)、state.js(appState)、rules.js(renderRulesPage) —— 均非反向依赖 app.js。
 */
import { renderRulesPage as renderRulesPageFromModule } from './rules.js';
import { el } from './ui.js';
import { appState } from './state.js';

/** 空页面骨架。 */
function renderEmptyPage(title, note) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(
    el('div', { class: 'blank-page' }, [
      el('h2', { text: title }),
      el('p', { class: 'muted', text: note }),
    ])
  );
}

async function renderRulesPage() {
  await renderRulesPageFromModule();
}

function renderOtherPage() {
  renderEmptyPage('其他', '预留页面，暂无内容。');
}

function renderResourcesPage() {
  renderEmptyPage('资源列表', '资源列表页面预留，后续展示后端资源目录（各资源的 bonus 与描述）。');
}

function renderRealmPage() {
  renderEmptyPage('轮回之境', '轮回之境页面预留，后续开发：游戏组 / 房间 / 多单位施效等。');
}

async function renderChangelogPage() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  app.appendChild(
    el('header', { class: 'masthead' }, [
      el('h1', { text: '更新记录' }),
      el('p', { class: 'subtitle', text: '版本与功能更新一览' }),
    ])
  );

  const listEl = el('div', { class: 'changelog-list' });
  app.appendChild(listEl);

  try {
    // 用「相对于站点根」的绝对路径拉取，兼容本地(/)与 GitHub Pages(/InfWebPages/) 子路径部署。
    // 附加一个时间戳参数，规避浏览器/CDN 对旧 changelog.json 的强缓存。
    const res = await fetch(assetPath('content/updates/changelog.json') + '?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const entries = await res.json();
    buildChangelogRows(listEl, entries);
  } catch (err) {
    listEl.appendChild(
      el('div', { class: 'changelog-error' }, [
        el('span', { class: 'muted', text: '更新记录加载失败：' + err.message }),
      ])
    );
  }
}

// 依据当前文档 URL 推导站点根，再拼上相对路径（返回可 fetch 的绝对路径）。
// 兼容：本地 http://host/ 与 GitHub Pages http://host/InfWebPages/ 子路径；即使地址栏缺尾斜杠也能纠正。
function assetPath(relative) {
  let base;
  try {
    base = new URL('.', document.baseURI).href;
  } catch (e) {
    base = location.href;
  }
  const url = new URL(base);
  if (!url.pathname.endsWith('/')) {
    const p = (location.pathname.split('?')[0] || '/');
    const dir = p.slice(0, p.lastIndexOf('/') + 1);
    return new URL(dir + relative, location.href).href;
  }
  return new URL(relative, url).href;
}

// 把 changelog 条目渲染进列表容器（同步、可独立测试）。
// 约定：JSON 数组中越靠上方=越旧、越靠下方=越新；页面展示时最新在上（倒序遍历）。
function buildChangelogRows(host, entries) {
  host.innerHTML = '';
  if (!Array.isArray(entries) || !entries.length) {
    host.appendChild(el('p', { class: 'muted', text: '暂无更新记录。' }));
    return;
  }
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    const row = el('div', { class: 'changelog-item' });
    const head = el('div', { class: 'changelog-head' });
    head.appendChild(el('span', { class: 'changelog-title', text: e.title || '' }));
    head.appendChild(el('span', { class: 'changelog-date', text: fmtDate(e.date) }));
    row.appendChild(head);
    const body = el('div', { class: 'changelog-content' });
    schemaifyChangelogContent(e.content).forEach((seg) => {
      const t = seg.trim();
      if (!t) return;
      body.appendChild(el('p', { class: 'changelog-paragraph', text: t }));
    });
    if (body.children.length === 0) body.appendChild(el('p', { class: 'changelog-paragraph', text: '' }));
    row.appendChild(body);
    host.appendChild(row);
  }
}

// 把 changelog 的 content 规整成段落数组：数组→按元素；字符串（旧格式）→按 \n 拆且视为单元素兼容。
function schemaifyChangelogContent(content) {
  if (Array.isArray(content)) return content.slice();
  return String(content == null ? '' : content).split(/\r?\n/);
}

// 时间格式化：仅显示年月日（2016-10-09 或 2016/10/09 皆可），空则显示空字符串。
function fmtDate(d) {
  if (!d) return '';
  const s = String(d).trim();
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  return s;
}

/* ------------------------- 主页面（landing） ------------------------- */

/** 主页面：入口欢迎页。应用界面由「进入」按钮进入。 */
function renderLandingPage() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const page = el('div', { class: 'landing' }, [
    el('div', { class: 'landing-hero' }, [
      el('div', { class: 'landing-mark' }, [el('span', { text: '∞' })]),
      el('h1', { class: 'landing-title', text: '鲲版无限网页角色卡' }),
      el('p', { class: 'landing-sub', text: '角色 · 资源 一站式管理' }),
      el('button', { type: 'button', class: 'landing-enter', dataset: { action: 'enter-app' } }, [
        el('span', { text: '进入' }),
        el('span', { class: 'landing-enter-arrow', text: ' →' }),
      ]),
      el('p', { class: 'landing-hint', text: '点击进入开始使用角色卡' }),
    ]),
  ]);
  app.appendChild(page);
}

/* ------------------------- 角色管理（characters） ------------------------- */

/** 占位角色清单：后端就绪前用假数据（角色A-F，总资源量 / 生命值 / 归属房间）。 */
function placeholderCharacters() {
  const rows = [
    { resource: '11D+13000', hp: '10+1L+1A', room: '房间1234' },
    { resource: '9D+9000', hp: '7+5L', room: '房间1235' },
    { resource: '12D+15000', hp: '12+2L+2A', room: '房间1236' },
    { resource: '8D+7000', hp: '6+1L', room: '房间1234' },
    { resource: '10D+11000', hp: '11+3L', room: '房间1237' },
    { resource: '13D+18000', hp: '9+4L+1A', room: '房间1235' },
  ];
  return rows.map((r, i) => ({
    id: 'C' + (i + 1),
    name: '角色' + String.fromCharCode(65 + i), // 角色A-F
    resource: r.resource,
    hp: r.hp,
    room: r.room,
  }));
}

/**
 * 渲染「角色管理」页面：按行展示拥有的角色卡（占位数据）。
 * 点击行 → 打开对应角色卡；右下角悬浮「+」新建按钮 与「导入」按钮。
 */
function renderCharactersPage() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  app.appendChild(
    el('header', { class: 'masthead' }, [
      el('h1', { text: '角色管理' }),
      el('p', { class: 'subtitle', text: '选择要打开的角色卡，或新建一个角色' }),
    ])
  );

  const chars = placeholderCharacters();
  const list = el('div', { class: 'char-list' });
  chars.forEach((c) => {
    const row = el('button', { type: 'button', class: 'char-row', dataset: { charId: c.id } }, [
      el('span', { class: 'char-name', text: c.name }),
      el('div', { class: 'char-meta' }, [
        el('span', { class: 'char-kv' }, [
          el('em', { class: 'char-kv-label', text: '总资源' }),
          el('span', { class: 'char-resource', text: c.resource }),
        ]),
        el('span', { class: 'char-kv' }, [
          el('em', { class: 'char-kv-label', text: '生命值' }),
          el('span', { class: 'char-hp', text: c.hp }),
        ]),
        el('span', { class: 'char-kv' }, [
          el('em', { class: 'char-kv-label', text: '归属房间' }),
          el('span', { class: 'char-room', text: c.room }),
        ]),
      ]),
      el('span', { class: 'char-open', text: '点击查看' }),
    ]);
    list.appendChild(row);
  });
  app.appendChild(list);
  app.appendChild(el('div', { class: 'char-empty-note', text: '（以上为占位数据仅作展示）' }));

  // 右下角悬浮「导入角色卡」（在「＋ 新建」左侧）+「新建角色」按钮
  const importBtn = el('button', {
    type: 'button',
    class: 'fab fab-import',
    dataset: { action: 'open-import' },
    title: '导入角色卡',
    ariaLabel: '导入角色卡',
  });
  importBtn.appendChild(el('span', { class: 'fab-import-icon', text: '⬇' }));
  app.appendChild(importBtn);

  const fab = el('button', {
    type: 'button',
    class: 'fab',
    dataset: { action: 'new-character' },
    title: '新建角色',
    ariaLabel: '新建角色',
  });
  fab.appendChild(el('span', { class: 'fab-plus', text: '+' }));
  app.appendChild(fab);
}

export {
  renderEmptyPage,
  renderRulesPage,
  renderOtherPage,
  renderResourcesPage,
  renderRealmPage,
  renderChangelogPage,
  assetPath,
  buildChangelogRows,
  schemaifyChangelogContent,
  fmtDate,
  renderLandingPage,
  placeholderCharacters,
  renderCharactersPage,
};