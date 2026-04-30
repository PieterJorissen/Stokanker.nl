import { SVG_NS, SvgEditorElement, SvgCmd } from './base.js';
import { serializeD } from '../path-utils.js';

export { SvgCmd, SvgEditorElement } from './base.js';

// ── Document root ─────────────────────────────────────────────────────────────

export class SvgDocumentElement extends SvgEditorElement {
  get svgTag() { return 'svg'; }

  connectedCallback() {
    if (!this.svgRoot) {
      this.svgRoot = document.createElementNS(SVG_NS, 'svg');
      this.svgRoot.id = 'svg-root';
      this.svgRoot.setAttribute('width', '100%');
      this.svgRoot.setAttribute('height', '100%');
      // svgNode = the doc group that children append to
      this.svgNode = document.createElementNS(SVG_NS, 'g');
      this.svgNode.id = 'doc-group';
      this.svgRoot.appendChild(this.svgNode);
      const canvasArea = document.getElementById('canvas-area');
      canvasArea.insertBefore(this.svgRoot, canvasArea.firstChild);
      this._syncDocAttrs();
    }
    this._mo = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'attributes') {
          const v = this.getAttribute(m.attributeName);
          if (v === null) this.svgRoot.removeAttribute(m.attributeName);
          else this.svgRoot.setAttribute(m.attributeName, v);
        }
      }
    });
    this._mo.observe(this, { attributes: true });
  }

  disconnectedCallback() {
    this._mo?.disconnect();
    this._mo = null;
    this.svgRoot?.remove();
    this.svgRoot = null;
    this.svgNode = null;
  }

  _syncDocAttrs() {
    for (const attr of this.attributes) {
      this.svgRoot.setAttribute(attr.name, attr.value);
    }
  }

  clear() {
    this.innerHTML = '';
    // svgNode children are removed by disconnectedCallback of each child
  }
}

// ── Path (special: children are cmd elements, d is serialised output) ─────────

export class SvgPathElement extends SvgEditorElement {
  get svgTag() { return 'path'; }

  connectedCallback() {
    super.connectedCallback();
    this._cmdMo = new MutationObserver(() => this.updateD());
    this._cmdMo.observe(this, { childList: true });
    this.updateD();
  }

  disconnectedCallback() {
    this._cmdMo?.disconnect();
    this._cmdMo = null;
    super.disconnectedCallback();
  }

  updateD() {
    if (!this.svgNode) return;
    const cmds = this.cmdElements().map(c => c.toCommand());
    this.svgNode.setAttribute('d', serializeD(cmds));
  }

  cmdElements() {
    return [...this.children].filter(c => c instanceof SvgCmd);
  }
}

// ── Text / tspan (content attribute → textContent on SVG node) ───────────────

class SvgTextBase extends SvgEditorElement {
  _onAttrChange(name, value) {
    if (name === 'data-text') {
      if (this.svgNode) this.svgNode.textContent = value ?? '';
    } else {
      super._onAttrChange(name, value);
    }
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.svgNode && this.hasAttribute('data-text')) {
      this.svgNode.textContent = this.getAttribute('data-text');
    }
  }
}

// ── Generic structural element factory ────────────────────────────────────────

function defineStructural(tag, Base = SvgEditorElement) {
  const cls = class extends Base {};
  Object.defineProperty(cls, 'name', { value: `Svg_${tag}` });
  customElements.define(`svg-${tag}`, cls);
  return cls;
}

// ── Path command element factory ──────────────────────────────────────────────

function defineCmd(letter, attrs) {
  const tag = `svg-cmd-${letter.toLowerCase()}`;
  const cls = class extends SvgCmd {
    static observedAttributes = ['relative', ...attrs];
  };
  Object.defineProperty(cls, 'name', { value: `SvgCmd_${letter}` });
  customElements.define(tag, cls);
  return cls;
}

// ── Register all elements ─────────────────────────────────────────────────────

customElements.define('svg-document', SvgDocumentElement);
customElements.define('svg-path', SvgPathElement);

const SvgTextElement = class extends SvgTextBase {};
customElements.define('svg-text', SvgTextElement);
const SvgTspanElement = class extends SvgTextBase {};
customElements.define('svg-tspan', SvgTspanElement);
const SvgStyleElement = class extends SvgTextBase {};
customElements.define('svg-style', SvgStyleElement);

defineStructural('g');
defineStructural('circle');
defineStructural('rect');
defineStructural('ellipse');
defineStructural('line');
defineStructural('polyline');
defineStructural('polygon');
defineStructural('use');
defineStructural('defs');
defineStructural('symbol');
defineStructural('image');
defineStructural('stop');
defineStructural('mask');
defineStructural('filter');
defineStructural('linear-gradient');
defineStructural('radial-gradient');
defineStructural('clip-path');

// Path commands
export const SvgCmdM = defineCmd('m', ['x','y']);
export const SvgCmdL = defineCmd('l', ['x','y']);
export const SvgCmdH = defineCmd('h', ['x']);
export const SvgCmdV = defineCmd('v', ['y']);
export const SvgCmdC = defineCmd('c', ['x1','y1','x2','y2','x','y']);
export const SvgCmdS = defineCmd('s', ['x2','y2','x','y']);
export const SvgCmdQ = defineCmd('q', ['x1','y1','x','y']);
export const SvgCmdT = defineCmd('t', ['x','y']);
export const SvgCmdA = defineCmd('a', ['rx','ry','x-axis-rotation','large-arc-flag','sweep-flag','x','y']);
export const SvgCmdZ = defineCmd('z', []);

// ── Helpers ───────────────────────────────────────────────────────────────────

// Map SVG camelCase/special tag names to custom element tag names
const SVG_TO_CUSTOM = {
  svg:            'svg-document',
  linearGradient: 'svg-linear-gradient',
  radialGradient: 'svg-radial-gradient',
  clipPath:       'svg-clip-path',
};

export function customTagFor(svgTag) {
  return SVG_TO_CUSTOM[svgTag] ?? `svg-${svgTag}`;
}

export function svgTagFor(customTag) {
  const rev = Object.fromEntries(Object.entries(SVG_TO_CUSTOM).map(([k,v]) => [v,k]));
  if (rev[customTag]) return rev[customTag];
  // svg-linear-gradient → linearGradient etc.
  const withoutPrefix = customTag.replace(/^svg-/, '');
  // kebab-case → camelCase for multi-word tags
  return withoutPrefix.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

export function isCmdElement(el) {
  return el instanceof SvgCmd;
}

export function getOwningPath(cmdEl) {
  return cmdEl?.parentElement instanceof SvgPathElement ? cmdEl.parentElement : null;
}

export function getSvgDocument() {
  return document.querySelector('svg-document');
}

export function createCmdElement(letter) {
  const tag = `svg-cmd-${letter.toLowerCase()}`;
  return document.createElement(tag);
}
