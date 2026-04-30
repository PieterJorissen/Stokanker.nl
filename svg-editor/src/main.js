import './elements/registry.js'; // registers all custom elements

import { editor, on, emitMode } from './state.js';
import { getSvgDocument } from './elements/registry.js';
import { init as initCanvas, setHandler, applyViewport, fitView } from './interact/canvas.js';
import { init as initOverlay, render as renderOverlay, clearPreview } from './interact/overlay.js';
import { handler as selectHandler } from './interact/select.js';
import { handler as drawHandler } from './interact/draw.js';
import { init as initTree, render as renderTree, scrollToSelected } from './ui/tree.js';
import { init as initAttrs, render as renderAttrs } from './ui/attrs.js';
import { init as initToolbar, syncModeButtons, loadSVG } from './ui/toolbar.js';

function boot() {
  const canvas   = document.getElementById('overlay');
  const treeRoot = document.getElementById('tree-root');

  initCanvas(canvas, {});
  initOverlay(canvas);
  initTree(treeRoot);
  initAttrs({
    list:     document.getElementById('attr-list'),
    tagLabel: document.getElementById('attr-node-tag'),
    newName:  document.getElementById('attr-new-name'),
    newVal:   document.getElementById('attr-new-val'),
    addBtn:   document.getElementById('btn-add-attr'),
  });
  initToolbar();

  const handlers = { select: selectHandler, draw: drawHandler };

  on('mode', () => {
    syncModeButtons();
    setHandler(handlers[editor.mode]);
    document.body.dataset.mode = editor.mode;
    document.getElementById('draw-hint').hidden = editor.mode !== 'draw';
    if (editor.mode !== 'draw') clearPreview();
    renderOverlay();
  });

  on('select', () => {
    renderTree();
    scrollToSelected();
    renderAttrs();
    renderOverlay();
  });

  on('doc', () => {
    renderTree();
    renderAttrs();
    renderOverlay();
  });

  on('viewport', () => {
    applyViewport();
    renderOverlay();
  });

  on('overlay', () => renderOverlay());

  on('underlay', () => {
    const docEl = getSvgDocument();
    let img = docEl?.svgRoot?.querySelector('#underlay-img');
    if (!img && docEl?.svgRoot) {
      img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      img.id = 'underlay-img';
      img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      img.style.pointerEvents = 'none';
      docEl.svgRoot.insertBefore(img, docEl.svgRoot.firstChild);
    }
    if (!img) return;
    if (!editor.underlay?.dataUrl) {
      img.removeAttribute('href'); img.style.display = 'none'; return;
    }
    img.setAttribute('href', editor.underlay.dataUrl);
    img.setAttribute('opacity', editor.underlay.opacity ?? 0.4);
    const vb = docEl?.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
    if (vb?.length === 4) {
      img.setAttribute('x', vb[0]); img.setAttribute('y', vb[1]);
      img.setAttribute('width', vb[2]); img.setAttribute('height', vb[3]);
    }
    img.style.display = '';
  });

  loadSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"></svg>`);

  editor.mode = 'select';
  emitMode();

  requestAnimationFrame(() => requestAnimationFrame(fitView));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
