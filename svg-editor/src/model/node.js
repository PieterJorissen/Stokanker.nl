// SvgNode — lossless representation of an SVG element tree.
// Each node is a plain object: { _id, tag, attrs, children }
// Text nodes: { _id, tag: '#text', content, attrs: {}, children: [] }
// Nothing computed — all data is exactly what the SVG contains.

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

let _nextId = 1;

export function createNode(tag, attrs = {}, children = []) {
  return { _id: _nextId++, tag, attrs: { ...attrs }, children: [...children] };
}

export function createTextNode(content) {
  return { _id: _nextId++, tag: '#text', content, attrs: {}, children: [] };
}

/** Parse a real SVG DOM element (or text node) into a SvgNode tree. */
export function fromDOM(el) {
  if (el.nodeType === Node.TEXT_NODE) {
    const text = el.textContent;
    if (!text.trim()) return null;
    return { _id: _nextId++, tag: '#text', content: text, attrs: {}, children: [] };
  }
  if (el.nodeType === Node.COMMENT_NODE) return null;
  if (el.nodeType !== Node.ELEMENT_NODE) return null;

  const node = { _id: _nextId++, tag: el.localName, attrs: {}, children: [] };

  for (const attr of el.attributes) {
    node.attrs[attr.name] = attr.value;
  }

  for (const child of el.childNodes) {
    const childNode = fromDOM(child);
    if (childNode) node.children.push(childNode);
  }

  return node;
}

/** Parse an SVG string into a SvgNode tree rooted at <svg>. */
export function fromString(svgString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString.trim(), 'image/svg+xml');
  const root = doc.documentElement;
  if (root.localName === 'parsererror') {
    throw new Error('SVG parse error: ' + root.textContent.slice(0, 200));
  }
  const node = fromDOM(root);
  if (!node || node.tag !== 'svg') throw new Error('Root element must be <svg>');
  return node;
}

/** Serialize a SvgNode tree to an SVG string. */
export function serialize(node, indent = '') {
  if (node.tag === '#text') return indent + escapeText(node.content.trim());

  const pairs = Object.entries(node.attrs);
  // Ensure xmlns is first, then the rest alphabetically
  pairs.sort(([a], [b]) => {
    if (a === 'xmlns') return -1;
    if (b === 'xmlns') return 1;
    if (a.startsWith('xmlns:') && !b.startsWith('xmlns:')) return -1;
    if (!a.startsWith('xmlns:') && b.startsWith('xmlns:')) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  const attrStr = pairs.map(([k, v]) => `${k}="${escapeAttr(v)}"`).join(' ');
  const open = `${indent}<${node.tag}${attrStr ? ' ' + attrStr : ''}`;

  if (node.children.length === 0) return `${open}/>`;

  const inner = node.children.map(c => serialize(c, indent + '  ')).join('\n');
  return `${open}>\n${inner}\n${indent}</${node.tag}>`;
}

/** Default empty document */
export function defaultDocument() {
  return createNode('svg', { xmlns: SVG_NS, viewBox: '0 0 800 600' });
}

/** Walk all nodes depth-first, calling fn(node, parent) */
export function walk(node, fn, parent = null) {
  fn(node, parent);
  for (const child of node.children) walk(child, fn, node);
}

/** Find a node by _id. Returns null if not found. */
export function findById(root, id) {
  if (root._id === id) return root;
  for (const child of root.children) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

/** Find the parent of the node with the given _id. */
export function findParent(root, id) {
  for (const child of root.children) {
    if (child._id === id) return root;
    const found = findParent(child, id);
    if (found) return found;
  }
  return null;
}

/** Build a flat Map<_id, SvgNode> for the whole tree. */
export function buildIdMap(root) {
  const map = new Map();
  walk(root, node => map.set(node._id, node));
  return map;
}

// --- Mutations (all return void, mutate in place) ---

/** Set an attribute value on a node. */
export function setAttr(node, name, value) {
  node.attrs[name] = value;
}

/** Remove an attribute from a node. */
export function removeAttr(node, name) {
  delete node.attrs[name];
}

/** Append a child node. */
export function appendChild(parent, child) {
  parent.children.push(child);
}

/** Remove a child by id. Returns the removed node or null. */
export function removeChild(parent, childId) {
  const i = parent.children.findIndex(c => c._id === childId);
  if (i === -1) return null;
  return parent.children.splice(i, 1)[0];
}

/** Move child at index i up (toward 0) by one step. */
export function moveChildUp(parent, childId) {
  const i = parent.children.findIndex(c => c._id === childId);
  if (i <= 0) return;
  [parent.children[i - 1], parent.children[i]] = [parent.children[i], parent.children[i - 1]];
}

/** Move child at index i down (toward end) by one step. */
export function moveChildDown(parent, childId) {
  const i = parent.children.findIndex(c => c._id === childId);
  if (i === -1 || i >= parent.children.length - 1) return;
  [parent.children[i], parent.children[i + 1]] = [parent.children[i + 1], parent.children[i]];
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export { SVG_NS, XLINK_NS };
