// Node tree panel — renders the SvgNode hierarchy in the left sidebar.
// Click to select a node. Reflects selected state via CSS class.
// Re-renders fully on document or selection changes.

import { doc, editor, emit } from '../model/state.js';

let _container = null;

export function init(container) {
  _container = container;
}

export function renderTree() {
  if (!_container || !doc.root) return;
  _container.innerHTML = '';
  _container.appendChild(buildNodeEl(doc.root, 0, true));
}

function buildNodeEl(node, depth, isRoot) {
  if (node.tag === '#text') return buildTextEl(node, depth);

  const wrapper = document.createElement('div');
  wrapper.className = 'tree-node';
  wrapper.dataset.id = node._id;

  const row = document.createElement('div');
  row.className = 'tree-row' + (node._id === editor.selectedId ? ' selected' : '');
  row.style.paddingLeft = (depth * 14 + 6) + 'px';
  row.dataset.id = node._id;

  const hasContent = node.children.length > 0;
  const toggle = document.createElement('span');
  toggle.className = 'tree-toggle';
  toggle.textContent = hasContent ? '▾' : ' ';

  const tag = document.createElement('span');
  tag.className = 'tree-tag';
  tag.textContent = node.tag;

  const hint = document.createElement('span');
  hint.className = 'tree-hint';
  hint.textContent = attrHint(node);

  row.appendChild(toggle);
  row.appendChild(tag);
  row.appendChild(hint);

  row.addEventListener('pointerdown', e => {
    e.stopPropagation();
    editor.selectedId = node._id;
    editor.selectedCmdIdx = null;
    emit('select');
  });

  wrapper.appendChild(row);

  if (hasContent) {
    const children = document.createElement('div');
    children.className = 'tree-children';
    for (const child of node.children) {
      children.appendChild(buildNodeEl(child, depth + 1, false));
    }
    wrapper.appendChild(children);

    toggle.addEventListener('pointerdown', e => {
      e.stopPropagation();
      const collapsed = children.style.display === 'none';
      children.style.display = collapsed ? '' : 'none';
      toggle.textContent = collapsed ? '▾' : '▸';
    });
  }

  return wrapper;
}

function buildTextEl(node, depth) {
  const row = document.createElement('div');
  row.className = 'tree-row text-node' + (node._id === editor.selectedId ? ' selected' : '');
  row.style.paddingLeft = (depth * 14 + 6 + 12) + 'px';
  row.dataset.id = node._id;
  row.textContent = '"' + node.content.trim().slice(0, 30) + (node.content.length > 30 ? '…' : '') + '"';

  row.addEventListener('pointerdown', e => {
    e.stopPropagation();
    editor.selectedId = node._id;
    editor.selectedCmdIdx = null;
    emit('select');
  });

  return row;
}

function attrHint(node) {
  const a = node.attrs;
  if (a.id) return `#${a.id}`;
  if (a.class) return `.${a.class.split(' ')[0]}`;
  if (node.tag === 'path' && a.d) return a.d.slice(0, 16) + (a.d.length > 16 ? '…' : '');
  if (a.viewBox) return `[${a.viewBox}]`;
  return '';
}

/** Scroll the selected node into view in the tree panel. */
export function scrollToSelected() {
  if (!_container || !editor.selectedId) return;
  const row = _container.querySelector(`.tree-row[data-id="${editor.selectedId}"]`);
  if (row) row.scrollIntoView({ block: 'nearest' });
}
