// Draw mode — click to append points to a path, right-click or Esc to finish.
// Uses editor.selectedId as the draw target; creates a new path if needed.
// The path is a live document node — the document IS the source of truth during drawing.

import { doc, editor, emit, emitDoc, emitMode } from '../model/state.js';
import { createNode, findById } from '../model/node.js';
import { parseD, serializeD, computePositions } from '../model/path.js';

let _previewDocPos = null;

/** Reset preview state when entering draw mode. */
export function startDraw() {
  _previewDocPos = null;
}

/** Cancel draw — just switch mode; partial path stays as a document node. */
export function cancelDraw() {
  _previewDocPos = null;
}

export const handler = {
  onDown(e, docPos) {
    if (e.button === 2) { finishDrawAndSwitch(); return; }
  },

  onUp(e, docPos) {
    if (e.button !== 0) return;
    appendOrCreate(docPos);
  },

  onMove(e, docPos) {
    _previewDocPos = docPos;
    emit('overlay');
  },

  onDragEnd(e, docPos) {
    appendOrCreate(docPos);
  },

  onContextMenu(e) {
    e.preventDefault?.();
    finishDrawAndSwitch();
  },

  onLongPress() {
    finishDrawAndSwitch();
  },
};

function appendOrCreate(docPos) {
  const node = editor.selectedId ? findById(doc.root, editor.selectedId) : null;

  if (node && node.tag === 'path') {
    const cmds = parseD(node.attrs.d || '');
    cmds.push(buildCmd('L', docPos, cmds));
    node.attrs.d = serializeD(cmds);
    editor.selectedCmdIdx = cmds.length - 1;
    emitDoc();
  } else {
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
    editor.selectedId = newPath._id;
    editor.selectedCmdIdx = 0;
    emitDoc();
  }
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
  _previewDocPos = null;
  editor.mode = 'select';
  emitMode();
}

/** Current preview position (read by overlay.js for live cursor preview line). */
export function getPreviewPos() {
  return _previewDocPos;
}

function fmt(n) {
  if (!isFinite(n)) return 0;
  const s = n.toFixed(2);
  return parseFloat(s);
}
