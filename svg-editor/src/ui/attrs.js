import { editor, emitDoc, emitSelect } from '../state.js';
import { SvgCmd, SvgPathElement } from '../elements/registry.js';

let _list    = null;
let _tagLbl  = null;
let _newName = null;
let _newVal  = null;

export function init(els) {
  _list   = els.list;
  _tagLbl = els.tagLabel;
  _newName = els.newName;
  _newVal  = els.newVal;

  els.addBtn.addEventListener('click', _onAddAttr);
  _newVal.addEventListener('keydown', e => { if (e.key === 'Enter') _onAddAttr(); });
}

export function render() {
  if (!_list) return;
  _list.innerHTML = '';
  const el = editor.selectedEl;

  if (!el) { _tagLbl.textContent = ''; return; }

  if (el instanceof SvgCmd) {
    _tagLbl.textContent = el.letter;
    const keys = (el.constructor.observedAttributes ?? []).filter(k => k !== 'relative');
    // Stale guard
    const pathEl = el.parentElement instanceof SvgPathElement ? el.parentElement : null;
    if (!pathEl) { editor.selectedEl = null; emitSelect(); return; }

    for (const key of keys) {
      const val = el.getAttribute(key) ?? '';
      _list.appendChild(_makeNumRow(el, key, val));
    }
    // Relative toggle
    _list.appendChild(_makeRelRow(el));
    // Delete cmd
    _list.appendChild(_makeDeleteCmdRow(el));
    return;
  }

  _tagLbl.textContent = el.localName === 'svg-document' ? '<svg>' : `<${el.localName.replace(/^svg-/, '')}>`;

  // data-text special row
  if (el.hasAttribute('data-text') || el.localName === 'svg-text' || el.localName === 'svg-tspan' || el.localName === 'svg-style') {
    _list.appendChild(_makeTextContentRow(el));
  }

  for (const attr of el.attributes) {
    if (attr.name === 'data-text') continue;
    _list.appendChild(_makeAttrRow(el, attr.name, attr.value));
  }
}

function _makeAttrRow(el, name, value) {
  const row = document.createElement('div');
  row.className = 'attr-row';

  const lbl = document.createElement('span');
  lbl.className = 'attr-name'; lbl.textContent = name; lbl.title = name;

  const inp = document.createElement('input');
  inp.className = 'attr-value'; inp.value = value; inp.spellcheck = false;

  const commit = () => {
    if (inp.value === el.getAttribute(name)) return;
    el.setAttribute(name, inp.value);
  };
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') inp.blur();
    if (e.key === 'Escape') { inp.value = el.getAttribute(name) ?? ''; inp.blur(); }
  });

  const del = document.createElement('button');
  del.className = 'attr-del'; del.textContent = '×'; del.title = `Remove ${name}`;
  del.addEventListener('click', () => { el.removeAttribute(name); });

  row.appendChild(lbl); row.appendChild(inp); row.appendChild(del);
  return row;
}

function _makeNumRow(cmdEl, key, value) {
  const row = document.createElement('div');
  row.className = 'attr-row';

  const lbl = document.createElement('span');
  lbl.className = 'attr-name'; lbl.textContent = key;

  const inp = document.createElement('input');
  inp.className = 'attr-value'; inp.type = 'number'; inp.value = value;
  inp.step = 1; inp.spellcheck = false;

  inp.addEventListener('blur', () => {
    const v = parseFloat(inp.value);
    if (!isNaN(v)) cmdEl.setAttribute(key, v);
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') inp.blur();
    if (e.key === 'Escape') { inp.value = cmdEl.getAttribute(key) ?? ''; inp.blur(); }
  });

  row.appendChild(lbl); row.appendChild(inp);
  return row;
}

function _makeRelRow(cmdEl) {
  const row = document.createElement('div');
  row.className = 'attr-row';
  const lbl = document.createElement('span');
  lbl.className = 'attr-name'; lbl.textContent = 'relative';
  const cb = document.createElement('input');
  cb.type = 'checkbox'; cb.checked = cmdEl.hasAttribute('relative');
  cb.addEventListener('change', () => {
    if (cb.checked) cmdEl.setAttribute('relative', '');
    else cmdEl.removeAttribute('relative');
  });
  row.appendChild(lbl); row.appendChild(cb);
  return row;
}

function _makeDeleteCmdRow(cmdEl) {
  const row = document.createElement('div');
  row.className = 'attr-row';
  row.style.paddingTop = '6px';
  const btn = document.createElement('button');
  btn.className = 'danger'; btn.style.width = '100%'; btn.textContent = 'Delete command';
  btn.addEventListener('click', () => {
    const path = cmdEl.parentElement;
    const idx  = [...path.children].indexOf(cmdEl);
    cmdEl.remove();
    editor.selectedEl = path.cmdElements()[Math.min(idx, path.cmdElements().length - 1)] ?? path;
    emitSelect();
  });
  row.appendChild(btn);
  return row;
}

function _makeTextContentRow(el) {
  const row = document.createElement('div');
  row.className = 'attr-row';
  const lbl = document.createElement('span');
  lbl.className = 'attr-name'; lbl.textContent = 'content';
  const ta = document.createElement('textarea');
  ta.className = 'attr-value text-content';
  ta.value = el.getAttribute('data-text') ?? '';
  ta.spellcheck = false;
  ta.addEventListener('blur', () => { el.setAttribute('data-text', ta.value); });
  row.appendChild(lbl); row.appendChild(ta);
  return row;
}

function _onAddAttr() {
  const name  = _newName.value.trim();
  const value = _newVal.value;
  if (!name) return;
  const el = editor.selectedEl;
  if (!el || el instanceof SvgCmd) return;
  el.setAttribute(name, value);
  _newName.value = ''; _newVal.value = '';
  _newName.focus();
}
