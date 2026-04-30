// Canvas overlay — draws selection boxes, path handles, draw preview.
// Reads from the custom element tree, writes nothing.

import { editor } from '../state.js';
import { SvgCmd, SvgPathElement } from '../elements/registry.js';
import { computePositions } from '../path-utils.js';
import { screenToDoc } from './canvas.js';

const ANCHOR_R   = 5;
const HANDLE_R   = 3.5;
const SEL_PAD    = 4;

let _canvas  = null;
let _ctx     = null;
let _preview = null;   // { x, y } in doc space — draw mode cursor

export function init(canvas) {
  _canvas = canvas;
  _ctx    = canvas.getContext('2d');
}

export function setPreview(docPos) {
  _preview = docPos;
}

export function clearPreview() {
  _preview = null;
}

export function render() {
  if (!_ctx || !_canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = _canvas.offsetWidth;
  const h = _canvas.offsetHeight;
  if (_canvas.width !== w * dpr || _canvas.height !== h * dpr) {
    _canvas.width  = w * dpr;
    _canvas.height = h * dpr;
    _ctx.scale(dpr, dpr);
  }
  _ctx.clearRect(0, 0, w, h);

  const z    = editor.viewport.zoom;
  const { x: vx, y: vy } = editor.viewport;

  // Convert doc coords to canvas pixel coords
  const toScreen = (dx, dy) => ({
    x: (dx - vx) * z,
    y: (dy - vy) * z,
  });

  _renderDocBorder(toScreen, z);
  _renderSelection(toScreen, z);
  _renderPathHandles(toScreen, z);
  _renderDrawPreview(toScreen, z);
}

// --- Stored anchor hit data for select.js hit testing ---

export const anchors = []; // { x, y, cmdEl, cpIdx } in screen coords — refreshed each render

function _renderDocBorder(toScreen, z) {
  const docEl = document.querySelector('svg-document');
  if (!docEl) return;
  const vb = docEl.getAttribute('viewBox');
  if (!vb) return;
  const p = vb.trim().split(/[\s,]+/).map(Number);
  if (p.length !== 4) return;
  const a = toScreen(p[0], p[1]);
  const b = toScreen(p[0]+p[2], p[1]+p[3]);
  _ctx.save();
  _ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  _ctx.lineWidth   = 1;
  _ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  _ctx.restore();
}

function _renderSelection(toScreen, z) {
  const el = editor.selectedEl;
  if (!el || el instanceof SvgCmd) return;
  if (el instanceof SvgPathElement) return; // handles are the indicator
  const svgNode = el.svgNode;
  if (!svgNode || typeof svgNode.getBBox !== 'function') return;
  try {
    const bb = svgNode.getBBox();
    if (!bb.width && !bb.height) return;
    const pad = SEL_PAD / z;
    const a = toScreen(bb.x - pad, bb.y - pad);
    const b = toScreen(bb.x + bb.width + pad, bb.y + bb.height + pad);
    _ctx.save();
    _ctx.strokeStyle = '#4a90e2';
    _ctx.lineWidth   = 1.5;
    _ctx.setLineDash([4, 3]);
    _ctx.fillStyle   = 'rgba(74,144,226,0.06)';
    _ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    _ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    _ctx.restore();
  } catch { /* ignore */ }
}

function _renderPathHandles(toScreen, z) {
  anchors.length = 0;

  const sel = editor.selectedEl;
  let pathEl = null;
  if (sel instanceof SvgPathElement) pathEl = sel;
  else if (sel instanceof SvgCmd) pathEl = sel.parentElement instanceof SvgPathElement ? sel.parentElement : null;
  if (!pathEl) return;

  const cmds = pathEl.cmdElements().map(c => c.toCommand());
  if (!cmds.length) return;
  const positions = computePositions(cmds);
  const cmdEls    = pathEl.cmdElements();

  // Handle lines
  positions.forEach(({ absX, absY, controls }) => {
    controls.forEach(cp => {
      const a = toScreen(absX, absY);
      const b = toScreen(cp.x, cp.y);
      _ctx.save();
      _ctx.strokeStyle = '#888';
      _ctx.lineWidth   = 1;
      _ctx.setLineDash([3/z * z, 2/z * z]);
      _ctx.beginPath(); _ctx.moveTo(a.x, a.y); _ctx.lineTo(b.x, b.y); _ctx.stroke();
      _ctx.restore();
    });
  });

  // Control handles
  positions.forEach(({ controls }, i) => {
    controls.forEach((cp, ci) => {
      const s = toScreen(cp.x, cp.y);
      const r = HANDLE_R;
      _ctx.save();
      _ctx.fillStyle   = '#4a90e2';
      _ctx.strokeStyle = '#fff';
      _ctx.lineWidth   = 1;
      _ctx.beginPath(); _ctx.arc(s.x, s.y, r, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
      _ctx.restore();
      anchors.push({ x: s.x, y: s.y, cmdEl: cmdEls[i], cpIdx: ci, isHandle: true });
    });
  });

  // Anchor dots
  positions.forEach(({ absX, absY }, i) => {
    const cmd = cmds[i];
    if (cmd.letter.toUpperCase() === 'Z') return;
    const s   = toScreen(absX, absY);
    const isSel = sel instanceof SvgCmd && sel === cmdEls[i];
    const r   = ANCHOR_R;
    _ctx.save();
    _ctx.fillStyle   = isSel ? '#ff6b35' : '#fff';
    _ctx.strokeStyle = isSel ? '#ff6b35' : '#4a90e2';
    _ctx.lineWidth   = 1.5;
    _ctx.beginPath(); _ctx.arc(s.x, s.y, r, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
    _ctx.restore();
    anchors.push({ x: s.x, y: s.y, cmdEl: cmdEls[i], cpIdx: -1, isHandle: false });
  });
}

function _renderDrawPreview(toScreen, z) {
  if (editor.mode !== 'draw' || !_preview) return;
  const sel = editor.selectedEl;
  let pathEl = null;
  if (sel instanceof SvgPathElement) pathEl = sel;
  else if (sel instanceof SvgCmd) pathEl = sel.parentElement instanceof SvgPathElement ? sel.parentElement : null;
  if (!pathEl) return;

  const cmds = pathEl.cmdElements().map(c => c.toCommand());
  if (!cmds.length) return;
  const positions = computePositions(cmds);
  const last = positions.at(-1);
  const a = toScreen(last.absX, last.absY);
  const b = toScreen(_preview.x, _preview.y);

  _ctx.save();
  _ctx.strokeStyle = '#4a90e2';
  _ctx.lineWidth   = 1;
  _ctx.setLineDash([4/z * z, 3/z * z]);
  _ctx.beginPath(); _ctx.moveTo(a.x, a.y); _ctx.lineTo(b.x, b.y); _ctx.stroke();
  _ctx.restore();
}

export function hitAnchor(sx, sy, radius = 8) {
  for (const a of anchors) {
    if (Math.hypot(sx - a.x, sy - a.y) <= radius) return a;
  }
  return null;
}
