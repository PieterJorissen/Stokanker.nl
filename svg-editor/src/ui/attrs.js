// Attribute editor panel — reflects the selected node's attributes.
// In path-edit mode with a command selected, shows that command's named props
// in the same panel — same UI, same mental model as element attributes.

import { state, emit, emitDoc } from '../model/state.js';
import { findById, setAttr, removeAttr } from '../model/node.js';
import { parseD, serializeD, defaultCmd, computePositions, KEYS } from '../model/path.js';

let _attrList   = null;
let _tagLabel   = null;
let _newNameInput = null;
let _newValInput  = null;
let _addAttrBtn   = null;
let _cmdAddRow    = null;
let _newCmdType   = null;
let _addCmdBtn    = null;

export function init(els) {
  _attrList     = els.attrList;
  _tagLabel     = els.tagLabel;
  _newNameInput = els.newNameInput;
  _newValInput  = els.newValInput;
  _addAttrBtn   = els.addAttrBtn;
  _cmdAddRow    = els.cmdAddRow;
  _newCmdType   = els.newCmdType;
  _addCmdBtn    = els.addCmdBtn;

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
    _cmdAddRow.hidden = true;
    return;
  }

  // Path-edit mode with a command selected → show command props as attributes
  const inPathEdit = state.mode === 'path-edit' && node.tag === 'path';
  const cmdSelected = inPathEdit && state.selectedCmdIdx !== null;

  _cmdAddRow.hidden = !inPathEdit;

  if (cmdSelected) {
    const cmds = parseD(node.attrs.d || '');
    const cmd = cmds[state.selectedCmdIdx];
    if (cmd) {
      _tagLabel.textContent = cmd.letter;
      const keys = KEYS[cmd.letter] ?? [];
      for (const key of keys) {
        _attrList.appendChild(makeCmdPropRow(node, cmds, cmd, key));
      }
      // Delete-command button at bottom
      _attrList.appendChild(makeDeleteCmdRow(node, cmds));
      return;
    }
  }

  // Default: show node tag + its attributes
  if (node.tag === '#text') {
    _tagLabel.textContent = '#text';
    renderTextContent(node);
    return;
  }

  _tagLabel.textContent = `<${node.tag}>`;
  for (const [name, value] of Object.entries(node.attrs)) {
    _attrList.appendChild(makeAttrRow(node, name, value));
  }
}

// --- Element attribute rows ---

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

// --- Path command prop rows (reuse attr-row styling) ---

function makeCmdPropRow(node, cmds, cmd, key) {
  const row = document.createElement('div');
  row.className = 'attr-row';

  const label = document.createElement('span');
  label.className = 'attr-name';
  label.textContent = key;
  label.title = key;

  const input = document.createElement('input');
  input.className = 'attr-value';
  input.type = 'number';
  input.value = cmd[key];
  input.step = 1;
  input.spellcheck = false;

  const commit = () => {
    const v = parseFloat(input.value);
    if (isNaN(v) || v === cmd[key]) return;
    cmd[key] = v;
    node.attrs.d = serializeD(cmds);
    emitDoc();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { input.blur(); }
    if (e.key === 'Escape') { input.value = cmd[key]; input.blur(); }
  });

  row.appendChild(label);
  row.appendChild(input);
  return row;
}

function makeDeleteCmdRow(node, cmds) {
  const row = document.createElement('div');
  row.className = 'attr-row';
  row.style.paddingTop = '6px';

  const btn = document.createElement('button');
  btn.className = 'danger';
  btn.style.width = '100%';
  btn.textContent = 'Delete command';
  btn.addEventListener('click', () => {
    const idx = state.selectedCmdIdx;
    cmds.splice(idx, 1);
    node.attrs.d = serializeD(cmds);
    state.selectedCmdIdx = cmds.length ? Math.min(idx, cmds.length - 1) : null;
    emitDoc();
    emit('select');
  });

  row.appendChild(btn);
  return row;
}

function onAddCmd() {
  const node = state.selectedId ? findById(state.root, state.selectedId) : null;
  if (!node || node.tag !== 'path') return;

  const letter = _newCmdType.value;
  const cmds = parseD(node.attrs.d || '');

  let cx = 0, cy = 0;
  if (cmds.length > 0) {
    const positions = computePositions(cmds);
    const last = positions[positions.length - 1];
    cx = last.absX; cy = last.absY;
  }

  cmds.push(defaultCmd(letter, cx, cy));
  node.attrs.d = serializeD(cmds);
  state.selectedCmdIdx = cmds.length - 1;
  emitDoc();
}
