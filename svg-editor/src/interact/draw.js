// Draw mode — click to append points to a path, right-click or Esc to finish.
// Creates a new path node in the document on first click.
// The path is a live document node — the document IS the source of truth during drawing.

import { state, emit, emitDoc, emitMode } from '../model/state.js';
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
    const parent = findParent(state.root, _drawNodeId);
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
    // Right-click or long-press finishes the path
    if (e.button === 2) {
      finishDrawAndSwitch();
      return;
    }
    if (e.button !== 0) return;
  },

  onUp(e, docPos) {
    if (e.button !== 0) return;

    if (_drawNodeId === null) {
      // First click: create the path node
      createDrawPath(docPos);
    } else {
      appendPoint(docPos);
    }
  },

  onMove(e, docPos, delta) {
    _previewDocPos = docPos;
    emit('overlay'); // lightweight: only redraws the overlay (preview line)
  },

  onDragEnd(e, docPos) {
    // Drag in draw mode just moves — end of drag still appends a point
    if (_drawNodeId === null) {
      createDrawPath(docPos);
    } else {
      appendPoint(docPos);
    }
  },

  onContextMenu(e, docPos) {
    e.preventDefault?.();
    finishDrawAndSwitch();
  },

  onLongPress(e, docPos) {
    finishDrawAndSwitch();
  },
};

function createDrawPath(docPos) {
  // Find best parent: selected group, or document root
  const parentId = state.selectedId ?? state.root._id;
  const parent = findById(state.root, parentId);
  const target = (parent && parent.tag !== '#text' && parent.tag !== 'path')
    ? parent
    : state.root;

  const newPath = createNode('path', {
    d: `M ${fmt(docPos.x)} ${fmt(docPos.y)}`,
    fill: 'none',
    stroke: '#000000',
    'stroke-width': '1',
  });

  target.children.push(newPath);
  _drawNodeId = newPath._id;
  state.selectedId = newPath._id;
  state.selectedCmdIdx = 0;
  emitDoc();
}

function appendPoint(docPos) {
  if (_drawNodeId === null) return;

  const node = findById(state.root, _drawNodeId);
  if (!node) { _drawNodeId = null; return; }

  const cmds = parseD(node.attrs.d || '');
  const cmdType = state.drawCmdType || 'L';
  cmds.push({ letter: cmdType, args: buildArgs(cmdType, docPos, cmds) });
  node.attrs.d = serializeD(cmds);
  state.selectedCmdIdx = cmds.length - 1;
  emitDoc();
}

function buildArgs(letter, docPos, cmds) {
  const L = letter.toUpperCase();
  const rel = letter !== L;

  // Get current pen position for relative commands
  let cx = 0, cy = 0;
  if (cmds.length > 0) {
    const positions = computePositions(cmds);
    const last = positions[positions.length - 1];
    cx = last.absX; cy = last.absY;
  }

  const x = rel ? docPos.x - cx : docPos.x;
  const y = rel ? docPos.y - cy : docPos.y;

  switch (L) {
    case 'L': case 'M': case 'T': return [fmt(x), fmt(y)];
    case 'H': return [fmt(rel ? x : docPos.x)];
    case 'V': return [fmt(rel ? y : docPos.y)];
    case 'C': {
      const mx = (cx + docPos.x) / 2;
      const my = (cy + docPos.y) / 2;
      return rel
        ? [fmt(mx - cx), fmt(my - cy - 30), fmt(docPos.x - cx - 10), fmt(y - 30), fmt(x), fmt(y)]
        : [fmt(mx), fmt(my - 30), fmt(docPos.x - 10), fmt(docPos.y - 30), fmt(docPos.x), fmt(docPos.y)];
    }
    case 'Q': {
      const mx = rel ? (docPos.x - cx) / 2 : (cx + docPos.x) / 2;
      const my = rel ? (docPos.y - cy) / 2 - 20 : (cy + docPos.y) / 2 - 20;
      return [fmt(mx), fmt(my), fmt(x), fmt(y)];
    }
    default: return [fmt(x), fmt(y)];
  }
}

function finishDrawAndSwitch() {
  finishDraw();
  state.mode = 'select';
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
  return parseFloat(s); // removes trailing zeros
}
