/**
 * state.js
 * 共享运行态：唯一拥有「当前角色 character」这一可变引用。
 *
 * 拆出来是为了让 calc.js（纯计算）能读到同一个 character，而无需依赖 app.js
 * （app.js 是渲染入口，计算模块反向依赖入口会造成循环依赖）。
 *
 * 约定：只在此模块内 reassign character（通过 setCharacter），其余文件仅读取
 * 这门 live binding。初始化用 store.emptyCharacter()。
 */
import { emptyCharacter } from './store.js';

/** 当前角色（live binding，各模块直接 import 读取）。 */
export let character = emptyCharacter();

/** 替换整个角色对象（boot 载入存档 / 删除后新建 时使用）。 */
export function setCharacter(c) {
  character = c;
}

/** 应用级导航状态：screen=界面层（landing 主页面 / app 应用界面）；page=应用内页面。 */
export const appState = { screen: 'landing', page: 'changelog', activeChar: null };

/** 角色卡内部「表单（sheet）切换」：当前激活的子面板。 */
export const sheetState = { active: 'main' };