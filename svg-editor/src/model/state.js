// EditorState — the only non-SVG state in the editor.
// Contains selection, mode, viewport, and underlay (display references only).
// All document data lives in state.root (SvgNode tree).

import { defaultDocument } from './node.js';

export const state = {
  root: defaultDocument(),       // SvgNode — root <svg> element
  selectedId: null,              // number | null — selected SvgNode._id
  selectedCmdIdx: null,          // number | null — selected path command index
  mode: 'select',                // 'select' | 'path-edit' | 'draw'
  viewport: { x: 0, y: 0, zoom: 1 },  // document-space origin + zoom
  underlay: null,                // { dataUrl, opacity, includeInExport } | null
};

// Simple event bus
const _listeners = {};

export function on(event, fn) {
  (_listeners[event] ??= []).push(fn);
  return () => {
    _listeners[event] = _listeners[event].filter(f => f !== fn);
  };
}

export function emit(event, data) {
  (_listeners[event] ?? []).forEach(fn => fn(data));
}

// Named emit helpers
export function emitDoc()       { emit('doc'); }
export function emitSelect()    { emit('select'); }
export function emitMode()      { emit('mode'); }
export function emitViewport()  { emit('viewport'); }
export function emitUnderlay()  { emit('underlay'); }
