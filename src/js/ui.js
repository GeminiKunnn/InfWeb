/**
 * ui.js
 * DOM 通用工具：元素构建与输入控件。
 * 全部为纯 DOM 操作，不依赖 character / 计算，可被任意渲染模块复用。
 */

/** 创建元素：class/text/dataset 走快捷字段，其余为属性；children 支持字符串自动转文本节点。 */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

function numberInput({ value, min = 0, max, onChange }) {
  const input = el('input', {
    type: 'number',
    min,
    ...(max != null ? { max } : {}),
    value,
  });
  input.addEventListener('input', (e) => {
    onChange(Number(e.target.value) || 0, input);
    autoGrow(input);
  });
  return input;
}

// 数字/文本输入框宽度锁定：不再随输入内容伸缩，统一由 CSS 宽度固定（无论是否输入都不变长宽）。
function autoGrow() {
  /* 锁死宽度：不做任何宽度调整，保持 CSS 设定的固定宽 */
}

function textInput({ value, placeholder = '', onChange }) {
  const input = el('input', { type: 'text', value, placeholder });
  input.addEventListener('input', (e) => {
    onChange(e.target.value, input);
    autoGrow(input);
  });
  setTimeout(() => autoGrow(input), 0);
  return input;
}

function textarea({ value, placeholder = '', onChange, className }) {
  const area = el('textarea', { value, placeholder });
  if (className) area.className = className;
  area.addEventListener('input', (e) => onChange(e.target.value, area));
  return area;
}

function select({ value, options, onChange }) {
  const sel = el('select');
  options.forEach((o) => {
    const opt = el('option', { value: o.value, text: o.label });
    if (o.value === value) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => onChange(sel.value, sel));
  return sel;
}

/** 一个小节（<section> + <h2> 标题 + 内容容器）。 */
function section(title, contentNode) {
  const container = el('div', { class: 'card-section' });
  container.appendChild(el('h2', { class: 'section-title', text: title }));
  container.appendChild(contentNode);
  return container;
}

/** 一个操作按钮（用于「添加一行」「保存」等）。 */
function actionButton(text, dataset, extraClass = '') {
  return el('button', {
    class: 'btn ' + extraClass,
    text,
    dataset,
  });
}

let flashTimer = null;
/** 顶部一次性提示（短暂显示然后淡出）。 */
function flash(msg) {
  let tip = document.getElementById('flash');
  if (!tip) {
    tip = el('div', { id: 'flash', class: 'flash' });
    document.body.appendChild(tip);
  }
  tip.textContent = msg;
  tip.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => tip.classList.remove('show'), 1600);
}

export { el, numberInput, autoGrow, textInput, textarea, select, section, actionButton, flash };