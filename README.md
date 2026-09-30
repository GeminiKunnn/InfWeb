# [HTML5 Boilerplate](https://html5boilerplate.com/)

[![Build status](https://github.com/h5bp/html5-boilerplate/workflows/Build%20status/badge.svg)](https://github.com/h5bp/html5-boilerplate/actions?query=workflow%3A%22Build+status%22+branch%3Amain)
[![LICENSE](https://img.shields.io/badge/license-MIT-lightgrey.svg)](https://github.com/h5bp/html5-boilerplate/blob/main/LICENSE.txt)
[![NPM Downloads](https://img.shields.io/npm/dt/html5-boilerplate.svg)](https://www.npmjs.com/package/html5-boilerplate)
[![github-stars-image](https://img.shields.io/github/stars/h5bp/html5-boilerplate.svg?label=github%20stars)](https://github.com/h5bp/html5-boilerplate)

HTML5 Boilerplate is a professional front-end template for building
fast, robust, and adaptable web apps or sites.

This project is the product of over 10 years of iterative development and
community knowledge. It does not impose a specific development
philosophy or framework, so you're free to architect your code in the
way that you want.

- [Homepage](https://html5boilerplate.com/)
- [Source Code](https://github.com/h5bp/html5-boilerplate)

## About This Repository

This repository is where HTML5-Boilerplate is authored. Some of the tools,
files and processes that you see here are solely for the _production_ of
HTML5 Boilerplate and are not _part_ of HTML5 Boilerplate. For one example, the
[gulpfile.mjs](https://github.com/h5bp/html5-boilerplate/blob/main/gulpfile.mjs)
script is used to _build_ the project. It's not part of the project itself.

The project we publish is represented by the contents of the `/dist/`
folder. Everything else in this repository is used to author the project.

Think of it this way, in the same way that you don't clone [vuejs/core](https://github.com/vuejs/core)
to create a Vue.js app, you don't need to clone this repository to start a new
site or app based on HTML5 Boilerplate.

So, if you're looking for a quick start template to build a website or
application, look at the options in the
[Quick Start](https://github.com/h5bp/html5-boilerplate#quick-start) section of this document.

If you want to help us _improve_ HTML5 Boilerplate then you can start with the documentation [here](.github/CONTRIBUTING.md), which includes steps to clone this repo in order to get it set up for development.

## Quick Start

Choose one of the following options:

- Using the [create-html5-boilerplate](https://github.com/h5bp/create-html5-boilerplate)
  script, instantly fetch the latest npm published package (or any version
  available on npm) with `npx`, `npm init` or `yarn create` without having to
  install any dependencies. Running the following `npx` command installs the
  latest version into a folder called `new-site`

  ```bash
  npx create-html5-boilerplate new-site
  cd new-site
  npm install
  npm run start
  ```

- Using our new [Template Repository](https://github.com/h5bp/html5-boilerplate-template)
  create a new GitHub repository based on the latest code from the main branch of HTML5
  Boilerplate.

- Install with [npm](https://www.npmjs.com/): `npm install html5-boilerplate`
  or [yarn](https://yarnpkg.com/): `yarn add html5-boilerplate`. The resulting
  `node_modules/html5-boilerplate/dist` folder represents the latest version of
  the project for end users. Depending on what you want to use and how you want
  to use it, you may have to copy and paste the contents of that folder into
  your project directory.

- Download the latest stable release from
  [here](https://github.com/h5bp/html5-boilerplate/releases/download/v9.0.0/html5-boilerplate_v9.0.0.zip). This zip file is a
  snapshot of the `dist` folder. On Windows, Mac and from the file manager on
  Linux unzipping this folder will output to a folder named something like
  `html5-boilerplate_v9.0.0`. From the command-line, you will need to create a
  folder and unzip the contents into that folder.

  ```bash
  mkdir html5-boilerplate
  unzip html5-boilerplate*.zip -d html5-boilerplate
  ```

## Features

- A finely-tuned starter template: Reap the benefits of 10 years of analysis,
  research and experimentation by over 200 contributors.
- Designed with progressive enhancement in mind.
- Includes:
  - Placeholder Open Graph elements and attributes.
  - An example package.json file with [WebPack](https://webpack.js.org/) commands
    built in to jumpstart application development.
  - Placeholder CSS Media Queries.
  - Useful CSS helper classes.
  - Default print styles, performance optimized.
  - "Delete-key friendly." Easy to strip out parts you don't need.
  - Extensive documentation.

## Browser Support

HTML5-Boilerplate supports the latest, stable releases of all major browsers.

Check the `default` configuration from [Browserslist](https://browsersl.ist/#q=defaults)
for more details on browsers and versions covered.

## Documentation

Take a look at the [documentation table of contents](docs/TOC.md). This
documentation is bundled with the project which makes it available for offline
reading and provides a useful starting point for any documentation you want to
write about your project.

## Contributing

Hundreds of developers have helped to make the HTML5 Boilerplate. Anyone is
welcome to [contribute](.github/CONTRIBUTING.md). However, if you decide to get
involved, please take a moment to review the [guidelines](.github/CONTRIBUTING.md):

- [Bug reports](.github/CONTRIBUTING.md#bugs)
- [Feature requests](.github/CONTRIBUTING.md#features)
- [Pull requests](.github/CONTRIBUTING.md#pull-requests)

## License

The code is available under the [MIT license](LICENSE.txt).

---

# 无限流角色卡（本项目的自定义内容）

在 HTML5 Boilerplate 骨架内新增的无限流角色卡网页，规则参考 `Rules/` 下的
《快速创建角色卡.docx》《基础规则.docx》与《无限半自动卡 v1.1.0.xlsx》。

## 如何运行

页面使用 ES Module 依赖多文件加载，直接双击打开 `src/index.html` 会被浏览器拦截。
请通过任意静态服务器访问 `src/` 目录，例如在项目根目录执行：

```powershell
npx serve src
# 或 Python:
python -m http.server 8080 --directory src
```

然后访问 `http://localhost:8080`。

## 目录结构（角色卡相关）

```
src/
  index.html            # 页面骨架：左侧菜单栏(#sidebar) + 内容区(#app)，内含 Vue 迁移预留点
  css/style.css         # 角色卡样式（含侧边栏 / sheet 标签 / 动态表样式）
  js/
    character-config.js # 字段定义（属性 / 技能 / 分组）——单一数据源
    store.js            # 状态 + localStorage 持久化 + api（后端预留）+ 动态行工厂
    app.js              # 渲染与交互（当前为原生 DOM，未来替换为 Vue）
```

## 当前功能

### 页面导航（左侧菜单）
- 左侧垂直菜单栏，顶部按钮可折叠/展开（折叠后仅保留图标）。
- 菜单项：`规则书`（暂空）、`角色卡`、`其他`（预留扩展空间）。
- 点击菜单项在页面间切换（SPA 式，无需刷新）。

### 角色卡内部「表单切换」
角色卡页面顶部有一排类似 Excel 表单（sheet）的标签，点击切换不同部分：
`角色总览` / `角色属性` / `法术列表` / `特殊攻击` / `能量池` / `专长` / `装备` / `特性` / `资源`。

### 各部分内容
- **角色总览**：概念段 + 属性卡片网格（一行三个）+ 技能段（按 生理系/心智系/互动系 分区、每行三个）+ 生命值（含状态明细）+ 派生值（意志力/先攻值/移动力 + 三豁免）+ 五种基础攻击总览 + 防御信息（护甲「总护甲+附加成功」/伤害减免）+ 其他信息（基因锁熟练度/范围/敏感范围）。
- **角色属性**：属性/技能完整加值栏 + 生命值（状态点数）+ 按 Excel「角色属性」sheet 布局，统一采用「圆角外框 + 直角内表 + 左下提示」结构——属性细则（移动/先攻/意志/生命 + 专长 + 加成1-5）、豁免检定（3 组表头/值行直角表、总计 live）、防御（护甲 / 伤害减免直角表，可增删）、五种基础攻击方式（每项蓝边圆角框内嵌总计列表，附加提示在左下）、敏感范围加值表、基因锁熟练度加值表。
- 概念段：姓名 / 性别 / 种族 / 年龄 / 身高体重 / 总资源量 / 外貌特征 / 背景概述。
- 属性段：九大属性（生理·心智·互动），含「属性值 / 传奇 / 基础 / 加值 / 检定值」，
  自动计算：
  - 属性值 = 基础 + 内在 + 修行 + 器械 + 完美 + 其它；
  - 传奇 = (属性值 − 1) 整除 5。
- 派生值：生命值 / 意志力 / 先攻值 / 移动力 / 反射·意志·强韧豁免，均按规则公式自动计算。
- 技能段：三大类全部技能，含「检定值 / 附加成功 / 建卡 / 加值」，自动计算：
  - 附加成功 = 技能值达到 5/7/9/11/13/15 时各 +1。
- 法术列表 / 特殊攻击 / 能量池：采用「添加一行 / 删除一行」交互，每行套用相同计算规则：
  - 法术页顶部的「施法基础检定」栏（默认置顶）包含 总计/智力/神秘学/加成1..6；
  - 施法基础检定 = 智力检定值 + 神秘学检定值 + 加成1..6（每法术的「基础值」列即此值）；
  - 法术检定 DP = 基础值 + 法术威力 + 专业 + 加成1..6；
  - 法术伤害上限 = 智力 + 神秘学 + 专业(有则+1) + 传奇智力×2 + 伤害加成1..3；
  - 特殊攻击 DP = 属性值 + 技能值 + 武器伤害 + 专业 + 加成 + 附加成功；
  - 能量池总值 = 关键属性1 + 关键属性2(可选) + 加成1 + 加成2 + 加成3。
- 专长 / 装备 / 特性 / 资源：均已实现（专长点核算 + 动态列表、装备位与特性分离、资源统计），
  均可动态增删行。

## 未来迁移路径

### 接入后端
只需修改 `js/store.js` 里 `api` 对象的两行：把 `localStorage`
读写替换为 `fetch('/api/character', ...)`，页面其余代码零改动。
各字段的中英文 `id` 已固定，可直接作为 API 字段名。

### 迁移 Vue
1. 在 `index.html` 中引入 Vue 入口，并将 `#app` 作为根组件挂载点。
2. `character-config.js`（字段定义）与 `store.js`（状态）原样复用，
   前者作为模板数据源，后者可作为组件 `data` 或 Pinia store 的来源。
3. 把 `app.js` 中渲染表格 / 概念段的 DOM 构建逻辑改为 Vue 模板与 `methods`
   （计算属性如「属性值 / 传奇 / 附加成功」可改写成 Vue `computed`）。
