// File load, export, delete actions.

import { state, notify } from './state.js';
import { renderOverlay } from './canvas.js';

// Map SVG tag name (possibly camelCase) → custom element tag name
function toCustomTag(svgTag) {
  const kebab = svgTag.replace(/([A-Z])/g, c => '-' + c.toLowerCase());
  return 'svg-' + kebab;
}

// Build custom element tree from an SVG DOM node into a parent custom element
function importNode(svgEl, parentCustomEl) {
  const tag = toCustomTag(svgEl.localName);
  if (!customElements.get(tag)) return; // skip unknown element types

  const el = document.createElement(tag);

  for (const { name, value } of svgEl.attributes) {
    el.setAttribute(name, value);
  }

  parentCustomEl.appendChild(el);

  if (svgEl.localName === 'text') {
    el.textContent = svgEl.textContent;
    return; // text children are text nodes, not structural
  }

  for (const child of svgEl.children) {
    importNode(child, el);
  }
}

export function initEditor() {
  const fileInput = document.getElementById('file-input');
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => loadSVGString(e.target.result);
    reader.readAsText(file);
    fileInput.value = '';
  });

  document.getElementById('btn-export').addEventListener('click', exportSVG);
  document.getElementById('btn-delete').addEventListener('click', () => deleteSelected());
}

function loadSVGString(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svgEl = doc.documentElement;

  if (svgEl.localName !== 'svg') return;

  const modelDoc = document.querySelector('svg-document');

  // Clear current children
  while (modelDoc.firstChild) modelDoc.firstChild.remove();

  // Copy viewBox (and other root attrs) to svg-document
  for (const { name, value } of svgEl.attributes) {
    modelDoc.setAttribute(name, value);
  }

  // Import children
  for (const child of svgEl.children) {
    importNode(child, modelDoc);
  }

  state.selected = null;
  notify();
}

// Serialize a custom element subtree back to an SVG string
function exportNode(customEl) {
  const localName = customEl.localName;

  if (localName === 'svg-document') {
    const root = document.getElementById('svg-root');
    const attrs = [...root.attributes]
      .map(a => ` ${a.name}="${escapeAttr(a.value)}"`)
      .join('');
    const children = [...customEl.children].map(exportNode).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg"${attrs}>${children}</svg>`;
  }

  const svgTag = localName.replace(/^svg-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const attrs = [...customEl.attributes]
    .map(a => ` ${a.name}="${escapeAttr(a.value)}"`)
    .join('');

  if (customEl.localName === 'svg-text') {
    return `<${svgTag}${attrs}>${escapeText(customEl.textContent)}</${svgTag}>`;
  }

  const children = [...customEl.children].map(exportNode).join('');
  if (!children && !customEl.textContent) {
    return `<${svgTag}${attrs}/>`;
  }
  return `<${svgTag}${attrs}>${children}</${svgTag}>`;
}

function escapeAttr(v) {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function escapeText(v) {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function exportSVG() {
  const modelDoc = document.querySelector('svg-document');
  const svg = '<?xml version="1.0" encoding="UTF-8"?>\n' + exportNode(modelDoc);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'exported.svg';
  a.click();
  URL.revokeObjectURL(url);
}

export function deleteSelected() {
  if (!state.selected) return;
  if (state.selected.localName === 'svg-document') return;
  state.selected.remove();
  state.selected = null;
  notify();
  renderOverlay();
}
