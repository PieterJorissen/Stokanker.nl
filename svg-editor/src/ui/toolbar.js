import { editor, emit, emitDoc, emitMode, emitSelect, emitUnderlay } from '../state.js';
import { parseD, defaultCmd, computePositions, serializeD } from '../path-utils.js';
import {
  SvgCmd, SvgPathElement, SvgDocumentElement,
  getSvgDocument, customTagFor, svgTagFor, isCmdElement, createCmdElement,
} from '../elements/registry.js';
import { fitView } from '../interact/canvas.js';

let _modeButtons = null;

export function init() {
  _modeButtons = document.querySelectorAll('.mode-btn');
  _modeButtons.forEach(btn => btn.addEventListener('click', () => _setMode(btn.dataset.mode)));

  document.getElementById('btn-new').addEventListener('click', _onNew);
  document.getElementById('btn-load').addEventListener('click', () => document.getElementById('file-input').click());
  document.getElementById('file-input').addEventListener('change', _onFileLoad);
  document.getElementById('btn-paste').addEventListener('click', _onPasteOpen);
  document.getElementById('btn-paste-cancel').addEventListener('click', () => document.getElementById('paste-dialog').close());
  document.getElementById('btn-paste-ok').addEventListener('click', _onPasteLoad);
  document.getElementById('btn-export').addEventListener('click', _onCopy);
  document.getElementById('btn-download').addEventListener('click', _onDownload);
  document.getElementById('btn-fit').addEventListener('click', fitView);
  document.getElementById('btn-underlay').addEventListener('click', _onUnderlayOpen);
  document.getElementById('btn-delete').addEventListener('click', _onDelete);

  document.getElementById('underlay-file').addEventListener('change', _onUnderlayFile);
  document.getElementById('underlay-opacity').addEventListener('input', _onUnderlayOpacity);
  document.getElementById('btn-clear-underlay').addEventListener('click', () => { editor.underlay = null; emitUnderlay(); });
  document.getElementById('btn-underlay-done').addEventListener('click', () => document.getElementById('underlay-dialog').close());

  document.getElementById('btn-add-node').addEventListener('click', _onAddNode);
  document.getElementById('btn-move-up').addEventListener('click', () => _onMove(-1));
  document.getElementById('btn-move-down').addEventListener('click', () => _onMove(1));
  document.getElementById('btn-add-cmd').addEventListener('click', _onAddCmd);

  window.addEventListener('keydown', _onKey);
}

export function syncModeButtons() {
  _modeButtons?.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === editor.mode));
}

// --- New / Load / Paste ---

function _onNew() {
  if (!confirm('New document? Unsaved changes will be lost.')) return;
  _loadSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"></svg>`);
}

function _onFileLoad(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => _loadSVG(ev.target.result);
  reader.readAsText(file);
  e.target.value = '';
}

function _onPasteOpen() {
  document.getElementById('paste-area').value = '';
  document.getElementById('paste-dialog').showModal();
  setTimeout(() => document.getElementById('paste-area').focus(), 50);
}

function _onPasteLoad() {
  const src = document.getElementById('paste-area').value.trim();
  if (src) _loadSVG(src);
  document.getElementById('paste-dialog').close();
}

export function loadSVG(src) { _loadSVG(src); }

function _loadSVG(src) {
  try {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(src.trim(), 'image/svg+xml');
    const root   = parsed.documentElement;
    if (root.localName === 'parsererror') throw new Error(root.textContent.slice(0, 200));
    if (root.localName !== 'svg') throw new Error('Root must be <svg>');

    const docEl = getSvgDocument();
    docEl.innerHTML = '';
    for (const attr of root.attributes) {
      if (!attr.name.startsWith('xmlns')) docEl.setAttribute(attr.name, attr.value);
    }
    for (const child of root.childNodes) {
      const el = _importNode(child);
      if (el) docEl.appendChild(el);
    }
    editor.selectedEl = null;
    editor.mode = 'select';
    emitDoc(); emitMode();
    requestAnimationFrame(() => requestAnimationFrame(fitView));
  } catch(err) {
    alert('Could not load SVG:\n' + err.message);
  }
}

function _importNode(domNode) {
  if (domNode.nodeType === Node.TEXT_NODE) return null; // text handled via data-text
  if (domNode.nodeType === Node.COMMENT_NODE) return null;
  if (domNode.nodeType !== Node.ELEMENT_NODE) return null;

  const svgTag    = domNode.localName;
  const customTag = customTagFor(svgTag);
  if (!customElements.get(customTag)) return null;

  const el = document.createElement(customTag);

  for (const attr of domNode.attributes) {
    if (svgTag === 'path' && attr.name === 'd') continue;
    if (!attr.name.startsWith('xmlns')) el.setAttribute(attr.name, attr.value);
  }

  // Path: create cmd children
  if (svgTag === 'path') {
    const cmds = parseD(domNode.getAttribute('d') || '');
    for (const cmd of cmds) {
      const cmdEl = createCmdElement(cmd.letter);
      const isRel = cmd.letter !== cmd.letter.toUpperCase();
      if (isRel) cmdEl.setAttribute('relative', '');
      for (const [k, v] of Object.entries(cmd)) {
        if (k === 'letter') continue;
        cmdEl.setAttribute(k, v);
      }
      el.appendChild(cmdEl);
    }
    return el;
  }

  // Text-like: grab textContent
  if (['text','tspan','style'].includes(svgTag)) {
    const text = domNode.textContent.trim();
    if (text) el.setAttribute('data-text', text);
  }

  // Recurse
  for (const child of domNode.childNodes) {
    const childEl = _importNode(child);
    if (childEl) el.appendChild(childEl);
  }

  return el;
}

// --- Export ---

function _buildExportString() {
  const docEl = getSvgDocument();
  if (!docEl) return '';
  let out = '<?xml version="1.0" encoding="UTF-8"?>\n';
  out += _serializeEl(docEl, '');
  return out;
}

function _serializeEl(el, indent) {
  if (el instanceof SvgCmd) return '';

  const svgTag   = svgTagFor(el.localName);
  const isRoot   = el instanceof SvgDocumentElement;
  const attrParts = [];

  if (isRoot) attrParts.push('xmlns="http://www.w3.org/2000/svg"');

  for (const attr of el.attributes) {
    if (attr.name === 'data-text') continue;
    attrParts.push(`${attr.name}="${_escAttr(attr.value)}"`);
  }

  // Path d from cmd children
  if (el instanceof SvgPathElement) {
    const d = serializeD(el.cmdElements().map(c => c.toCommand()));
    if (d) attrParts.push(`d="${_escAttr(d)}"`);
  }

  const attrStr  = attrParts.length ? ' ' + attrParts.join(' ') : '';
  const textContent = el.getAttribute('data-text');
  const structChildren = [...el.children].filter(c => !(c instanceof SvgCmd));

  if (!structChildren.length && !textContent) return `${indent}<${svgTag}${attrStr}/>`;

  const inner = [
    textContent ? indent + '  ' + _escText(textContent) : '',
    ...structChildren.map(c => _serializeEl(c, indent + '  ')),
  ].filter(Boolean).join('\n');

  return `${indent}<${svgTag}${attrStr}>\n${inner}\n${indent}</${svgTag}>`;
}

function _onCopy() {
  const text = _buildExportString();
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btn-export');
    const prev = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = prev; }, 1500);
  });
}

function _onDownload() {
  const text = _buildExportString();
  const blob = new Blob([text], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'drawing.svg' });
  a.click(); URL.revokeObjectURL(url);
}

// --- Underlay ---

function _onUnderlayOpen() {
  document.getElementById('underlay-opacity').value = editor.underlay?.opacity ?? 0.4;
  document.getElementById('underlay-opacity-val').textContent = Number(editor.underlay?.opacity ?? 0.4).toFixed(2);
  document.getElementById('underlay-dialog').showModal();
}

function _onUnderlayFile(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    editor.underlay = {
      dataUrl: ev.target.result,
      opacity: parseFloat(document.getElementById('underlay-opacity').value),
      includeInExport: document.getElementById('underlay-include').checked,
    };
    emitUnderlay();
  };
  reader.readAsDataURL(file);
}

function _onUnderlayOpacity(e) {
  const v = parseFloat(e.target.value);
  document.getElementById('underlay-opacity-val').textContent = v.toFixed(2);
  if (editor.underlay) { editor.underlay.opacity = v; emitUnderlay(); }
}

// --- Tree node operations ---

function _onAddNode() {
  const tag  = document.getElementById('add-tag-select').value;
  const docEl = getSvgDocument();
  const parent = (editor.selectedEl && !(editor.selectedEl instanceof SvgCmd) && editor.selectedEl.localName !== 'svg-document')
    ? editor.selectedEl : docEl;
  if (!parent) return;

  const newEl = document.createElement(`svg-${tag}`);
  _applyDefaults(newEl, tag);
  parent.appendChild(newEl);
  editor.selectedEl = newEl;
  emitDoc(); emitSelect();
}

function _onMove(dir) {
  const el = editor.selectedEl;
  if (!el || el instanceof SvgCmd || el instanceof SvgDocumentElement) return;
  const parent = el.parentElement; if (!parent) return;
  const siblings = [...parent.children].filter(c => !(c instanceof SvgCmd));
  const i = siblings.indexOf(el);
  const j = i + dir;
  if (j < 0 || j >= siblings.length) return;
  if (dir === -1) parent.insertBefore(el, siblings[j]);
  else parent.insertBefore(siblings[j], el);
  emitDoc();
}

function _onDelete() {
  const el = editor.selectedEl;
  if (!el || el instanceof SvgDocumentElement) return;
  const parent = el.parentElement;
  if (el instanceof SvgCmd) {
    const pathEl = parent;
    const idx = pathEl.cmdElements().indexOf(el);
    el.remove();
    const cmds = pathEl.cmdElements();
    editor.selectedEl = cmds.length ? cmds[Math.min(idx, cmds.length-1)] : pathEl;
  } else {
    el.remove();
    editor.selectedEl = null;
  }
  emitSelect();
}

function _onAddCmd() {
  const sel = editor.selectedEl;
  let pathEl = null;
  if (sel instanceof SvgPathElement) pathEl = sel;
  else if (sel instanceof SvgCmd && sel.parentElement instanceof SvgPathElement) pathEl = sel.parentElement;
  if (!pathEl) return;

  const letter = document.getElementById('new-cmd-type').value;
  const cmds   = pathEl.cmdElements().map(c => c.toCommand());
  let cx = 0, cy = 0;
  if (cmds.length) {
    const pos = computePositions(cmds);
    const last = pos.at(-1);
    cx = last.absX; cy = last.absY;
  }
  const cmd  = defaultCmd(letter, cx, cy);
  const cmdEl = createCmdElement(cmd.letter);
  const isRel = cmd.letter !== cmd.letter.toUpperCase();
  if (isRel) cmdEl.setAttribute('relative', '');
  for (const [k, v] of Object.entries(cmd)) {
    if (k === 'letter') continue;
    cmdEl.setAttribute(k, v);
  }
  pathEl.appendChild(cmdEl);
  editor.selectedEl = cmdEl;
  emitSelect();
}

// --- Keyboard ---

function _onKey(e) {
  if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
  if (e.key === 's' || e.key === 'S') _setMode('select');
  if (e.key === 'd') _setMode('draw');
  if (e.key === 'f' || e.key === 'F') fitView();
  if (e.key === 'Delete' || e.key === 'Backspace') _onDelete();
  if (e.key === 'Escape') {
    if (editor.mode === 'draw') { editor.mode = 'select'; emitMode(); }
    else { editor.selectedEl = null; emitSelect(); }
  }
}

function _setMode(mode) {
  if (mode === editor.mode) return;
  editor.mode = mode; emitMode();
}

// --- Defaults for new elements ---

function _applyDefaults(el, tag) {
  const defs = {
    rect:    { x:'10', y:'10', width:'100', height:'60', fill:'none', stroke:'#000000', 'stroke-width':'1' },
    circle:  { cx:'50', cy:'50', r:'40', fill:'none', stroke:'#000000', 'stroke-width':'1' },
    ellipse: { cx:'60', cy:'40', rx:'50', ry:'30', fill:'none', stroke:'#000000', 'stroke-width':'1' },
    line:    { x1:'0', y1:'0', x2:'100', y2:'100', stroke:'#000000', 'stroke-width':'1' },
    text:    { x:'10', y:'20', 'font-size':'14', fill:'#000000', 'data-text': 'Text' },
  };
  const d = defs[tag] ?? {};
  for (const [k, v] of Object.entries(d)) el.setAttribute(k, v);
}

function _escAttr(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function _escText(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
