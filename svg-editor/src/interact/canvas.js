// Canvas — pointer event dispatch and viewport pan/zoom.
// Translates raw pointer events into doc-space coordinates and forwards them
// to the active mode handler.

import { editor, emitViewport } from '../state.js';
import { getSvgDocument } from '../elements/registry.js';

let _canvas = null;
let _handler = null;        // current mode handler
let _modeHandlers = {};

let _pointerId    = null;
let _pointerStart = null;   // { x, y } in screen coords
let _lastScreen   = null;
let _dragging     = false;
const DRAG_THRESHOLD = 4;

export function init(canvas, handlers) {
  _canvas = canvas;
  _modeHandlers = handlers;

  canvas.addEventListener('pointerdown',  onDown);
  canvas.addEventListener('pointermove',  onMove);
  canvas.addEventListener('pointerup',    onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('contextmenu',  onContext);
  canvas.addEventListener('wheel',        onWheel, { passive: false });

  canvas.addEventListener('lostpointercapture', () => {
    if (_pointerId !== null) {
      _handler?.onDragEnd?.({}, _lastDocPos());
      _pointerId = null; _dragging = false;
    }
  });
}

export function setHandler(handler) {
  _handler = handler;
}

function onDown(e) {
  if (_pointerId !== null) return;
  _pointerId    = e.pointerId;
  _pointerStart = { x: e.clientX, y: e.clientY };
  _lastScreen   = { x: e.clientX, y: e.clientY };
  _dragging     = false;
  _canvas.setPointerCapture(e.pointerId);
  _handler?.onDown?.(e, screenToDoc(e.clientX, e.clientY));
}

function onMove(e) {
  if (e.pointerId !== _pointerId) return;
  const dx = e.clientX - _lastScreen.x;
  const dy = e.clientY - _lastScreen.y;
  const docPos = screenToDoc(e.clientX, e.clientY);

  if (!_dragging) {
    const totalDx = e.clientX - _pointerStart.x;
    const totalDy = e.clientY - _pointerStart.y;
    if (Math.hypot(totalDx, totalDy) > DRAG_THRESHOLD) _dragging = true;
  }

  _lastScreen = { x: e.clientX, y: e.clientY };
  _handler?.onMove?.(e, docPos, { dx: dx / editor.viewport.zoom, dy: dy / editor.viewport.zoom });
}

function onUp(e) {
  if (e.pointerId !== _pointerId) return;
  _pointerId = null;
  const docPos = screenToDoc(e.clientX, e.clientY);
  if (_dragging) {
    _handler?.onDragEnd?.(e, docPos);
  } else {
    _handler?.onUp?.(e, docPos);
  }
  _dragging = false;
}

function onContext(e) {
  e.preventDefault();
  _handler?.onContextMenu?.(e, screenToDoc(e.clientX, e.clientY));
}

function onWheel(e) {
  e.preventDefault();
  const { viewport } = editor;
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  const rect   = _canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  // Zoom toward cursor
  viewport.x += mx / viewport.zoom * (1 - 1/factor);
  viewport.y += my / viewport.zoom * (1 - 1/factor);
  viewport.zoom *= factor;
  emitViewport();
}

export function screenToDoc(sx, sy) {
  const rect = _canvas.getBoundingClientRect();
  const { x, y, zoom } = editor.viewport;
  return {
    x: x + (sx - rect.left)  / zoom,
    y: y + (sy - rect.top) / zoom,
  };
}

export function applyViewport() {
  const docEl = getSvgDocument();
  if (!docEl?.svgRoot) return;
  const { x, y, zoom } = editor.viewport;
  const w = docEl.svgRoot.clientWidth  || docEl.svgRoot.getBoundingClientRect().width;
  const h = docEl.svgRoot.clientHeight || docEl.svgRoot.getBoundingClientRect().height;
  if (!w || !h) return;
  docEl.svgRoot.setAttribute('viewBox', `${x} ${y} ${w/zoom} ${h/zoom}`);
}

export function fitView() {
  const docEl = getSvgDocument();
  if (!docEl?.svgNode) return;
  let bbox = null;
  try { bbox = docEl.svgNode.getBBox(); } catch { /* ignore */ }
  if (!bbox || (!bbox.width && !bbox.height)) {
    const vb = docEl.getAttribute('viewBox');
    if (vb) {
      const p = vb.trim().split(/[\s,]+/).map(Number);
      if (p.length === 4 && p[2] && p[3]) bbox = { x: p[0], y: p[1], width: p[2], height: p[3] };
    }
  }
  if (!bbox?.width || !bbox?.height) return;
  const docEl2 = docEl.svgRoot;
  const cw = docEl2.clientWidth  || docEl2.getBoundingClientRect().width;
  const ch = docEl2.clientHeight || docEl2.getBoundingClientRect().height;
  if (!cw || !ch) return;
  const zoom = Math.min(cw / bbox.width, ch / bbox.height) * 0.88;
  editor.viewport.x    = bbox.x - (cw/zoom - bbox.width)  / 2;
  editor.viewport.y    = bbox.y - (ch/zoom - bbox.height) / 2;
  editor.viewport.zoom = zoom;
  emitViewport();
}

function _lastDocPos() {
  if (!_lastScreen) return { x: 0, y: 0 };
  return screenToDoc(_lastScreen.x, _lastScreen.y);
}
