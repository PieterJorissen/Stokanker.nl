// Select mode — click to select SVG elements, left-drag on background to pan.
// When a path is selected, anchor/handle interaction is handled here too —
// there is no separate path-edit mode; paths are editable directly in select mode.

import { doc, editor, emit, emitDoc, emitViewport } from '../model/state.js';
import { findById } from '../model/node.js';
import { parseD, serializeD } from '../model/path.js';
import { idForEl, isDocElement } from '../render/svg.js';

let _panningBg = false;

// Path anchor/handle drag state (previously lived in path-edit.js)
let _dragging = null;
// _dragging = {
//   type: 'anchor' | 'handle',
//   cmdIdx: number,
//   cpIdx: number (handles only),
//   cmds: PathCommand[],
//   node: SvgNode,
//   startDocX: number,
//   startDocY: number,
//   startProps: { ...cmd }   — named-prop snapshot for delta computation
// }

export const handler = {
  onDown(e, docPos) {
    _panningBg = false;
    if (e.button !== 0) return;

    const target = e.target;
    const isAnchor = target.classList.contains('anchor');
    const isHandle = target.classList.contains('handle');

    // --- Path anchor / control-handle click → start drag ---
    if (isAnchor || isHandle) {
      const cmdIdx = target.dataset.cmd !== undefined ? parseInt(target.dataset.cmd) : null;
      const cpIdx  = target.dataset.cp  !== undefined ? parseInt(target.dataset.cp)  : null;
      if (cmdIdx === null) return;

      const node = getSelectedPath();
      if (!node) return;

      const cmds = parseD(node.attrs.d || '');
      if (cmdIdx >= cmds.length) return;

      editor.selectedCmdIdx = cmdIdx;
      emit('select');

      _dragging = {
        type: isHandle ? 'handle' : 'anchor',
        cmdIdx,
        cpIdx: cpIdx ?? 0,
        cmds,
        node,
        startDocX: docPos.x,
        startDocY: docPos.y,
        startProps: { ...cmds[cmdIdx] },
      };
      return;
    }

    // --- Background (not a doc element, not an anchor) → allow pan ---
    if (!isDocElement(target)) {
      _panningBg = true;
    }
  },

  onMove(e, docPos, delta) {
    if (_dragging) {
      applyDrag(docPos);
      return;
    }
    if (_panningBg) {
      editor.viewport.x -= delta.dx;
      editor.viewport.y -= delta.dy;
      emitViewport();
    }
  },

  onDragEnd(e, docPos) {
    if (_dragging) {
      applyDrag(docPos);
      _dragging = null;
    }
    _panningBg = false;
  },

  onUp(e, docPos) {
    const hadDrag = _dragging !== null;
    _dragging = null;
    _panningBg = false;
    if (e.button !== 0) return;

    // Anchor/handle click (no movement): cmd already selected in onDown — done.
    if (hadDrag) return;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && isDocElement(el)) {
      const id = idForEl(el);
      if (id !== null) {
        editor.selectedId = id;
        editor.selectedCmdIdx = null;
        emit('select');
        return;
      }
    }

    // Click on background: deselect cmd first (keep node), then node on second click.
    if (editor.selectedCmdIdx !== null) {
      editor.selectedCmdIdx = null;
      emit('select');
    } else {
      editor.selectedId = null;
      editor.selectedCmdIdx = null;
      emit('select');
    }
  },

  onContextMenu(e, docPos) {
    editor.selectedId = null;
    editor.selectedCmdIdx = null;
    emit('select');
  },
};

// --- Path drag logic ---

function applyDrag(docPos) {
  const { type, cmdIdx, cpIdx, cmds, node } = _dragging;
  const cmd  = cmds[cmdIdx];
  const L    = cmd.letter.toUpperCase();
  const dx   = docPos.x - _dragging.startDocX;
  const dy   = docPos.y - _dragging.startDocY;
  const orig = _dragging.startProps;

  if (type === 'anchor') {
    if (L === 'M' || L === 'L' || L === 'T') {
      cmd.x = orig.x + dx;  cmd.y = orig.y + dy;
    } else if (L === 'H') {
      cmd.x = orig.x + dx;
    } else if (L === 'V') {
      cmd.y = orig.y + dy;
    } else if (L === 'C' || L === 'S' || L === 'Q' || L === 'A') {
      cmd.x = orig.x + dx;  cmd.y = orig.y + dy;
    }
  } else {
    if (L === 'C') {
      if (cpIdx === 0) { cmd.x1 = orig.x1 + dx;  cmd.y1 = orig.y1 + dy; }
      else             { cmd.x2 = orig.x2 + dx;  cmd.y2 = orig.y2 + dy; }
    } else if (L === 'S') {
      cmd.x2 = orig.x2 + dx;  cmd.y2 = orig.y2 + dy;
    } else if (L === 'Q') {
      cmd.x1 = orig.x1 + dx;  cmd.y1 = orig.y1 + dy;
    }
  }

  node.attrs.d = serializeD(cmds);
  emitDoc();
}

function getSelectedPath() {
  if (!editor.selectedId) return null;
  const node = findById(doc.root, editor.selectedId);
  return node?.tag === 'path' ? node : null;
}
