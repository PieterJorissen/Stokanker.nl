// Canvas overlay — selection, drag, pan/zoom. Owns no document data.

import { state, notify } from './state.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

let canvas, ctx, svgRoot, docGroup;
let _drag = null;  // { el, startDocX, startDocY, origTranslate: {x,y} }
let _pan  = null;  // { startX, startY, origVp: {x,y,zoom} }

export function init() {
  canvas   = document.getElementById('overlay');
  ctx      = canvas.getContext('2d');
  svgRoot  = document.getElementById('svg-root');
  docGroup = document.getElementById('doc');

  resizeCanvas();
  new ResizeObserver(resizeCanvas).observe(canvas.parentElement);

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup',   onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
}

// ---------------------------------------------------------------------------
// Viewport helpers
// ---------------------------------------------------------------------------
function applyViewport() {
  const { x, y, zoom } = state.viewport;
  const w = canvas.width  / devicePixelRatio;
  const h = canvas.height / devicePixelRatio;
  svgRoot.setAttribute('viewBox', `${x} ${y} ${w / zoom} ${h / zoom}`);
}

export function fitView() {
  try {
    const bb = docGroup.getBBox();
    if (!bb.width || !bb.height) return;
    const w = canvas.width  / devicePixelRatio;
    const h = canvas.height / devicePixelRatio;
    const pad = 0.12;
    const zoom = Math.min(w, h) / Math.max(bb.width, bb.height) * (1 - pad * 2);
    const cx = bb.x + bb.width  / 2;
    const cy = bb.y + bb.height / 2;
    state.viewport = { x: cx - w / zoom / 2, y: cy - h / zoom / 2, zoom };
    applyViewport();
    renderOverlay();
  } catch (_) {}
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = canvas.parentElement.getBoundingClientRect();
  canvas.width  = width  * dpr;
  canvas.height = height * dpr;
  canvas.style.width  = width  + 'px';
  canvas.style.height = height + 'px';
  ctx.scale(dpr, dpr);
  applyViewport();
  renderOverlay();
}

// Convert canvas CSS coords → document coords
function toDoc(cx, cy) {
  const { x, y, zoom } = state.viewport;
  return { x: x + cx / zoom, y: y + cy / zoom };
}

// ---------------------------------------------------------------------------
// Overlay rendering (selection box)
// ---------------------------------------------------------------------------
export function renderOverlay() {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width  / dpr;
  const H = canvas.height / dpr;
  ctx.clearRect(0, 0, W, H);

  if (!state.selected) return;

  const svgEl = state.selected._el;
  if (!svgEl) return;

  try {
    const bb = svgEl.getBBox();
    const { x: vx, y: vy, zoom } = state.viewport;
    const pad = 4;
    const sx = (bb.x - vx) * zoom - pad;
    const sy = (bb.y - vy) * zoom - pad;
    const sw = bb.width  * zoom + pad * 2;
    const sh = bb.height * zoom + pad * 2;

    ctx.save();
    ctx.strokeStyle = '#4af';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.restore();
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// Hit testing
// ---------------------------------------------------------------------------
function hitTest(cx, cy) {
  canvas.style.pointerEvents = 'none';
  const el = document.elementFromPoint(cx + canvas.getBoundingClientRect().left, cy + canvas.getBoundingClientRect().top);
  canvas.style.pointerEvents = '';
  if (!el) return null;
  let cur = el;
  while (cur) {
    if (cur._model) return cur._model;
    cur = cur.parentElement;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pointer events
// ---------------------------------------------------------------------------
function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return { cx: e.clientX - r.left, cy: e.clientY - r.top };
}

function getTranslate(el) {
  const t = el.getAttribute('transform') || '';
  const m = t.match(/translate\(\s*([\d.e+-]+)[,\s]+([\d.e+-]+)\s*\)/);
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
}

function onDown(e) {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  const { cx, cy } = canvasPos(e);

  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    _pan = { startX: cx, startY: cy, origVp: { ...state.viewport } };
    return;
  }

  if (e.button === 0) {
    const hit = hitTest(cx, cy);

    // Deselect on background click
    if (!hit || hit.localName === 'svg-document') {
      if (state.selected !== null) {
        state.selected = null;
        notify();
        renderOverlay();
      }
      _pan = { startX: cx, startY: cy, origVp: { ...state.viewport } };
      return;
    }

    state.selected = hit;
    notify();
    renderOverlay();

    const doc = toDoc(cx, cy);
    const orig = getTranslate(hit);
    _drag = { el: hit, startDocX: doc.x, startDocY: doc.y, origTranslate: orig };
  }
}

function onMove(e) {
  const { cx, cy } = canvasPos(e);

  if (_pan) {
    const dx = (cx - _pan.startX) / state.viewport.zoom;
    const dy = (cy - _pan.startY) / state.viewport.zoom;
    state.viewport = {
      ..._pan.origVp,
      x: _pan.origVp.x - dx,
      y: _pan.origVp.y - dy,
    };
    applyViewport();
    renderOverlay();
    return;
  }

  if (_drag) {
    const doc = toDoc(cx, cy);
    const dx = doc.x - _drag.startDocX;
    const dy = doc.y - _drag.startDocY;
    const nx = _drag.origTranslate.x + dx;
    const ny = _drag.origTranslate.y + dy;
    _drag.el.setAttribute('transform', `translate(${nx} ${ny})`);
    renderOverlay();
  }
}

function onUp(e) {
  _drag = null;
  _pan  = null;
  canvas.releasePointerCapture(e.pointerId);
}

function onWheel(e) {
  e.preventDefault();
  const { cx, cy } = canvasPos(e);
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  const { x, y, zoom } = state.viewport;
  const docX = x + cx / zoom;
  const docY = y + cy / zoom;
  const newZoom = Math.max(0.05, Math.min(200, zoom * factor));
  state.viewport = {
    x: docX - cx / newZoom,
    y: docY - cy / newZoom,
    zoom: newZoom,
  };
  applyViewport();
  renderOverlay();
}
