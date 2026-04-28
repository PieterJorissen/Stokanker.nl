// Path-edit mode — drag anchor points and control handles to edit path commands.
// Operates entirely through named path command props; never stores extra geometry state.

import { doc, editor, emit, emitDoc } from '../model/state.js';
import { findById } from '../model/node.js';
import { parseD, serializeD } from '../model/path.js';

let _dragging = null;
// _dragging = {
//   type: 'anchor' | 'handle',
//   cmdIdx: number,
//   cpIdx: number (handles only),
//   cmds: PathCommand[],
//   node: SvgNode,
//   startDocX: number,
//   startDocY: number,
//   startProps: { ...cmd } (snapshot of named props),
// }

export const handler = {
  onDown(e, docPos) {
    if (e.button !== 0) return;

    const target = e.target;
    const cmdIdx = target.dataset.cmd !== undefined ? parseInt(target.dataset.cmd) : null;
    const cpIdx  = target.dataset.cp  !== undefined ? parseInt(target.dataset.cp)  : null;

    if (cmdIdx === null) {
      editor.selectedCmdIdx = null;
      emit('select');
      return;
    }

    const node = getSelectedPath();
    if (!node) return;

    const cmds = parseD(node.attrs.d || '');
    if (cmdIdx >= cmds.length) return;

    const isHandle = target.classList.contains('handle');
    const isAnchor = target.classList.contains('anchor');

    if (!isHandle && !isAnchor) return;

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
  },

  onMove(e, docPos) {
    if (!_dragging) return;

    const { type, cmdIdx, cpIdx, cmds, node } = _dragging;
    const cmd = cmds[cmdIdx];
    const L = cmd.letter.toUpperCase();
    const dx = docPos.x - _dragging.startDocX;
    const dy = docPos.y - _dragging.startDocY;
    const orig = _dragging.startProps;

    if (type === 'anchor') {
      if (L === 'M' || L === 'L' || L === 'T') {
        cmd.x = orig.x + dx;
        cmd.y = orig.y + dy;
      } else if (L === 'H') {
        cmd.x = orig.x + dx;
      } else if (L === 'V') {
        cmd.y = orig.y + dy;
      } else if (L === 'C' || L === 'S' || L === 'Q' || L === 'A') {
        cmd.x = orig.x + dx;
        cmd.y = orig.y + dy;
      }
    } else {
      // Move a control point
      if (L === 'C') {
        if (cpIdx === 0) {
          cmd.x1 = orig.x1 + dx;
          cmd.y1 = orig.y1 + dy;
        } else {
          cmd.x2 = orig.x2 + dx;
          cmd.y2 = orig.y2 + dy;
        }
      } else if (L === 'S') {
        cmd.x2 = orig.x2 + dx;
        cmd.y2 = orig.y2 + dy;
      } else if (L === 'Q') {
        cmd.x1 = orig.x1 + dx;
        cmd.y1 = orig.y1 + dy;
      }
    }

    node.attrs.d = serializeD(cmds);
    emitDoc();
  },

  onDragEnd() {
    _dragging = null;
  },

  onUp() {
    _dragging = null;
  },

  onContextMenu() {
    editor.mode = 'select';
    emit('mode');
  },
};

function getSelectedPath() {
  if (!editor.selectedId) return null;
  const node = findById(doc.root, editor.selectedId);
  return node?.tag === 'path' ? node : null;
}
