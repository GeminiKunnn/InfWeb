# 无限流角色卡网页（InfWeb）

基于 **Vue 3 + Vite** 的纯前端静态项目，前端源码在 `src/`，构建产物 `dist/` 供部署。

## 一、模块构成（Vue 3 + Vite 迁移后）

入口 `src/main.js` 启动 Vue，`App.vue` 负责整体布局（左侧可折叠侧边栏 + 右侧内容区）与**组件切换路由**（按 `useApp().state.page` 动态渲染对应页面组件，暂不引入 vue-router）。

**纯逻辑层（不依赖 DOM，可复用 / 可测试，未迁移，单一数据源）**
- `js/character-config.js` — **字段单一数据源**（九属性 / 二十一技能 / 三分组，id 稳定可作 API 字段名）。
- `js/store.js` — 状态模型 + 持久化（`emptyCharacter()`、`api.save/load`，现走 localStorage，后端预留）+ 各元素工厂（`newXxx`）。**`api` 为可替换的信息层**：换后端只需替换 `saveToStorage/loadFromStorage` 的存储实现，页面零改动。
- `js/state.js` — 唯一持有可变运行态：当前角色 `character`（live binding）、应用导航 `appState`、角色卡子面板 `sheetState`。
- `js/calc.js` — **纯计算**：属性/检定/传奇值、技能附加成功、派生值、豁免表 `SAVE_DEFS`、特殊攻击 DP、能量池总值等。

**渲染层 / 页面组件（Vue，`src/pages/*.vue` + `src/composables/*.js`）**
- `components/useApp.js` — 应用级导航状态（reactive）+ 侧边栏/页面切换动作。
- `pages/LandingPage.vue` — 主页面（进入）。
- `pages/CharactersPage.vue` — 角色管理（复用 `placeholderCharacters`）。
- `pages/ChangelogPage.vue` — 更新记录（复用原 `pages.js` 的 `schemaifyChangelogContent/fmtDate/assetPath`）。
- `pages/RulesPage.vue` — 规则书（整体复用原 `rules.js` 的 Markdown 渲染器）。
- `pages/CharacterSheetView.vue` — 角色卡 sheet（复用原 `character.js` 渲染管线 + 事件委托）。
- `pages/NewCharacterView.vue` — 「快速创建角色卡」向导（复用原 `new-character.js`）。
- `pages/EmptyPage.vue` — 资源列表 / 轮回之境 / 其他（占位）。

> 角色卡与新建角色向导体量大且重度依赖 DOM/事件委托，当前以**宿主容器复用**方式接入 Vue（`renderCharacterPage({host})` / `renderNewCharacterPage({host})`），保证 UI 与计算校验与原版逐像素一致；后续可逐步将其内部拆成细粒度 `.vue` 子组件。

**可替换信息层 `api`**：定义在 `js/store.js`，`api.save/load` 现走 `localStorage`；换后端时仅需把 `saveToStorage/loadFromStorage` 换成 `fetch` 调用。

## 二、运行 / 构建方式
```powershell
npm install          # 首次
npm run dev          # 开发：http://localhost:5173
npm run build:vite   # 生产构建 → dist/
npm run preview      # 本地预览构建产物
```

GitHub Pages 部署（`.github/workflows/deploy-pages.yml`）：向 **master（主分支）** push 即自动构建部署 —— Action 执行 `npm ci` → `npm run build:vite` 再 `deploy-pages` 发布 `dist/`；手动可在 Actions 页面触发 `workflow_dispatch`。
```powershell
git push origin master
```
> 首次使用需在 仓库 Settings→Pages→Build and deployment→Source 选择 **GitHub Actions**。

## 三、更新记录数据源规范
「更新记录」页读取 `src/content/updates/changelog.json` 渲染（Vite 构建时经 `vite.config.js` 的复制插件把 `src/content/**` 打进 `dist/content/`）。**注意：JSON 不支持注释**。

数据源是**对象数组**，方向约定：**越靠上方=越旧、越靠下方=越新**，页面倒序展示（最新在最上）。

字段：
| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `title` | ✅ | 更新标题（加粗，左上角） |
| `content` | ✅ | 更新内容，纯文本；推荐用数组（每元素一段），也兼容单字符串（含 `\n` 自动拆段） |
| `date` | ✅ | `YYYY-MM-DD`（也接受 `YYYY/M/D`，自动补零） |

**三种编辑模板见 `src/content/updates/changelogTemplate.json`**（结构与 changelog.json 相同，三个条目各演示一种写法：①普通文本 ②换行符 ③数组）。复制对应条目、替换内容后粘到 changelog.json **数组末尾**即可。

维护约定：新增条目放数组末尾（最新在下，页面显示在上）；旧条目保留不删；`content` 不要用 Markdown；空元素自动跳过。格式由 `test/characters-page.mjs` 校验。

## 四、未来规划
- 接后端：见 `后端规划.md`（gitignore，不入库）。后端核心存储角色 + 资源并完成算式，前端仅解析展示；替换 `js/store.js` 的 `api` 存储实现即可，渲染层零改动。
- 逐步把角色卡/新建角色向导从「宿主复用」拆成细粒度 `.vue` 子组件。
- 测试：将现有 `test/*.mjs` 的列断言迁到 Vitest，覆盖 `calc/rules/state` 等纯逻辑。
- 「轮回之境」页预留，后续开发游戏组 / 房间 / 多单位施效。