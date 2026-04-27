// SVG DOM renderer — reflects SvgNode tree into the real SVG DOM.
// Maintains a bidirectional Map between node _id and DOM element.
// Full re-render on each document mutation (document is small enough).

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

// _id → DOM element
const _nodeToEl = new Map();
// DOM element (WeakMap) → _id
const _elToId = new WeakMap();

let _docGroup = null;  // the <g id="doc"> container

export function init(docGroup) {
  _docGroup = docGroup;
}

/** Render the document root's children into the doc group. */
export function renderDocument(root) {
  _nodeToEl.clear();
  while (_docGroup.firstChild) _docGroup.removeChild(_docGroup.firstChild);

  if (!root) return;

  for (const child of root.children) {
    const el = makeElement(child);
    if (el) _docGroup.appendChild(el);
  }
}

/** Return the DOM element for a node _id, or null. */
export function elForId(id) {
  return _nodeToEl.get(id) ?? null;
}

/** Return the node _id for a DOM element (walking up the tree to find one). */
export function idForEl(el) {
  let cur = el;
  while (cur && cur !== _docGroup) {
    const id = _elToId.get(cur);
    if (id !== undefined) return id;
    cur = cur.parentElement;
  }
  return null;
}

/** Check if a DOM element is inside the doc group. */
export function isDocElement(el) {
  return _docGroup && _docGroup.contains(el);
}

// --- Private ---

function makeElement(node) {
  if (node.tag === '#text') {
    const tn = document.createTextNode(node.content);
    _nodeToEl.set(node._id, tn);
    return tn;
  }

  const el = document.createElementNS(SVG_NS, node.tag);
  applyAttrs(el, node.attrs);

  for (const child of node.children) {
    const childEl = makeElement(child);
    if (childEl) el.appendChild(childEl);
  }

  _nodeToEl.set(node._id, el);
  _elToId.set(el, node._id);
  return el;
}

function applyAttrs(el, attrs) {
  for (const [name, value] of Object.entries(attrs)) {
    setAttr(el, name, value);
  }
}

function setAttr(el, name, value) {
  if (name === 'xmlns' || name.startsWith('xmlns:')) return; // handled by createElementNS
  if (name.startsWith('xlink:')) {
    el.setAttributeNS(XLINK_NS, name, value);
  } else {
    el.setAttribute(name, value);
  }
}
