import { editor, emitSelect, emitMode } from '../state.js';
import { SvgCmd, SvgPathElement, getSvgDocument, createCmdElement } from '../elements/registry.js';
import { computePositions } from '../path-utils.js';
import { setPreview, clearPreview, render } from './overlay.js';

export const handler = {
  onDown(e, docPos) {
    if (e.button === 2) { _finish(); return; }
  },

  onUp(e, docPos) {
    if (e.button !== 0) return;
    _appendOrCreate(docPos);
  },

  onMove(e, docPos) {
    setPreview(docPos);
    render();
  },

  onDragEnd(e, docPos) {
    _appendOrCreate(docPos);
  },

  onContextMenu(e) {
    e.preventDefault?.();
    _finish();
  },

  onLongPress() { _finish(); },
};

function _appendOrCreate(docPos) {
  const sel = editor.selectedEl;
  let pathEl = null;
  if (sel instanceof SvgPathElement) pathEl = sel;
  else if (sel instanceof SvgCmd) pathEl = sel.parentElement instanceof SvgPathElement ? sel.parentElement : null;

  if (pathEl) {
    // Append L command
    const cmds = pathEl.cmdElements().map(c => c.toCommand());
    const positions = computePositions(cmds);
    const last = positions.at(-1);
    const cmdEl = createCmdElement('L');
    cmdEl.setAttribute('x', _fmt(docPos.x));
    cmdEl.setAttribute('y', _fmt(docPos.y));
    pathEl.appendChild(cmdEl);
    editor.selectedEl = cmdEl;
    emitSelect();
  } else {
    // Create new path
    const docEl   = getSvgDocument();
    const parent  = (sel && !(sel instanceof SvgCmd) && sel.localName !== 'svg-document')
      ? sel : docEl;
    const newPath = document.createElement('svg-path');
    newPath.setAttribute('fill', 'none');
    newPath.setAttribute('stroke', '#000000');
    newPath.setAttribute('stroke-width', '1');
    const mCmd = createCmdElement('M');
    mCmd.setAttribute('x', _fmt(docPos.x));
    mCmd.setAttribute('y', _fmt(docPos.y));
    newPath.appendChild(mCmd);
    parent.appendChild(newPath);
    editor.selectedEl = newPath;
    emitSelect();
  }
}

function _finish() {
  clearPreview();
  editor.mode = 'select';
  emitMode();
}

function _fmt(n) {
  return isFinite(n) ? parseFloat(n.toFixed(2)) : 0;
}
