// Editor state — selection and viewport. Single source of truth.

export const state = {
  selected: null,                      // custom element | null
  viewport: { x: 0, y: 0, zoom: 1 },
};

const _fns = new Set();
export function onChange(fn) { _fns.add(fn); return () => _fns.delete(fn); }
export function notify()     { _fns.forEach(fn => fn()); }
