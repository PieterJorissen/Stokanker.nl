// Bootstrap — wires all modules together via the event bus.

import { state, on, emitDoc, emitMode } from './model/state.js';
import { defaultDocument } from './model/node.js';

import * as SvgRender from './render/svg.js';
import * as Overlay from './render/overlay.js';

import * as Tree from './ui/tree.js';
import * as Attrs from './ui/attrs.js';
import * as Toolbar from './ui/toolbar.js';

import { init as initCanvas, applyViewport } from './interact/canvas.js';
import { handler as selectHandler } from './interact/select.js';
import { handler as pathEditHandler } from './interact/path-edit.js';
import { handler as drawHandler, startDraw, cancelDraw } from './interact/draw.js';

// --- Init ---

function init() {
  const canvas     = document.getElementById('canvas');
  const docGroup   = document.getElementById('doc');
  const overlayGrp = document.getElementById('overlay');
  const selBox     = document.getElementById('sel-box');
  const pathHandles = document.getElementById('path-handles');
  const treeRoot   = document.getElementById('tree-root');
  const underlayImg = document.getElementById('underlay-img');

  // Init render modules
  SvgRender.init(docGroup);
  Overlay.init(overlayGrp, selBox, pathHandles);

  // Init UI modules
  Tree.init(treeRoot);
  Attrs.init({
    attrList:     document.getElementById('attr-list'),
    tagLabel:     document.getElementById('attr-node-tag'),
    newNameInput: document.getElementById('attr-new-name'),
    newValInput:  document.getElementById('attr-new-val'),
    addAttrBtn:   document.getElementById('btn-add-attr'),
    cmdAddRow:    document.getElementById('cmd-add-row'),
    newCmdType:   document.getElementById('new-cmd-type'),
    addCmdBtn:    document.getElementById('btn-add-cmd'),
  });
  Toolbar.init();

  // Init canvas interaction
  const modeHandlers = {
    'select':    selectHandler,
    'path-edit': pathEditHandler,
    'draw':      drawHandler,
  };
  initCanvas(canvas, modeHandlers);

  // Underlay img rendering
  on('underlay', () => renderUnderlay(underlayImg));

  // Wire event bus → render pipeline
  on('doc', () => {
    SvgRender.renderDocument(state.root);
    Overlay.renderOverlay();
    Tree.renderTree();
    Attrs.renderAttrs();
    applyViewport();
  });

  on('select', () => {
    Overlay.renderOverlay();
    Tree.renderTree();
    Tree.scrollToSelected();
    Attrs.renderAttrs();
    // Auto-enable path-edit mode when a path is selected and user switches
    // (no auto-switch — user controls mode explicitly)
  });

  on('mode', () => {
    Toolbar.syncModeButtons();
    Overlay.renderOverlay();
    Attrs.renderAttrs();
    document.body.dataset.mode = state.mode;
    if (state.mode === 'draw') startDraw();
    document.getElementById('draw-hint').hidden = state.mode !== 'draw';
  });

  on('viewport', () => {
    applyViewport();
    Overlay.renderOverlay();
  });

  // Lightweight overlay-only redraw (e.g. draw mode preview line)
  on('overlay', () => Overlay.renderOverlay());

  on('draw-cancel', () => {
    cancelDraw();
  });

  // Initial render
  state.root = defaultDocument();
  emitDoc();
  emitMode();

  // Fit view after first render (DOM needs to be ready)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      Toolbar.onFitView();
    });
  });
}

function renderUnderlay(img) {
  if (!state.underlay?.dataUrl) {
    img.removeAttribute('href');
    img.style.display = 'none';
    return;
  }
  img.setAttribute('href', state.underlay.dataUrl);
  img.setAttribute('opacity', state.underlay.opacity ?? 0.4);

  // Size underlay to document viewBox
  const vb = state.root?.attrs?.viewBox?.trim().split(/[\s,]+/).map(Number);
  if (vb?.length === 4) {
    img.setAttribute('x', vb[0]);
    img.setAttribute('y', vb[1]);
    img.setAttribute('width', vb[2]);
    img.setAttribute('height', vb[3]);
  }
  img.style.display = '';
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
