import { editor, emitSelect, emitViewport } from '../state.js';
import { SvgCmd, SvgPathElement } from '../elements/registry.js';
import { hitAnchor } from './overlay.js';

let _panningBg = false;
let _dragging  = null;
// { cmdEl, cpIdx, isHandle, startDocX, startDocY, startProps }

export const handler = {
  onDown(e, docPos) {
    _panningBg = false;
    _dragging  = null;
    if (e.button !== 0) return;

    const overlayRect = document.getElementById('overlay').getBoundingClientRect();
    const hit = hitAnchor(e.clientX - overlayRect.left, e.clientY - overlayRect.top);

    if (hit) {
      editor.selectedEl = hit.cmdEl;
      emitSelect();
      _dragging = {
        cmdEl:      hit.cmdEl,
        cpIdx:      hit.cpIdx,
        isHandle:   hit.isHandle,
        startDocX:  docPos.x,
        startDocY:  docPos.y,
        startProps: { ...hit.cmdEl.toCommand() },
      };
      return;
    }

    _panningBg = true;
  },

  onMove(e, docPos, delta) {
    if (_dragging) {
      _applyDrag(docPos);
      return;
    }
    if (_panningBg) {
      editor.viewport.x -= delta.dx;
      editor.viewport.y -= delta.dy;
      emitViewport();
    }
  },

  onDragEnd(e, docPos) {
    if (_dragging) { _applyDrag(docPos); _dragging = null; }
    _panningBg = false;
  },

  onUp(e, docPos) {
    _panningBg = false;
    if (_dragging) { _dragging = null; return; }
    if (e.button !== 0) return;

    const svgEl = _elFromPoint(e.clientX, e.clientY);
    if (svgEl?._customEl) {
      editor.selectedEl = svgEl._customEl;
      emitSelect();
      return;
    }

    // Background click: two-step deselect (cmd first, then node)
    if (editor.selectedEl instanceof SvgCmd) {
      editor.selectedEl = editor.selectedEl.parentElement;
    } else {
      editor.selectedEl = null;
    }
    emitSelect();
  },

  onContextMenu(e) {
    editor.selectedEl = null;
    emitSelect();
  },
};

function _applyDrag(docPos) {
  const { cmdEl, cpIdx, isHandle, startDocX, startDocY, startProps } = _dragging;
  const dx = docPos.x - startDocX;
  const dy = docPos.y - startDocY;
  const L  = cmdEl.letter.toUpperCase();

  if (!isHandle) {
    if (L === 'M' || L === 'L' || L === 'T') {
      _s(cmdEl, 'x', startProps.x + dx); _s(cmdEl, 'y', startProps.y + dy);
    } else if (L === 'H') {
      _s(cmdEl, 'x', startProps.x + dx);
    } else if (L === 'V') {
      _s(cmdEl, 'y', startProps.y + dy);
    } else if (L === 'C' || L === 'S' || L === 'Q' || L === 'A') {
      _s(cmdEl, 'x', startProps.x + dx); _s(cmdEl, 'y', startProps.y + dy);
    }
  } else {
    if (L === 'C') {
      if (cpIdx === 0) { _s(cmdEl, 'x1', startProps.x1+dx); _s(cmdEl, 'y1', startProps.y1+dy); }
      else             { _s(cmdEl, 'x2', startProps.x2+dx); _s(cmdEl, 'y2', startProps.y2+dy); }
    } else if (L === 'S') {
      _s(cmdEl, 'x2', startProps.x2+dx); _s(cmdEl, 'y2', startProps.y2+dy);
    } else if (L === 'Q') {
      _s(cmdEl, 'x1', startProps.x1+dx); _s(cmdEl, 'y1', startProps.y1+dy);
    }
  }
}

function _s(cmdEl, attr, val) {
  cmdEl.setAttribute(attr, +val.toFixed(2));
}

function _elFromPoint(cx, cy) {
  const overlay = document.getElementById('overlay');
  overlay.style.pointerEvents = 'none';
  const el = document.elementFromPoint(cx, cy);
  overlay.style.pointerEvents = 'auto';
  if (!el) return null;
  let cur = el;
  while (cur) {
    if (cur._customEl) return cur;
    if (cur.id === 'doc-group' || cur.id === 'svg-root') break;
    cur = cur.parentElement;
  }
  return null;
}
