// Node tree panel — renders the SvgNode hierarchy in the left sidebar.
// Click to select a node. Reflects selected state via CSS class.
// Re-renders fully on document or selection changes.
// Path nodes also render their commands as virtual child rows.

import { doc, editor, emit, emitDoc } from '../model/state.js';
import { findById } from '../model/node.js';
import { parseD, serializeD, defaultCmd, computePositions } from '../model/path.js';

let _container = null;

export function init(container) {
  _container = container;
  document.getElementById('btn-add-cmd').addEventListener('click', onAddCmd);
}

export function renderTree() {
  if (!_container || !doc.root) return;

  const selNode = editor.selectedId ? findById(doc.root, editor.selectedId) : null;
  document.getElementById('cmd-add-row').hidden = selNode?.tag !== 'path';

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

  const hasRealChildren = node.children.length > 0;
  const cmds = node.tag === 'path' ? parseD(node.attrs.d || '') : null;
  const hasContent = hasRealChildren || (cmds && cmds.length > 0);

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

    if (cmds) {
      for (let i = 0; i < cmds.length; i++) {
        children.appendChild(buildCmdRow(cmds[i], i, node, depth + 1));
      }
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

function buildCmdRow(cmd, idx, pathNode, depth) {
  const isSelected = editor.selectedId === pathNode._id && editor.selectedCmdIdx === idx;
  const row = document.createElement('div');
  row.className = 'tree-row cmd-row' + (isSelected ? ' selected' : '');
  row.style.paddingLeft = (depth * 14 + 6) + 'px';

  const letter = document.createElement('span');
  letter.className = 'tree-tag';
  letter.textContent = cmd.letter;

  const hint = document.createElement('span');
  hint.className = 'tree-hint';
  hint.textContent = `[${idx}]`;

  row.appendChild(letter);
  row.appendChild(hint);

  row.addEventListener('pointerdown', e => {
    e.stopPropagation();
    editor.selectedId = pathNode._id;
    editor.selectedCmdIdx = idx;
    emit('select');
  });

  return row;
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

function onAddCmd() {
  const node = editor.selectedId ? findById(doc.root, editor.selectedId) : null;
  if (!node || node.tag !== 'path') return;

  const letter = document.getElementById('new-cmd-type').value;
  const cmds = parseD(node.attrs.d || '');

  let cx = 0, cy = 0;
  if (cmds.length > 0) {
    const positions = computePositions(cmds);
    const last = positions[positions.length - 1];
    cx = last.absX; cy = last.absY;
  }

  cmds.push(defaultCmd(letter, cx, cy));
  node.attrs.d = serializeD(cmds);
  editor.selectedCmdIdx = cmds.length - 1;
  emitDoc();
}

/** Scroll the selected node into view in the tree panel. */
export function scrollToSelected() {
  if (!_container || !editor.selectedId) return;
  const row = _container.querySelector(`.tree-row[data-id="${editor.selectedId}"]`);
  if (row) row.scrollIntoView({ block: 'nearest' });
}
