import { editor, emitSelect } from '../state.js';
import { SvgCmd, SvgPathElement, getSvgDocument } from '../elements/registry.js';

let _root = null;

export function init(container) {
  _root = container;
}

export function render() {
  if (!_root) return;
  const docEl = getSvgDocument();
  _root.innerHTML = '';
  if (docEl) _root.appendChild(_buildEl(docEl, 0));

  // Show cmd-add row only when a path is selected
  const sel = editor.selectedEl;
  const isPathContext = sel instanceof SvgPathElement
    || (sel instanceof SvgCmd && sel.parentElement instanceof SvgPathElement);
  document.getElementById('cmd-add-row').hidden = !isPathContext;
}

function _buildEl(el, depth) {
  if (el instanceof SvgCmd) return _buildCmdRow(el, depth);

  const wrapper = document.createElement('div');
  wrapper.className = 'tree-node';

  const row = document.createElement('div');
  row.className = 'tree-row' + (el === editor.selectedEl ? ' selected' : '');
  row.style.paddingLeft = (depth * 14 + 6) + 'px';

  const toggle = document.createElement('span');
  toggle.className = 'tree-toggle';

  const tag = document.createElement('span');
  tag.className = 'tree-tag';
  tag.textContent = _displayTag(el);

  const hint = document.createElement('span');
  hint.className = 'tree-hint';
  hint.textContent = _hint(el);

  row.appendChild(toggle); row.appendChild(tag); row.appendChild(hint);
  row.addEventListener('pointerdown', e => {
    e.stopPropagation();
    editor.selectedEl = el;
    emitSelect();
  });
  wrapper.appendChild(row);

  // Children: real children + cmd rows for paths
  const childEls = [...el.children];
  if (childEls.length) {
    toggle.textContent = '▾';
    const childContainer = document.createElement('div');
    childContainer.className = 'tree-children';
    for (const child of childEls) {
      childContainer.appendChild(_buildEl(child, depth + 1));
    }
    wrapper.appendChild(childContainer);

    toggle.addEventListener('pointerdown', e => {
      e.stopPropagation();
      const collapsed = childContainer.style.display === 'none';
      childContainer.style.display = collapsed ? '' : 'none';
      toggle.textContent = collapsed ? '▾' : '▸';
    });
  } else {
    toggle.textContent = ' ';
  }

  return wrapper;
}

function _buildCmdRow(cmdEl, depth) {
  const row = document.createElement('div');
  const isSel = cmdEl === editor.selectedEl;
  row.className = 'tree-row cmd-row' + (isSel ? ' selected' : '');
  row.style.paddingLeft = (depth * 14 + 6) + 'px';

  const letter = document.createElement('span');
  letter.className = 'tree-tag cmd-letter';
  letter.textContent = cmdEl.letter;

  const hint = document.createElement('span');
  hint.className = 'tree-hint';
  const cmd = cmdEl.toCommand();
  const vals = Object.entries(cmd)
    .filter(([k]) => k !== 'letter')
    .map(([k, v]) => `${k}:${typeof v === 'number' ? +v.toFixed(1) : v}`)
    .join(' ');
  hint.textContent = vals;

  row.appendChild(letter); row.appendChild(hint);
  row.addEventListener('pointerdown', e => {
    e.stopPropagation();
    editor.selectedEl = cmdEl;
    emitSelect();
  });
  return row;
}

function _displayTag(el) {
  if (el.localName === 'svg-document') return 'svg';
  return el.localName.replace(/^svg-/, '');
}

function _hint(el) {
  const a = el.getAttribute.bind(el);
  if (a('id'))    return `#${a('id')}`;
  if (a('class')) return `.${a('class').split(' ')[0]}`;
  if (el instanceof SvgPathElement) {
    const cmds = el.cmdElements();
    if (cmds.length) return `${cmds.length} cmd${cmds.length > 1 ? 's' : ''}`;
  }
  if (a('viewBox')) return `[${a('viewBox')}]`;
  return '';
}

export function scrollToSelected() {
  if (!_root || !editor.selectedEl) return;
  const rows = _root.querySelectorAll('.tree-row.selected');
  rows[rows.length - 1]?.scrollIntoView({ block: 'nearest' });
}
