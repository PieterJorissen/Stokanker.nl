// Tree panel — walks the custom element tree; clicking selects an element.

import { state, notify } from './state.js';
import { renderOverlay } from './canvas.js';

let treeRoot;

export function init() {
  treeRoot = document.getElementById('tree-root');
}

export function render() {
  treeRoot.innerHTML = '';
  const doc = document.querySelector('svg-document');
  if (!doc) return;
  treeRoot.appendChild(buildNode(doc, 0));
}

function buildNode(el, depth) {
  const frag = document.createDocumentFragment();

  const row = document.createElement('div');
  row.className = 'tree-row';
  if (el === state.selected) row.classList.add('selected');
  row.style.paddingLeft = (depth * 14 + 6) + 'px';
  row.textContent = el.localName;
  row.addEventListener('pointerdown', e => {
    e.stopPropagation();
    state.selected = el;
    notify();
    renderOverlay();
  });
  frag.appendChild(row);

  for (const child of el.children) {
    frag.appendChild(buildNode(child, depth + 1));
  }

  return frag;
}
