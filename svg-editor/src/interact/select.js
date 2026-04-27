// Select mode — click to select SVG elements, left-drag on background to pan.
// No hover dependency. Works with pointer events only.

import { state, emit, emitViewport } from '../model/state.js';
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
      // Drag right → viewport.x decreases (content moves right)
      state.viewport.x -= delta.dx;
      state.viewport.y -= delta.dy;
      emitViewport();
    }
  },

  onDragEnd(e, docPos) {
    _panningBg = false;
  },

  onUp(e, docPos) {
    _panningBg = false;
    if (e.button !== 0) return;

    // Hit test: find the topmost doc element under pointer
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && isDocElement(el)) {
      const id = idForEl(el);
      if (id !== null) {
        state.selectedId = id;
        state.selectedCmdIdx = null;
        emit('select');
        return;
      }
    }

    // Click on background → deselect
    state.selectedId = null;
    state.selectedCmdIdx = null;
    emit('select');
  },

  onContextMenu(e, docPos) {
    state.selectedId = null;
    state.selectedCmdIdx = null;
    emit('select');
  },
};
