// Unified canvas pointer event handler.
// Dispatches to the active mode handler.
// Handles pan/zoom viewport navigation (always available).

import { editor, emitViewport } from '../model/state.js';

const MIN_ZOOM = 0.01;
const MAX_ZOOM = 100;
const PAN_BTN = 1;          // middle mouse button for pan
const LONG_PRESS_MS = 500;  // ms to trigger long-press

let _canvas = null;
let _handlers = {};         // mode → { onDown, onMove, onUp, onContextMenu }

// Active pointer tracking
let _activePtr = null;   // { pointerId, startX, startY, x, y, dragging }
let _secondPtr = null;   // for pinch-zoom
let _longPressTimer = null;
let _panning = false;
let _panStart = null;    // { x, y, vpX, vpY }

export function init(canvas, modeHandlers) {
  _canvas = canvas;
  _handlers = modeHandlers;

  canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
  canvas.addEventListener('pointermove', onPointerMove, { passive: false });
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);
}

export function setModeHandlers(modeHandlers) {
  _handlers = modeHandlers;
}

// --- Coordinate conversion ---

/** Convert screen coordinates to document coordinates. */
export function screenToDoc(screenX, screenY) {
  const rect = _canvas.getBoundingClientRect();
  const relX = screenX - rect.left;
  const relY = screenY - rect.top;
  return {
    x: editor.viewport.x + relX / editor.viewport.zoom,
    y: editor.viewport.y + relY / editor.viewport.zoom,
  };
}

/** Apply the current viewport transform to the canvas SVG's viewBox. */
export function applyViewport() {
  if (!_canvas) return;
  const { x, y, zoom } = editor.viewport;
  const cw = _canvas.clientWidth;
  const ch = _canvas.clientHeight;
  if (!cw || !ch) return;
  _canvas.setAttribute('viewBox', `${x} ${y} ${cw / zoom} ${ch / zoom}`);
}

// --- Event handlers ---

function onPointerDown(e) {
  e.preventDefault();

  // Middle button or space+drag → pan
  if (e.button === PAN_BTN || e.button === 0 && e.altKey) {
    startPan(e);
    return;
  }

  // Two-pointer pinch: track second pointer
  if (_activePtr && e.pointerId !== _activePtr.pointerId) {
    _secondPtr = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
    _canvas.setPointerCapture(e.pointerId);
    clearLongPress();
    return;
  }

  _activePtr = {
    pointerId: e.pointerId,
    startX: e.clientX, startY: e.clientY,
    x: e.clientX, y: e.clientY,
    dragging: false,
    button: e.button,
  };
  _canvas.setPointerCapture(e.pointerId);

  startLongPress(e);

  const handler = _handlers[editor.mode];
  handler?.onDown?.(e, screenToDoc(e.clientX, e.clientY));
}

function onPointerMove(e) {
  e.preventDefault();

  // Pinch-zoom with two pointers
  if (_secondPtr && _activePtr) {
    if (e.pointerId === _activePtr.pointerId || e.pointerId === _secondPtr.pointerId) {
      const prev1 = e.pointerId === _activePtr.pointerId
        ? { x: _activePtr.x, y: _activePtr.y }
        : { x: _activePtr.x, y: _activePtr.y };
      const prev2 = { x: _secondPtr.x, y: _secondPtr.y };

      if (e.pointerId === _activePtr.pointerId) {
        _activePtr.x = e.clientX; _activePtr.y = e.clientY;
      } else {
        _secondPtr.x = e.clientX; _secondPtr.y = e.clientY;
      }

      const cur1 = { x: _activePtr.x, y: _activePtr.y };
      const cur2 = { x: _secondPtr.x, y: _secondPtr.y };

      const prevDist = Math.hypot(prev2.x - prev1.x, prev2.y - prev1.y);
      const curDist = Math.hypot(cur2.x - cur1.x, cur2.y - cur1.y);
      if (prevDist > 0) {
        const factor = curDist / prevDist;
        const midX = (cur1.x + cur2.x) / 2;
        const midY = (cur1.y + cur2.y) / 2;
        zoomAt(midX, midY, factor);
      }
    }
    return;
  }

  if (!_activePtr || e.pointerId !== _activePtr.pointerId) {
    const docPos = screenToDoc(e.clientX, e.clientY);
    updateCoordsDisplay(docPos.x, docPos.y);
    return;
  }

  const dx = e.clientX - _activePtr.x;
  const dy = e.clientY - _activePtr.y;
  _activePtr.x = e.clientX;
  _activePtr.y = e.clientY;

  const totalDX = e.clientX - _activePtr.startX;
  const totalDY = e.clientY - _activePtr.startY;
  if (!_activePtr.dragging && Math.hypot(totalDX, totalDY) > 3) {
    _activePtr.dragging = true;
    clearLongPress();
  }

  if (_panning) {
    const zoom = editor.viewport.zoom;
    editor.viewport.x = _panStart.vpX - totalDX / zoom;
    editor.viewport.y = _panStart.vpY - totalDY / zoom;
    emitViewport();
    return;
  }

  const docPos = screenToDoc(e.clientX, e.clientY);
  updateCoordsDisplay(docPos.x, docPos.y);

  const handler = _handlers[editor.mode];
  handler?.onMove?.(e, docPos, { dx: dx / editor.viewport.zoom, dy: dy / editor.viewport.zoom });
}

function onPointerUp(e) {
  clearLongPress();

  if (_secondPtr && (e.pointerId === _secondPtr.pointerId)) {
    _secondPtr = null;
    return;
  }

  if (!_activePtr || e.pointerId !== _activePtr.pointerId) return;

  const wasDragging = _activePtr.dragging;
  _activePtr = null;
  _panning = false;

  if (wasDragging) {
    const handler = _handlers[editor.mode];
    handler?.onDragEnd?.(e, screenToDoc(e.clientX, e.clientY));
  } else {
    const handler = _handlers[editor.mode];
    handler?.onUp?.(e, screenToDoc(e.clientX, e.clientY));
  }
}

function onContextMenu(e) {
  e.preventDefault();
  const handler = _handlers[editor.mode];
  handler?.onContextMenu?.(e, screenToDoc(e.clientX, e.clientY));
}

function onWheel(e) {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  zoomAt(e.clientX, e.clientY, factor);
}

// --- Pan & zoom ---

function startPan(e) {
  _panning = true;
  _panStart = {
    x: e.clientX, y: e.clientY,
    vpX: editor.viewport.x, vpY: editor.viewport.y,
  };
  _activePtr = {
    pointerId: e.pointerId,
    startX: e.clientX, startY: e.clientY,
    x: e.clientX, y: e.clientY,
    dragging: false,
  };
  _canvas.setPointerCapture(e.pointerId);
}

function zoomAt(screenX, screenY, factor) {
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, editor.viewport.zoom * factor));
  if (newZoom === editor.viewport.zoom) return;

  const rect = _canvas.getBoundingClientRect();
  const relX = screenX - rect.left;
  const relY = screenY - rect.top;

  // Keep the doc point under the cursor fixed
  const docX = editor.viewport.x + relX / editor.viewport.zoom;
  const docY = editor.viewport.y + relY / editor.viewport.zoom;

  editor.viewport.zoom = newZoom;
  editor.viewport.x = docX - relX / newZoom;
  editor.viewport.y = docY - relY / newZoom;
  emitViewport();
}

// --- Long press ---

function startLongPress(e) {
  clearLongPress();
  _longPressTimer = setTimeout(() => {
    _longPressTimer = null;
    const handler = _handlers[editor.mode];
    handler?.onLongPress?.(e, screenToDoc(e.clientX, e.clientY));
  }, LONG_PRESS_MS);
}

function clearLongPress() {
  if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
}

// --- Coords display ---

function updateCoordsDisplay(x, y) {
  const coordsEl = document.getElementById('coords');
  if (coordsEl) coordsEl.textContent = `${x.toFixed(1)}, ${y.toFixed(1)}`;
}
