// Path-edit mode — drag anchor points and control handles to edit path commands.
// Operates entirely through path command args; never stores extra geometry state.

import { state, emit, emitDoc } from '../model/state.js';
import { findById } from '../model/node.js';
import { parseD, serializeD, computePositions } from '../model/path.js';

let _dragging = null;
// _dragging = {
//   type: 'anchor' | 'handle',
//   cmdIdx: number,
//   cpIdx: number (handles only),
//   letter: string,
//   startArgs: number[],
//   startDocX: number,
//   startDocY: number,
// }

export const handler = {
  onDown(e, docPos) {
    if (e.button !== 0) return;

    const target = e.target;
    const cmdIdx = target.dataset.cmd !== undefined ? parseInt(target.dataset.cmd) : null;
    const cpIdx  = target.dataset.cp  !== undefined ? parseInt(target.dataset.cp)  : null;

    if (cmdIdx === null) {
      // Click on empty canvas area in path-edit mode: deselect command
      state.selectedCmdIdx = null;
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

    state.selectedCmdIdx = cmdIdx;
    emit('select');

    _dragging = {
      type: isHandle ? 'handle' : 'anchor',
      cmdIdx,
      cpIdx: cpIdx ?? 0,
      cmds,
      node,
      startDocX: docPos.x,
      startDocY: docPos.y,
      startArgs: [...cmds[cmdIdx].args],
    };
  },

  onMove(e, docPos, delta) {
    if (!_dragging) return;

    const { type, cmdIdx, cpIdx, cmds, node } = _dragging;
    const cmd = cmds[cmdIdx];
    const L = cmd.letter.toUpperCase();
    const rel = cmd.letter !== L;

    const dx = docPos.x - _dragging.startDocX;
    const dy = docPos.y - _dragging.startDocY;
    const orig = _dragging.startArgs;

    if (type === 'anchor') {
      // Move the endpoint args
      if (L === 'M' || L === 'L' || L === 'T') {
        cmd.args[0] = orig[0] + dx;
        cmd.args[1] = orig[1] + dy;
      } else if (L === 'H') {
        cmd.args[0] = orig[0] + dx;
      } else if (L === 'V') {
        cmd.args[0] = orig[0] + dy;
      } else if (L === 'C') {
        cmd.args[4] = orig[4] + dx;
        cmd.args[5] = orig[5] + dy;
      } else if (L === 'S') {
        cmd.args[2] = orig[2] + dx;
        cmd.args[3] = orig[3] + dy;
      } else if (L === 'Q') {
        cmd.args[2] = orig[2] + dx;
        cmd.args[3] = orig[3] + dy;
      } else if (L === 'A') {
        cmd.args[5] = orig[5] + dx;
        cmd.args[6] = orig[6] + dy;
      }
    } else {
      // Move a control point
      if (L === 'C') {
        if (cpIdx === 0) {
          cmd.args[0] = orig[0] + dx;
          cmd.args[1] = orig[1] + dy;
        } else {
          cmd.args[2] = orig[2] + dx;
          cmd.args[3] = orig[3] + dy;
        }
      } else if (L === 'S' || L === 'Q') {
        cmd.args[0] = orig[0] + dx;
        cmd.args[1] = orig[1] + dy;
      }
    }

    node.attrs.d = serializeD(cmds);
    emitDoc();
  },

  onDragEnd(e, docPos) {
    _dragging = null;
  },

  onUp(e, docPos) {
    _dragging = null;
  },

  onContextMenu(e, docPos) {
    // Right-click in path-edit → switch back to select mode
    state.mode = 'select';
    emit('mode');
  },
};

function getSelectedPath() {
  if (!state.selectedId) return null;
  const node = findById(state.root, state.selectedId);
  return node?.tag === 'path' ? node : null;
}
