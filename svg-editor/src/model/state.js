// State — split into two clearly separated objects.
//
// doc    — everything serialized into the SVG file. The node tree only.
//          doc must never reference editor.
//
// editor — everything that is editor-only and never serialized:
//          selection, mode, viewport, underlay.
//          editor reads and writes doc; doc never knows about editor.

import { defaultDocument } from './node.js';

export const doc = {
  root: defaultDocument(),   // SvgNode — the root <svg> element
};

export const editor = {
  selectedId:    null,                    // number | null — selected SvgNode._id
  selectedCmdIdx: null,                   // number | null — selected path command index
  mode:          'select',               // 'select' | 'draw'
  viewport:      { x: 0, y: 0, zoom: 1 }, // document-space origin + zoom
  underlay:      null,                   // { dataUrl, opacity, includeInExport } | null
};

// Combined view for callers that need both (e.g. main.js wiring)
export const state = { doc, editor };

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
export function emitDoc()      { emit('doc'); }
export function emitSelect()   { emit('select'); }
export function emitMode()     { emit('mode'); }
export function emitViewport() { emit('viewport'); }
export function emitUnderlay() { emit('underlay'); }
