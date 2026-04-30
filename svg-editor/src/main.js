// Bootstrap — register model, wire modules, bind keyboard shortcuts.

import './model.js';
import { state, onChange, notify } from './state.js';
import { init as initCanvas, fitView, renderOverlay } from './canvas.js';
import { init as initTree, render as renderTree } from './tree.js';
import { initEditor, deleteSelected } from './editor.js';

document.addEventListener('DOMContentLoaded', () => {
  initCanvas();
  initTree();
  initEditor();

  // Re-render tree and overlay on any state change
  onChange(() => {
    renderTree();
    renderOverlay();
  });

  // Initial render
  renderTree();

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'f' || e.key === 'F') fitView();
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selected) {
      deleteSelected();
    }
    if (e.key === 'Escape') {
      state.selected = null;
      notify();
    }
  });

  document.getElementById('btn-fit').addEventListener('click', fitView);
});
