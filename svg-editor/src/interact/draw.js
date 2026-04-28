// Draw mode — click to append points to a path, right-click or Esc to finish.
// Creates a new path node in the document on first click.
// The path is a live document node — the document IS the source of truth during drawing.

import { doc, editor, emit, emitDoc, emitMode } from '../model/state.js';
import { createNode, findById, findParent } from '../model/node.js';
import { parseD, serializeD, computePositions } from '../model/path.js';

let _drawNodeId = null;   // _id of the path node being drawn
let _previewDocPos = null;

/** Start a new draw session (called when entering draw mode or on first click). */
export function startDraw() {
  _drawNodeId = null;
  _previewDocPos = null;
  document.getElementById('draw-hint').hidden = false;
}

/** Cancel and remove the current draw path (Escape handler). */
export function cancelDraw() {
  if (_drawNodeId !== null) {
    const parent = findParent(doc.root, _drawNodeId);
    if (parent) {
      parent.children = parent.children.filter(c => c._id !== _drawNodeId);
    }
    _drawNodeId = null;
    emitDoc();
  }
  document.getElementById('draw-hint').hidden = true;
}

/** Finish the current draw path (keep it). */
export function finishDraw() {
  _drawNodeId = null;
  _previewDocPos = null;
  document.getElementById('draw-hint').hidden = true;
}

export const handler = {
  onDown(e, docPos) {
    if (e.button === 2) {
      finishDrawAndSwitch();
      return;
    }
    if (e.button !== 0) return;
  },

  onUp(e, docPos) {
    if (e.button !== 0) return;

    if (_drawNodeId === null) {
      createDrawPath(docPos);
    } else {
      appendPoint(docPos);
    }
  },

  onMove(e, docPos) {
    _previewDocPos = docPos;
    emit('overlay');
  },

  onDragEnd(e, docPos) {
    if (_drawNodeId === null) {
      createDrawPath(docPos);
    } else {
      appendPoint(docPos);
    }
  },

  onContextMenu(e) {
    e.preventDefault?.();
    finishDrawAndSwitch();
  },

  onLongPress() {
    finishDrawAndSwitch();
  },
};

function createDrawPath(docPos) {
  const parentId = editor.selectedId ?? doc.root._id;
  const parent = findById(doc.root, parentId);
  const target = (parent && parent.tag !== '#text' && parent.tag !== 'path')
    ? parent
    : doc.root;

  const newPath = createNode('path', {
    d: `M ${fmt(docPos.x)} ${fmt(docPos.y)}`,
    fill: 'none',
    stroke: '#000000',
    'stroke-width': '1',
  });

  target.children.push(newPath);
  _drawNodeId = newPath._id;
  editor.selectedId = newPath._id;
  editor.selectedCmdIdx = 0;
  emitDoc();
}

function appendPoint(docPos) {
  if (_drawNodeId === null) return;

  const node = findById(doc.root, _drawNodeId);
  if (!node) { _drawNodeId = null; return; }

  const cmds = parseD(node.attrs.d || '');
  cmds.push(buildCmd('L', docPos, cmds));
  node.attrs.d = serializeD(cmds);
  editor.selectedCmdIdx = cmds.length - 1;
  emitDoc();
}

function buildCmd(letter, docPos, cmds) {
  const L = letter.toUpperCase();
  const rel = letter !== L;

  let cx = 0, cy = 0;
  if (cmds.length > 0) {
    const positions = computePositions(cmds);
    const last = positions[positions.length - 1];
    cx = last.absX; cy = last.absY;
  }

  const x = fmt(rel ? docPos.x - cx : docPos.x);
  const y = fmt(rel ? docPos.y - cy : docPos.y);

  switch (L) {
    case 'L': case 'M': case 'T': return { letter, x, y };
    case 'H': return { letter, x: fmt(rel ? docPos.x - cx : docPos.x) };
    case 'V': return { letter, y: fmt(rel ? docPos.y - cy : docPos.y) };
    case 'C': {
      const mx = rel ? fmt((docPos.x - cx) / 2) : fmt((cx + docPos.x) / 2);
      const my = rel ? fmt((docPos.y - cy) / 2 - 30) : fmt((cy + docPos.y) / 2 - 30);
      const ex = rel ? fmt(docPos.x - cx - 10) : fmt(docPos.x - 10);
      const ey = rel ? fmt(y - 30) : fmt(docPos.y - 30);
      return { letter, x1: mx, y1: my, x2: ex, y2: ey, x, y };
    }
    case 'Q': {
      const qx = rel ? fmt((docPos.x - cx) / 2) : fmt((cx + docPos.x) / 2);
      const qy = rel ? fmt((docPos.y - cy) / 2 - 20) : fmt((cy + docPos.y) / 2 - 20);
      return { letter, x1: qx, y1: qy, x, y };
    }
    default: return { letter, x, y };
  }
}

function finishDrawAndSwitch() {
  finishDraw();
  editor.mode = 'select';
  emitMode();
}

/** Current preview position (read by overlay.js for live cursor preview line). */
export function getPreviewPos() {
  return _previewDocPos;
}

/** Current draw node id (read by overlay.js). */
export function getDrawNodeId() {
  return _drawNodeId;
}

function fmt(n) {
  if (!isFinite(n)) return 0;
  const s = n.toFixed(2);
  return parseFloat(s);
}
