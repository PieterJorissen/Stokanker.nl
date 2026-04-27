// Toolbar — mode buttons, file operations, view controls.

import { state, emit, emitDoc, emitMode, emitViewport, emitUnderlay } from '../model/state.js';
import { fromString, serialize, defaultDocument, createNode, findById, findParent } from '../model/node.js';

let _modeButtons = null;

export function init() {
  _modeButtons = document.querySelectorAll('.mode-btn');

  _modeButtons.forEach(btn => {
    btn.addEventListener('click', () => setModeIfAllowed(btn.dataset.mode));
  });

  document.getElementById('btn-new').addEventListener('click', onNew);
  document.getElementById('btn-load').addEventListener('click', () => document.getElementById('file-input').click());
  document.getElementById('file-input').addEventListener('change', onFileLoad);
  document.getElementById('btn-paste').addEventListener('click', onPasteOpen);
  document.getElementById('btn-export').addEventListener('click', onCopySVG);
  document.getElementById('btn-download').addEventListener('click', onDownload);
  document.getElementById('btn-fit').addEventListener('click', onFitView);
  document.getElementById('btn-underlay').addEventListener('click', onUnderlayOpen);
  document.getElementById('btn-delete').addEventListener('click', onDelete);

  document.getElementById('btn-paste-cancel').addEventListener('click', () =>
    document.getElementById('paste-dialog').close());
  document.getElementById('btn-paste-ok').addEventListener('click', onPasteLoad);

  document.getElementById('underlay-file').addEventListener('change', onUnderlayFile);
  document.getElementById('underlay-opacity').addEventListener('input', onUnderlayOpacity);
  document.getElementById('btn-clear-underlay').addEventListener('click', () => {
    state.underlay = null; emitUnderlay();
  });
  document.getElementById('btn-underlay-done').addEventListener('click', () =>
    document.getElementById('underlay-dialog').close());

  document.getElementById('btn-add-node').addEventListener('click', onAddNode);
  document.getElementById('btn-move-up').addEventListener('click', () => onMoveNode(-1));
  document.getElementById('btn-move-down').addEventListener('click', () => onMoveNode(1));

  window.addEventListener('keydown', onKeyDown);
}

export function syncModeButtons() {
  _modeButtons?.forEach(btn =>
    btn.classList.toggle('active', btn.dataset.mode === state.mode));
}

// --- File ---

function onNew() {
  if (!confirm('New document? Unsaved changes will be lost.')) return;
  state.root = defaultDocument();
  state.selectedId = null;
  state.selectedCmdIdx = null;
  state.mode = 'select';
  emitDoc();
  emitMode();
}

function onFileLoad(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => loadSVGString(ev.target.result);
  reader.readAsText(file);
  e.target.value = '';
}

function onPasteOpen() {
  document.getElementById('paste-area').value = '';
  document.getElementById('paste-dialog').showModal();
  setTimeout(() => document.getElementById('paste-area').focus(), 50);
}

function onPasteLoad() {
  const src = document.getElementById('paste-area').value.trim();
  if (src) loadSVGString(src);
  document.getElementById('paste-dialog').close();
}

function loadSVGString(src) {
  try {
    state.root = fromString(src);
    state.selectedId = null;
    state.selectedCmdIdx = null;
    state.mode = 'select';
    emitDoc();
    emitMode();
    onFitView();
  } catch (err) {
    alert('Could not load SVG:\n' + err.message);
  }
}

function onCopySVG() {
  const text = buildExportString();
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btn-export');
    const prev = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = prev; }, 1500);
  });
}

function onDownload() {
  const text = buildExportString();
  const blob = new Blob([text], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'drawing.svg'; a.click();
  URL.revokeObjectURL(url);
}

function buildExportString() {
  let root = state.root;

  // Optionally embed underlay as <image> element
  if (state.underlay?.includeInExport && state.underlay.dataUrl) {
    const imgNode = createNode('image', {
      href: state.underlay.dataUrl,
      x: '0', y: '0',
      width: root.attrs.viewBox?.split(/[\s,]+/)[2] ?? '100%',
      height: root.attrs.viewBox?.split(/[\s,]+/)[3] ?? '100%',
      opacity: String(state.underlay.opacity),
      preserveAspectRatio: 'xMidYMid meet',
    });
    root = {
      ...root,
      attrs: { ...root.attrs },
      children: [imgNode, ...root.children],
    };
  }

  // Ensure xmlns on root
  const exportRoot = {
    ...root,
    attrs: { xmlns: 'http://www.w3.org/2000/svg', ...root.attrs },
  };

  return '<?xml version="1.0" encoding="UTF-8"?>\n' + serialize(exportRoot);
}

// --- View ---

export function onFitView() {
  const docGroup = document.getElementById('doc');
  const canvas = document.getElementById('canvas');
  if (!docGroup || !canvas) return;

  let bbox = null;
  try { bbox = docGroup.getBBox(); } catch { /* ignore */ }

  if (!bbox || (bbox.width === 0 && bbox.height === 0)) {
    const vbStr = state.root?.attrs?.viewBox;
    if (vbStr) {
      const parts = vbStr.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] && parts[3]) {
        bbox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
      }
    }
  }

  if (!bbox?.width || !bbox?.height) return;

  const cw = canvas.clientWidth || canvas.getBoundingClientRect().width;
  const ch = canvas.clientHeight || canvas.getBoundingClientRect().height;
  if (!cw || !ch) return;

  const zoom = Math.min(cw / bbox.width, ch / bbox.height) * 0.88;
  const x = bbox.x - (cw / zoom - bbox.width) / 2;
  const y = bbox.y - (ch / zoom - bbox.height) / 2;
  state.viewport = { x, y, zoom };
  emitViewport();
}

// --- Underlay ---

function onUnderlayOpen() {
  document.getElementById('underlay-opacity').value = state.underlay?.opacity ?? 0.4;
  document.getElementById('underlay-opacity-val').textContent =
    Number(state.underlay?.opacity ?? 0.4).toFixed(2);
  document.getElementById('underlay-dialog').showModal();
}

function onUnderlayFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    state.underlay = {
      dataUrl: ev.target.result,
      opacity: parseFloat(document.getElementById('underlay-opacity').value),
      includeInExport: document.getElementById('underlay-include').checked,
    };
    emitUnderlay();
  };
  reader.readAsDataURL(file);
}

function onUnderlayOpacity(e) {
  const v = parseFloat(e.target.value);
  document.getElementById('underlay-opacity-val').textContent = v.toFixed(2);
  if (state.underlay) { state.underlay.opacity = v; emitUnderlay(); }
}

// --- Node tree operations ---

function onAddNode() {
  const tag = document.getElementById('add-tag-select').value;
  const parentId = state.selectedId ?? state.root._id;
  const parent = findById(state.root, parentId);
  if (!parent || parent.tag === '#text') return;

  const newNode = createNode(tag, defaultAttrsForTag(tag));
  parent.children.push(newNode);
  state.selectedId = newNode._id;
  state.selectedCmdIdx = null;
  emitDoc();
}

function onMoveNode(dir) {
  if (!state.selectedId || state.selectedId === state.root._id) return;
  const parent = findParent(state.root, state.selectedId);
  if (!parent) return;
  const i = parent.children.findIndex(c => c._id === state.selectedId);
  const j = i + dir;
  if (j < 0 || j >= parent.children.length) return;
  [parent.children[i], parent.children[j]] = [parent.children[j], parent.children[i]];
  emitDoc();
}

function onDelete() {
  if (!state.selectedId || state.selectedId === state.root._id) return;
  const parent = findParent(state.root, state.selectedId);
  if (!parent) return;
  parent.children = parent.children.filter(c => c._id !== state.selectedId);
  state.selectedId = null;
  state.selectedCmdIdx = null;
  emitDoc();
  emit('select');
}

// --- Keyboard ---

function onKeyDown(e) {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  if (e.key === 's') setModeIfAllowed('select');
  if (e.key === 'e') setModeIfAllowed('path-edit');
  if (e.key === 'd') setModeIfAllowed('draw');
  if (e.key === 'f' || e.key === 'F') onFitView();
  if (e.key === 'Delete' || e.key === 'Backspace') onDelete();
  if (e.key === 'Escape') {
    if (state.mode === 'draw') { emit('draw-cancel'); state.mode = 'select'; emitMode(); }
    else { state.selectedId = null; state.selectedCmdIdx = null; emit('select'); }
  }
}

function setModeIfAllowed(mode) {
  if (mode === state.mode) return;
  if (mode === 'path-edit') {
    const node = state.selectedId ? findById(state.root, state.selectedId) : null;
    if (!node || node.tag !== 'path') return;
  }
  state.mode = mode;
  emitMode();
}

// --- Defaults for new elements ---

function defaultAttrsForTag(tag) {
  switch (tag) {
    case 'rect':    return { x: '10', y: '10', width: '100', height: '60', fill: 'none', stroke: '#000000', 'stroke-width': '1' };
    case 'circle':  return { cx: '50', cy: '50', r: '40', fill: 'none', stroke: '#000000', 'stroke-width': '1' };
    case 'ellipse': return { cx: '60', cy: '40', rx: '50', ry: '30', fill: 'none', stroke: '#000000', 'stroke-width': '1' };
    case 'line':    return { x1: '0', y1: '0', x2: '100', y2: '100', stroke: '#000000', 'stroke-width': '1' };
    case 'path':    return { d: 'M 0 0 L 100 100', fill: 'none', stroke: '#000000', 'stroke-width': '1' };
    case 'text':    return { x: '10', y: '20', 'font-size': '14', fill: '#000000' };
    case 'g':       return {};
    default:        return {};
  }
}
