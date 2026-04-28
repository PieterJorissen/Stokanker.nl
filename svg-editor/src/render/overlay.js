// Overlay renderer — display-only handles, anchors, and selection boxes.
// Drawn in the #overlay SVG group (same coordinate space as #doc).
// Never writes to the document. Redrawn on any state change.

import { doc, editor } from '../model/state.js';
import { findById } from '../model/node.js';
import { parseD, computePositions } from '../model/path.js';
import { elForId } from './svg.js';
import { getPreviewPos, getDrawNodeId } from '../interact/draw.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const ANCHOR_R    = 5;
const HANDLE_R    = 3.5;
const SEL_BOX_PAD = 4;

let _overlay      = null;
let _selBox       = null;
let _pathHandles  = null;

export function init(overlayGroup, selBox, pathHandles) {
  _overlay     = overlayGroup;
  _selBox      = selBox;
  _pathHandles = pathHandles;
}

export function renderOverlay() {
  renderDocBorder();
  renderSelectionBox();
  renderPathHandles();
  renderDrawPreview();
  applyModePointerEvents();
}

// --- Document bounds border ---

let _docBorder = null;

function renderDocBorder() {
  if (!_overlay) return;
  if (!_docBorder) {
    _docBorder = el('rect', { class: 'doc-border', fill: 'none' });
    _overlay.insertBefore(_docBorder, _overlay.firstChild);
  }
  const vbStr = doc.root?.attrs?.viewBox;
  if (!vbStr) { _docBorder.style.display = 'none'; return; }
  const parts = vbStr.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4) { _docBorder.style.display = 'none'; return; }
  const [x, y, w, h] = parts;
  const sw = 1 / (editor.viewport.zoom || 1);
  _docBorder.setAttribute('x', x);
  _docBorder.setAttribute('y', y);
  _docBorder.setAttribute('width', w);
  _docBorder.setAttribute('height', h);
  _docBorder.setAttribute('stroke-width', sw);
  _docBorder.style.display = '';
}

// --- Selection box ---

function renderSelectionBox() {
  if (!_selBox) return;

  const id = editor.selectedId;
  // Hide selection box when a path has handles showing (handles ARE the selection indicator)
  if (!id || getSelectedPathNode()) {
    _selBox.style.display = 'none';
    return;
  }

  const domEl = elForId(id);
  if (!domEl || typeof domEl.getBBox !== 'function') {
    _selBox.style.display = 'none';
    return;
  }

  try {
    const bbox = domEl.getBBox();
    if (bbox.width === 0 && bbox.height === 0) { _selBox.style.display = 'none'; return; }
    const pad = SEL_BOX_PAD / editor.viewport.zoom;
    _selBox.setAttribute('x', bbox.x - pad);
    _selBox.setAttribute('y', bbox.y - pad);
    _selBox.setAttribute('width', bbox.width + pad * 2);
    _selBox.setAttribute('height', bbox.height + pad * 2);
    _selBox.setAttribute('stroke-width', 1.5 / editor.viewport.zoom);
    _selBox.style.display = '';
  } catch {
    _selBox.style.display = 'none';
  }
}

// --- Path handles ---
// Shown whenever a path is selected (select or draw mode).

function renderPathHandles() {
  while (_pathHandles.firstChild) _pathHandles.removeChild(_pathHandles.firstChild);
  if (!_pathHandles) return;

  // In draw mode, show handles for the path being drawn (via selectedId set by draw.js).
  // In select mode, show handles for the selected path.
  const node = getSelectedPathNode();
  if (!node) return;

  const cmds = parseD(node.attrs.d || '');
  if (!cmds.length) return;

  const positions = computePositions(cmds);
  const z        = editor.viewport.zoom;
  const anchorR  = ANCHOR_R / z;
  const handleR  = HANDLE_R / z;
  const strokeW  = 1 / z;

  // Handle lines (behind anchors)
  positions.forEach(({ absX, absY, controls }) => {
    controls.forEach(cp => {
      _pathHandles.appendChild(el('line', {
        x1: absX, y1: absY, x2: cp.x, y2: cp.y,
        stroke: '#888', 'stroke-width': strokeW,
        'stroke-dasharray': `${3 / z},${2 / z}`,
        class: 'handle-line',
      }));
    });
  });

  // Control point handles
  positions.forEach(({ controls }, i) => {
    controls.forEach((cp, ci) => {
      _pathHandles.appendChild(el('circle', {
        cx: cp.x, cy: cp.y, r: handleR,
        class: 'handle',
        'data-cmd': i, 'data-cp': ci,
        fill: '#4a90e2', stroke: '#fff',
        'stroke-width': strokeW * 0.8,
      }));
    });
  });

  // Endpoint anchors
  positions.forEach(({ absX, absY }, i) => {
    const cmd = cmds[i];
    if (cmd.letter.toUpperCase() === 'Z') return;
    const isSelected = editor.selectedCmdIdx === i;
    _pathHandles.appendChild(el('circle', {
      cx: absX, cy: absY, r: anchorR,
      class: isSelected ? 'anchor selected' : 'anchor',
      'data-cmd': i,
      fill: isSelected ? '#ff6b35' : '#fff',
      stroke: isSelected ? '#ff6b35' : '#4a90e2',
      'stroke-width': strokeW * 1.2,
    }));
  });
}

// --- Draw preview line ---

function renderDrawPreview() {
  const existing = _overlay.querySelector('.draw-preview');
  if (existing) existing.remove();

  if (editor.mode !== 'draw') return;
  const preview = getPreviewPos();
  const drawId  = getDrawNodeId();
  if (!preview || drawId === null) return;

  const node = findById(doc.root, drawId);
  if (!node || node.tag !== 'path') return;

  const cmds = parseD(node.attrs.d || '');
  if (!cmds.length) return;

  const positions = computePositions(cmds);
  const last = positions[positions.length - 1];
  const z = editor.viewport.zoom;

  _overlay.appendChild(el('line', {
    x1: last.absX, y1: last.absY,
    x2: preview.x, y2: preview.y,
    stroke: '#4a90e2',
    'stroke-width': 1 / z,
    'stroke-dasharray': `${4 / z},${3 / z}`,
    class: 'draw-preview',
  }));
}

// Handles are interactive in select mode only.
// In draw mode they're visible (showing progress) but pointer-events disabled.
function applyModePointerEvents() {
  if (!_overlay) return;
  _overlay.style.pointerEvents = 'none';
  if (_pathHandles) {
    _pathHandles.style.pointerEvents = editor.mode === 'select' ? 'all' : 'none';
  }
}

function getSelectedPathNode() {
  const id = editor.selectedId;
  if (!id) return null;
  const node = findById(doc.root, id);
  return node?.tag === 'path' ? node : null;
}

function el(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}
