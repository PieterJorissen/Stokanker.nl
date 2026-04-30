export const SVG_NS = 'http://www.w3.org/2000/svg';

export class SvgEditorElement extends HTMLElement {
  constructor() {
    super();
    this.svgNode = null;
    this._mo = null;
  }

  get svgTag() {
    return this.localName.replace(/^svg-/, '');
  }

  connectedCallback() {
    if (!this.svgNode) {
      this.svgNode = document.createElementNS(SVG_NS, this.svgTag);
      this.svgNode._customEl = this;
      this._syncAllAttrs();
    }
    const parentSvg = this._parentSvgNode();
    if (parentSvg) {
      parentSvg.insertBefore(this.svgNode, this._nextSvgSibling());
    }
    this._mo = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'attributes') {
          this._onAttrChange(m.attributeName, this.getAttribute(m.attributeName));
        }
      }
    });
    this._mo.observe(this, { attributes: true });
  }

  disconnectedCallback() {
    this._mo?.disconnect();
    this._mo = null;
    this.svgNode?.remove();
  }

  _onAttrChange(name, value) {
    if (!this.svgNode) return;
    if (value === null) this.svgNode.removeAttribute(name);
    else this.svgNode.setAttribute(name, value);
  }

  _syncAllAttrs() {
    for (const attr of this.attributes) {
      this._onAttrChange(attr.name, attr.value);
    }
  }

  _parentSvgNode() {
    let p = this.parentElement;
    while (p) {
      if (p.svgNode) return p.svgNode;
      p = p.parentElement;
    }
    return null;
  }

  _nextSvgSibling() {
    let next = this.nextElementSibling;
    while (next) {
      if (next.svgNode && !(next instanceof SvgCmd)) return next.svgNode;
      next = next.nextElementSibling;
    }
    return null;
  }
}

// Base class for path command elements — data nodes only, no svgNode.
export class SvgCmd extends HTMLElement {
  connectedCallback()    { this.parentElement?.updateD?.(); }
  attributeChangedCallback() { this.parentElement?.updateD?.(); }
  disconnectedCallback() { this.parentElement?.updateD?.(); }

  get letter() {
    const base = this.localName.replace('svg-cmd-', '').toUpperCase();
    return this.hasAttribute('relative') ? base.toLowerCase() : base;
  }

  toCommand() {
    const keys = (this.constructor.observedAttributes ?? []).filter(k => k !== 'relative');
    const cmd = { letter: this.letter };
    for (const k of keys) {
      const v = this.getAttribute(k);
      if (v !== null) cmd[k] = parseFloat(v);
    }
    return cmd;
  }
}
