// Custom element registry — the document model.
// Each class = one SVG element type. The class is the schema.

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgTagFor(localName) {
  return localName.replace(/^svg-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Base class for all structural elements (not svg-document)
// ---------------------------------------------------------------------------
class SvgElement extends HTMLElement {
  connectedCallback() {
    const tag = svgTagFor(this.localName);
    this._el = document.createElementNS(SVG_NS, tag);
    this._el._model = this;

    // Copy existing attributes to the SVG node
    for (const { name, value } of this.attributes) {
      this._el.setAttribute(name, value);
    }

    // Watch future attribute changes via MutationObserver
    this._obs = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'attributes') {
          const v = this.getAttribute(m.attributeName);
          if (v === null) this._el.removeAttribute(m.attributeName);
          else this._el.setAttribute(m.attributeName, v);
        }
      }
    });
    this._obs.observe(this, { attributes: true });

    // Append to parent's SVG container
    this.parentElement?._el?.appendChild(this._el);
  }

  disconnectedCallback() {
    this._obs?.disconnect();
    this._el?.remove();
    this._el = null;
  }
}

// ---------------------------------------------------------------------------
// svg-document — maps to the shared <g id="doc"> mount point
// ---------------------------------------------------------------------------
class SvgDocumentElement extends HTMLElement {
  connectedCallback() {
    this._el = document.getElementById('doc');
    const root = document.getElementById('svg-root');

    // Sync own attributes (e.g. viewBox) to the <svg> root element
    for (const { name, value } of this.attributes) {
      root.setAttribute(name, value);
    }

    this._obs = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'attributes') {
          const v = this.getAttribute(m.attributeName);
          if (v === null) root.removeAttribute(m.attributeName);
          else root.setAttribute(m.attributeName, v);
        }
      }
    });
    this._obs.observe(this, { attributes: true });
  }

  disconnectedCallback() {
    this._obs?.disconnect();
  }
}

// ---------------------------------------------------------------------------
// Individual element types — static observedAttributes declares valid attrs
// ---------------------------------------------------------------------------

class SvgG extends SvgElement {
  static observedAttributes = ['id', 'transform', 'class', 'opacity', 'fill', 'stroke', 'stroke-width'];
}

class SvgCircle extends SvgElement {
  static observedAttributes = ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width', 'opacity', 'transform', 'id', 'class'];
}

class SvgRect extends SvgElement {
  static observedAttributes = ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke', 'stroke-width', 'opacity', 'transform', 'id', 'class'];
}

class SvgEllipse extends SvgElement {
  static observedAttributes = ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke', 'stroke-width', 'opacity', 'transform', 'id', 'class'];
}

class SvgLine extends SvgElement {
  static observedAttributes = ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width', 'opacity', 'transform', 'id', 'class'];
}

class SvgPath extends SvgElement {
  static observedAttributes = ['d', 'fill', 'stroke', 'stroke-width', 'fill-rule', 'opacity', 'transform', 'id', 'class'];
}

class SvgText extends SvgElement {
  static observedAttributes = ['x', 'y', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'fill', 'opacity', 'transform', 'id', 'class'];

  connectedCallback() {
    super.connectedCallback();
    // Sync text content
    this._textObs = new MutationObserver(() => {
      this._el.textContent = this.textContent;
    });
    this._textObs.observe(this, { characterData: true, subtree: true, childList: true });
    this._el.textContent = this.textContent;
  }

  disconnectedCallback() {
    this._textObs?.disconnect();
    super.disconnectedCallback();
  }
}

class SvgTspan extends SvgElement {
  static observedAttributes = ['x', 'y', 'dx', 'dy', 'font-size', 'font-weight', 'fill', 'id', 'class'];
}

class SvgUse extends SvgElement {
  static observedAttributes = ['href', 'x', 'y', 'width', 'height', 'transform', 'id', 'class'];
}

class SvgDefs extends SvgElement {
  static observedAttributes = ['id'];
}

class SvgSymbol extends SvgElement {
  static observedAttributes = ['id', 'viewBox', 'width', 'height'];
}

class SvgImage extends SvgElement {
  static observedAttributes = ['href', 'x', 'y', 'width', 'height', 'preserveAspectRatio', 'opacity', 'transform', 'id', 'class'];
}

class SvgPolyline extends SvgElement {
  static observedAttributes = ['points', 'fill', 'stroke', 'stroke-width', 'opacity', 'transform', 'id', 'class'];
}

class SvgPolygon extends SvgElement {
  static observedAttributes = ['points', 'fill', 'stroke', 'stroke-width', 'opacity', 'transform', 'id', 'class'];
}

class SvgStop extends SvgElement {
  static observedAttributes = ['offset', 'stop-color', 'stop-opacity', 'id'];
}

class SvgLinearGradient extends SvgElement {
  static observedAttributes = ['id', 'x1', 'y1', 'x2', 'y2', 'gradientUnits', 'gradientTransform', 'href'];
}

class SvgRadialGradient extends SvgElement {
  static observedAttributes = ['id', 'cx', 'cy', 'r', 'fx', 'fy', 'gradientUnits', 'gradientTransform', 'href'];
}

class SvgClipPath extends SvgElement {
  static observedAttributes = ['id', 'clipPathUnits'];
}

class SvgMask extends SvgElement {
  static observedAttributes = ['id', 'x', 'y', 'width', 'height', 'maskUnits', 'maskContentUnits'];
}

class SvgFilter extends SvgElement {
  static observedAttributes = ['id', 'x', 'y', 'width', 'height', 'filterUnits', 'primitiveUnits'];
}

// ---------------------------------------------------------------------------
// Register all types
// ---------------------------------------------------------------------------
customElements.define('svg-document',        SvgDocumentElement);
customElements.define('svg-g',               SvgG);
customElements.define('svg-circle',          SvgCircle);
customElements.define('svg-rect',            SvgRect);
customElements.define('svg-ellipse',         SvgEllipse);
customElements.define('svg-line',            SvgLine);
customElements.define('svg-path',            SvgPath);
customElements.define('svg-text',            SvgText);
customElements.define('svg-tspan',           SvgTspan);
customElements.define('svg-use',             SvgUse);
customElements.define('svg-defs',            SvgDefs);
customElements.define('svg-symbol',          SvgSymbol);
customElements.define('svg-image',           SvgImage);
customElements.define('svg-polyline',        SvgPolyline);
customElements.define('svg-polygon',         SvgPolygon);
customElements.define('svg-stop',            SvgStop);
customElements.define('svg-linear-gradient', SvgLinearGradient);
customElements.define('svg-radial-gradient', SvgRadialGradient);
customElements.define('svg-clip-path',       SvgClipPath);
customElements.define('svg-mask',            SvgMask);
customElements.define('svg-filter',          SvgFilter);

export { SvgDocumentElement, SvgElement };
