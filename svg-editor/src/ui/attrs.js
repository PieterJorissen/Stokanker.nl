// Attribute editor panel — reflects the selected node's attributes.
// When a path command is selected, shows that command's named props in the same
// panel — same UI, same mental model as element attributes.

import { doc, editor, emit, emitDoc } from '../model/state.js';
import { findById, setAttr, removeAttr } from '../model/node.js';
import { parseD, serializeD, KEYS } from '../model/path.js';

let _attrList     = null;
let _tagLabel     = null;
let _newNameInput = null;
let _newValInput  = null;
let _addAttrBtn   = null;

export function init(els) {
  _attrList     = els.attrList;
  _tagLabel     = els.tagLabel;
  _newNameInput = els.newNameInput;
  _newValInput  = els.newValInput;
  _addAttrBtn   = els.addAttrBtn;

  _addAttrBtn.addEventListener('click', onAddAttr);
  _newValInput.addEventListener('keydown', e => { if (e.key === 'Enter') onAddAttr(); });
}

export function renderAttrs() {
  if (!_attrList) return;

  _attrList.innerHTML = '';

  const node = editor.selectedId ? findById(doc.root, editor.selectedId) : null;

  if (!node) {
    _tagLabel.textContent = '';
    return;
  }

  const cmdSelected = node.tag === 'path' && editor.selectedCmdIdx !== null;

  // Path command selected → show command's named props as attr rows
  if (cmdSelected) {
    const cmds = parseD(node.attrs.d || '');
    const cmd  = cmds[editor.selectedCmdIdx];
    if (!cmd) { editor.selectedCmdIdx = null; }
    else {
      _tagLabel.textContent = cmd.letter;
      for (const key of (KEYS[cmd.letter] ?? [])) {
        _attrList.appendChild(makeCmdPropRow(node, cmds, cmd, key));
      }
      _attrList.appendChild(makeDeleteCmdRow(node, cmds));
      return;
    }
  }

  // Default: node tag + its attributes
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
    if (e.key === 'Enter')  { input.blur(); }
    if (e.key === 'Escape') { input.value = node.attrs[name]; input.blur(); }
  });

  const del = document.createElement('button');
  del.className = 'attr-del';
  del.textContent = '×';
  del.title = `Remove ${name}`;
  del.addEventListener('click', () => { removeAttr(node, name); emitDoc(); });

  row.appendChild(label);
  row.appendChild(input);
  row.appendChild(del);
  return row;
}

function renderTextContent(node) {
  const row   = document.createElement('div');
  row.className = 'attr-row';
  const label = document.createElement('span');
  label.className = 'attr-name';
  label.textContent = 'content';
  const ta = document.createElement('textarea');
  ta.className  = 'attr-value text-content';
  ta.value      = node.content;
  ta.spellcheck = false;
  ta.addEventListener('blur', () => { node.content = ta.value; emitDoc(); });
  row.appendChild(label);
  row.appendChild(ta);
  _attrList.appendChild(row);
}

function onAddAttr() {
  const name  = _newNameInput.value.trim();
  const value = _newValInput.value;
  if (!name) return;

  const node = editor.selectedId ? findById(doc.root, editor.selectedId) : null;
  if (!node || node.tag === '#text') return;

  setAttr(node, name, value);
  _newNameInput.value = '';
  _newValInput.value  = '';
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
  input.className  = 'attr-value';
  input.type       = 'number';
  input.value      = cmd[key];
  input.step       = 1;
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
    if (e.key === 'Enter')  { input.blur(); }
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
  btn.className   = 'danger';
  btn.style.width = '100%';
  btn.textContent = 'Delete command';
  btn.addEventListener('click', () => {
    const idx = editor.selectedCmdIdx;
    cmds.splice(idx, 1);
    node.attrs.d = serializeD(cmds);
    editor.selectedCmdIdx = cmds.length ? Math.min(idx, cmds.length - 1) : null;
    emitDoc();
    emit('select');
  });

  row.appendChild(btn);
  return row;
}

