export const editor = {
  selectedEl:  null,   // custom element ref (structural or cmd) | null
  mode:        'select',
  viewport:    { x: 0, y: 0, zoom: 1 },
  underlay:    null,   // { dataUrl, opacity, includeInExport } | null
};

const _listeners = {};

export function on(event, fn) {
  (_listeners[event] ??= []).push(fn);
  return () => { _listeners[event] = _listeners[event].filter(f => f !== fn); };
}

export function emit(event, data) {
  (_listeners[event] ?? []).forEach(fn => fn(data));
}

export function emitSelect()   { emit('select'); }
export function emitDoc()      { emit('doc'); }
export function emitMode()     { emit('mode'); }
export function emitViewport() { emit('viewport'); }
export function emitUnderlay() { emit('underlay'); }
