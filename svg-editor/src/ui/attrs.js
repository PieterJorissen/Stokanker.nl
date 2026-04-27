// Attribute editor panel — reflects the selected node's attributes.
// Attribute names are used directly (no translation layer).
// For path nodes in path-edit mode, also shows path commands.

import { state, emit, emitDoc } from '../model/state.js';
import { findById, setAttr, removeAttr } from '../model/node.js';
import { parseD, serializeD, argLabels, defaultArgs, computePositions } from '../model/path.js';

let _attrList = null;
let _tagLabel = null;
let _newNameInput = null;
let _newValInput = null;
let _addAttrBtn = null;
let _pathSection = null;
let _pathCmdsList = null;
let _newCmdType = null;
let _addCmdBtn = null;

export function init(els) {
  _attrList = els.attrList;
  _tagLabel = els.tagLabel;
  _newNameInput = els.newNameInput;
  _newValInput = els.newValInput;
  _addAttrBtn = els.addAttrBtn;
  _pathSection = els.pathSection;
  _pathCmdsList = els.pathCmdsList;
  _newCmdType = els.newCmdType;
  _addCmdBtn = els.addCmdBtn;

  _addAttrBtn.addEventListener('click', onAddAttr);
  _newValInput.addEventListener('keydown', e => { if (e.key === 'Enter') onAddAttr(); });
  _addCmdBtn.addEventListener('click', onAddCmd);
}

export function renderAttrs() {
  if (!_attrList) return;

  _attrList.innerHTML = '';

  const node = state.selectedId ? findById(state.root, state.selectedId) : null;

  if (!node) {
    _tagLabel.textContent = '';
    _pathSection.hidden = true;
    return;
  }

  _tagLabel.textContent = node.tag === '#text' ? '#text' : `<${node.tag}>`;

  if (node.tag === '#text') {
    renderTextContent(node);
    _pathSection.hidden = true;
    return;
  }

  for (const [name, value] of Object.entries(node.attrs)) {
    _attrList.appendChild(makeAttrRow(node, name, value));
  }

  // Path commands section — shown when a path is selected in path-edit mode
  const isPath = node.tag === 'path';
  const showCmds = isPath && state.mode === 'path-edit';
  _pathSection.hidden = !showCmds;
  if (showCmds) renderPathCmds(node);
}

// --- Attribute rows ---

function makeAttrRow(node, name, value) {
  const row = document.createElement('div');
  row.className = 'attr-row';

  const label = document.createElement('span');
  label.className = 'attr-name';
  label.textContent = name;
  label.title = name;

  const input = document.createElement('input');
  input.className = 'attr-value';
  input.value = value;
  input.spellcheck = false;

  // Commit on blur or Enter
  const commit = () => {
    const v = input.value;
    if (v === node.attrs[name]) return;
    setAttr(node, name, v);
    emitDoc();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { input.blur(); }
    if (e.key === 'Escape') { input.value = node.attrs[name]; input.blur(); }
  });

  const del = document.createElement('button');
  del.className = 'attr-del';
  del.textContent = '×';
  del.title = `Remove ${name}`;
  del.addEventListener('click', () => {
    removeAttr(node, name);
    emitDoc();
  });

  row.appendChild(label);
  row.appendChild(input);
  row.appendChild(del);
  return row;
}

function renderTextContent(node) {
  const row = document.createElement('div');
  row.className = 'attr-row';
  const label = document.createElement('span');
  label.className = 'attr-name';
  label.textContent = 'content';
  const ta = document.createElement('textarea');
  ta.className = 'attr-value text-content';
  ta.value = node.content;
  ta.spellcheck = false;
  ta.addEventListener('blur', () => {
    node.content = ta.value;
    emitDoc();
  });
  row.appendChild(label);
  row.appendChild(ta);
  _attrList.appendChild(row);
}

function onAddAttr() {
  const name = _newNameInput.value.trim();
  const value = _newValInput.value;
  if (!name) return;

  const node = state.selectedId ? findById(state.root, state.selectedId) : null;
  if (!node || node.tag === '#text') return;

  setAttr(node, name, value);
  _newNameInput.value = '';
  _newValInput.value = '';
  _newNameInput.focus();
  emitDoc();
}

// --- Path commands ---

function renderPathCmds(node) {
  _pathCmdsList.innerHTML = '';
  const dVal = node.attrs.d || '';
  const cmds = parseD(dVal);
  const positions = computePositions(cmds);

  cmds.forEach((cmd, i) => {
    _pathCmdsList.appendChild(makeCmdRow(node, cmds, cmd, i, positions[i]));
  });
}

function makeCmdRow(node, cmds, cmd, index, pos) {
  const row = document.createElement('div');
  row.className = 'cmd-row' + (state.selectedCmdIdx === index ? ' selected' : '');
  row.dataset.cmd = index;

  // Index + letter
  const idx = document.createElement('span');
  idx.className = 'cmd-idx';
  idx.textContent = index;

  const letter = document.createElement('span');
  letter.className = 'cmd-letter';
  letter.textContent = cmd.letter;

  // Args — one input per arg with label
  const argsEl = document.createElement('span');
  argsEl.className = 'cmd-args';
  const labels = argLabels(cmd.letter);
  cmd.args.forEach((arg, ai) => {
    const wrap = document.createElement('span');
    wrap.className = 'cmd-arg-wrap';
    if (labels[ai]) {
      const lbl = document.createElement('span');
      lbl.className = 'cmd-arg-label';
      lbl.textContent = labels[ai];
      wrap.appendChild(lbl);
    }
    const inp = document.createElement('input');
    inp.className = 'cmd-arg-input';
    inp.type = 'number';
    inp.value = arg;
    inp.step = 1;

    const commitArg = () => {
      const v = parseFloat(inp.value);
      if (isNaN(v) || v === cmd.args[ai]) return;
      cmd.args[ai] = v;
      node.attrs.d = serializeD(cmds);
      emitDoc();
    };
    inp.addEventListener('blur', commitArg);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
    wrap.appendChild(inp);
    argsEl.appendChild(wrap);
  });

  // Delete button
  const del = document.createElement('button');
  del.className = 'cmd-del';
  del.textContent = '×';
  del.addEventListener('click', e => {
    e.stopPropagation();
    cmds.splice(index, 1);
    node.attrs.d = serializeD(cmds);
    if (state.selectedCmdIdx >= cmds.length) state.selectedCmdIdx = cmds.length - 1;
    emitDoc();
  });

  // Click row to select command
  row.addEventListener('pointerdown', e => {
    state.selectedCmdIdx = index;
    emit('select');
  });

  row.appendChild(idx);
  row.appendChild(letter);
  row.appendChild(argsEl);
  row.appendChild(del);
  return row;
}

function onAddCmd() {
  const node = state.selectedId ? findById(state.root, state.selectedId) : null;
  if (!node || node.tag !== 'path') return;

  const letter = _newCmdType.value;
  const dVal = node.attrs.d || '';
  const cmds = parseD(dVal);

  // Determine current pen position from last command
  let cx = 0, cy = 0;
  if (cmds.length > 0) {
    const positions = computePositions(cmds);
    const last = positions[positions.length - 1];
    cx = last.absX; cy = last.absY;
  }

  cmds.push({ letter, args: defaultArgs(letter, cx, cy) });
  node.attrs.d = serializeD(cmds);
  state.selectedCmdIdx = cmds.length - 1;
  emitDoc();
}
