// Overlay renderer — display-only handles, anchors, and selection boxes.
// Drawn in the #overlay SVG group (same coordinate space as #doc).
// Never writes to the document. Redrawn on any state change.

import { state } from '../model/state.js';
import { findById } from '../model/node.js';
import { parseD, computePositions } from '../model/path.js';
import { elForId } from './svg.js';
import { getPreviewPos, getDrawNodeId } from '../interact/draw.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Pixel sizes for handles (will be divided by viewport.zoom so they stay screen-constant)
const ANCHOR_R = 5;
const HANDLE_R = 3.5;
const SEL_BOX_PAD = 4;

let _overlay = null;
let _selBox = null;
let _pathHandles = null;

export function init(overlayGroup, selBox, pathHandles) {
  _overlay = overlayGroup;
  _selBox = selBox;
  _pathHandles = pathHandles;
}

/** Full overlay redraw based on current state. */
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
  const vbStr = state.root?.attrs?.viewBox;
  if (!vbStr) { _docBorder.style.display = 'none'; return; }
  const parts = vbStr.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4) { _docBorder.style.display = 'none'; return; }
  const [x, y, w, h] = parts;
  const sw = 1 / (state.viewport.zoom || 1);
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

  const id = state.selectedId;
  if (!id || state.mode === 'path-edit') {
    _selBox.style.display = 'none';
    return;
  }

  const el = elForId(id);
  if (!el || typeof el.getBBox !== 'function') {
    _selBox.style.display = 'none';
    return;
  }

  try {
    const bbox = el.getBBox();
    if (bbox.width === 0 && bbox.height === 0) { _selBox.style.display = 'none'; return; }
    const pad = SEL_BOX_PAD / state.viewport.zoom;
    _selBox.setAttribute('x', bbox.x - pad);
    _selBox.setAttribute('y', bbox.y - pad);
    _selBox.setAttribute('width', bbox.width + pad * 2);
    _selBox.setAttribute('height', bbox.height + pad * 2);
    _selBox.setAttribute('stroke-width', 1.5 / state.viewport.zoom);
    _selBox.style.display = '';
  } catch {
    _selBox.style.display = 'none';
  }
}

// --- Path handles ---

function renderPathHandles() {
  while (_pathHandles.firstChild) _pathHandles.removeChild(_pathHandles.firstChild);
  if (!_pathHandles) return;

  if (state.mode !== 'path-edit' && state.mode !== 'draw') return;

  const id = state.selectedId;
  if (!id) return;

  const node = findById(state.root, id);
  if (!node || node.tag !== 'path') return;

  const dAttr = node.attrs.d || '';
  const cmds = parseD(dAttr);
  if (!cmds.length) return;

  const positions = computePositions(cmds);
  const z = state.viewport.zoom;
  const anchorR = ANCHOR_R / z;
  const handleR = HANDLE_R / z;
  const strokeW = 1 / z;

  // Draw handle lines first (behind anchors)
  positions.forEach(({ absX, absY, controls }, i) => {
    controls.forEach(cp => {
      const line = el('line', {
        x1: absX, y1: absY, x2: cp.x, y2: cp.y,
        stroke: '#888', 'stroke-width': strokeW,
        'stroke-dasharray': `${3 / z},${2 / z}`,
        class: 'handle-line',
      });
      _pathHandles.appendChild(line);
    });
  });

  // Draw control point handles
  positions.forEach(({ absX, absY, controls }, i) => {
    controls.forEach((cp, ci) => {
      const circle = el('circle', {
        cx: cp.x, cy: cp.y, r: handleR,
        class: 'handle',
        'data-cmd': i,
        'data-cp': ci,
        fill: '#4a90e2',
        stroke: '#fff',
        'stroke-width': strokeW * 0.8,
      });
      _pathHandles.appendChild(circle);
    });
  });

  // Draw endpoint anchors
  positions.forEach(({ absX, absY }, i) => {
    const isSelected = state.selectedCmdIdx === i;
    const cmd = cmds[i];
    if (cmd.letter.toUpperCase() === 'Z') return; // Z has no visual anchor

    const circle = el('circle', {
      cx: absX, cy: absY, r: anchorR,
      class: isSelected ? 'anchor selected' : 'anchor',
      'data-cmd': i,
      fill: isSelected ? '#ff6b35' : '#fff',
      stroke: isSelected ? '#ff6b35' : '#4a90e2',
      'stroke-width': strokeW * 1.2,
    });
    _pathHandles.appendChild(circle);
  });
}

// --- Draw preview line ---

function renderDrawPreview() {
  // Remove any existing preview
  const existing = _overlay.querySelector('.draw-preview');
  if (existing) existing.remove();

  if (state.mode !== 'draw') return;
  const preview = getPreviewPos();
  const drawId = getDrawNodeId();
  if (!preview || drawId === null) return;

  const node = findById(state.root, drawId);
  if (!node || node.tag !== 'path') return;

  const cmds = parseD(node.attrs.d || '');
  if (!cmds.length) return;

  const positions = computePositions(cmds);
  const last = positions[positions.length - 1];
  const z = state.viewport.zoom;

  const line = el('line', {
    x1: last.absX, y1: last.absY,
    x2: preview.x, y2: preview.y,
    stroke: '#4a90e2',
    'stroke-width': 1 / z,
    'stroke-dasharray': `${4 / z},${3 / z}`,
    class: 'draw-preview',
  });
  _overlay.appendChild(line);
}

// Allow pointer events on anchors/handles only in path-edit mode
function applyModePointerEvents() {
  if (!_overlay) return;
  if (state.mode === 'path-edit') {
    _overlay.style.pointerEvents = 'none';
    _pathHandles.style.pointerEvents = 'all';
  } else {
    _overlay.style.pointerEvents = 'none';
    if (_pathHandles) _pathHandles.style.pointerEvents = 'none';
  }
}

// SVG element factory
function el(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, v);
  }
  return node;
}
