// Select mode — click to select SVG elements, left-drag on background to pan.
// No hover dependency. Works with pointer events only.

import { editor, emit, emitViewport } from '../model/state.js';
import { idForEl, isDocElement } from '../render/svg.js';

let _panningBg = false;

export const handler = {
  onDown(e, docPos) {
    _panningBg = false;
    if (e.button === 0 && !isDocElement(e.target)) {
      _panningBg = true;
    }
  },

  onMove(e, docPos, delta) {
    if (_panningBg) {
      editor.viewport.x -= delta.dx;
      editor.viewport.y -= delta.dy;
      emitViewport();
    }
  },

  onDragEnd(e, docPos) {
    _panningBg = false;
  },

  onUp(e, docPos) {
    _panningBg = false;
    if (e.button !== 0) return;

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

    editor.selectedId = null;
    editor.selectedCmdIdx = null;
    emit('select');
  },

  onContextMenu(e, docPos) {
    editor.selectedId = null;
    editor.selectedCmdIdx = null;
    emit('select');
  },
};
