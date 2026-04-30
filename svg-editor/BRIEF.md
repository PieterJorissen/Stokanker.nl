# SVG Editor — Architecture Brief

## Core principle

Custom elements are the document model. The registry is the grammar. The tree is the document. The browser is the renderer.

Each custom element type (`<svg-circle>`, `<svg-path>`, `<svg-cmd-l>`, …) is a class registered via `customElements.define`. The class definition is the type system — `static observedAttributes` declares the valid attribute set for that node type. No external schema, no validation logic.

Custom elements never try to be SVG nodes. They describe them. A lightweight renderer walks the custom element tree and maintains a corresponding live SVG DOM in a single shared `<svg>` element, in the correct namespace and ancestry. The browser renders that SVG natively.

---

## Path commands are children, not a string attribute

This is the most important structural decision in the architecture and must be settled first, because it propagates into every other part.

In SVG, a path's geometry is encoded as a single `d` string: `d="M 10 10 L 100 100 C …"`. That is a serialisation format, not a data model.

In this architecture, **each path command is a child custom element of `<svg-path>`**:

```html
<svg-path fill="none" stroke="#000">
  <svg-cmd-m x="10" y="10"/>
  <svg-cmd-l x="100" y="100"/>
  <svg-cmd-c x1="50" y1="50" x2="80" y2="20" x="100" y="100"/>
  <svg-cmd-z/>
</svg-path>
```

The `d` attribute is an output of the renderer, not a property of the model.

### Why this is right

- **DOM identity.** Each command has a real element reference. Selection, drag, and deletion all operate on `this` — no integer index bookkeeping.
- **Registry is the grammar, completely.** `SvgCmdC.observedAttributes = ['x1','y1','x2','y2','x','y']` declares exactly what a C command holds. The KEYS table from the old implementation is replaced by `customElements.get(tagName).observedAttributes`.
- **Tree panel needs no special cases.** `<svg-cmd-*>` elements are real DOM children. The tree walks them exactly like any other children — no virtual rows, no separate cmd rendering path.
- **Move, delete, add are standard DOM mutations.** `cmdEl.remove()`, `parent.insertBefore(a, b)`, `pathEl.appendChild(new SvgCmdL())` — nothing custom needed.
- **Selection is unified.** `editor.selectedEl` is always a DOM reference whether it points to `<svg-circle>` or `<svg-cmd-l>`. `editor.selectedCmdIdx` (an integer) does not exist.

### Command element naming

One class per command letter. Relative variants use a `relative` boolean attribute, sharing the same class:

```
<svg-cmd-m x="10" y="10"/>          → M 10 10  (absolute)
<svg-cmd-m relative x="5" y="5"/>   → m 5 5    (relative)
```

Ten element types: `svg-cmd-m`, `svg-cmd-l`, `svg-cmd-h`, `svg-cmd-v`, `svg-cmd-c`, `svg-cmd-s`, `svg-cmd-q`, `svg-cmd-t`, `svg-cmd-a`, `svg-cmd-z`. Each declares only the attributes relevant to it. `svg-cmd-z` has no numeric attributes.

### Renderer for path

`<svg-path>`'s SVG counterpart is a `<path>` element. Whenever any cmd child changes (attribute, addition, removal), the path element reserialises its `d`:

```js
updateD() {
  const d = [...this.children]
    .filter(c => c instanceof SvgCmd)
    .map(c => c.serialize())   // each cmd knows how to write its letter + values
    .join(' ');
  this.svgNode.setAttribute('d', d);
}
```

Each `<svg-cmd-*>`'s `attributeChangedCallback` calls `this.parentElement?.updateD?.()`. Cmd elements do not have their own SVG nodes — they are data nodes only. The parent path owns the single `<path>` SVG element.

### Import (load from SVG string)

Parse the SVG DOM → for each `<path>`, parse `d` into commands → create `<svg-cmd-*>` children with the right attributes. The `d` string is consumed on load and never stored in the model.

### Export

For `<svg-path>`: walk `<svg-cmd-*>` children, call `serialize()` on each, join into `d`, write `<path d="…" …/>`. Same `serialize()` method the renderer uses — one implementation.

---

## Model

```
<svg-document>              → <svg viewBox="…">
  <svg-g>                   →   <g>
    <svg-path>              →     <path d="M… L…"/>
      <svg-cmd-m x y/>      →       (data only, no SVG node)
      <svg-cmd-l x y/>      →       (data only, no SVG node)
    <svg-circle cx cy r/>   →     <circle cx cy r/>
    <svg-rect …/>           →     <rect …/>
    <svg-text>              →     <text>
      (text content node)   →       text content
```

Each structural element (`svg-circle`, `svg-rect`, etc.) owns one SVG element (`this.svgNode`). Path commands own none.

**`connectedCallback`** — structural elements create their SVG node and append it to `this.parentElement.svgNode`. Path cmd elements call `this.parentElement?.updateD?.()`.

**`attributeChangedCallback`** — structural elements call `this.svgNode.setAttribute(name, value)`. Path cmd elements call `this.parentElement?.updateD?.()`.

**`disconnectedCallback`** — structural elements remove `this.svgNode`. Path cmd elements call `this.parentElement?.updateD?.()`.

---

## Editor state

```js
export const editor = {
  selectedEl:  null,   // custom element reference | null (node OR cmd element)
  mode:        'select', // 'select' | 'draw'
  viewport:    { x: 0, y: 0, zoom: 1 },
  underlay:    null,   // { dataUrl, opacity, includeInExport } | null
};
```

`selectedCmdIdx` does not exist. Selection is always a DOM reference. To know if a command is selected: `editor.selectedEl instanceof SvgCmd`. To find the owning path: `editor.selectedEl.parentElement` (an `<svg-path>`).

---

## Path data helpers (carry forward)

These pure functions are proven correct and used by the renderer and canvas overlay. Port them verbatim into a `path-utils.js` module:

**`parseD(d) → PathCommand[]`** — tokenise, expand implicit repetition, return named-prop objects. Used only during import.

**`serializeD(commands) → string`** — inverse. Used as a reference; in practice each `<svg-cmd-*>` implements `serialize()` directly.

**`computePositions(commands) → { absX, absY, controls: [{x,y}] }[]`** — compute absolute anchor + bezier control point positions from a command sequence. Used by the canvas overlay to place handles. The overlay reads commands from the `<svg-cmd-*>` children directly:
```js
const cmds = [...pathEl.children]
  .filter(c => c instanceof SvgCmd)
  .map(c => c.toCommand());   // returns { letter, x, y, … }
```

**`defaultCmd(letter, cx, cy) → PathCommand`** — sensible defaults for a new command at current position. Used when appending a command via UI.

---

## Canvas overlay

A `<canvas>` positioned over the `<svg>`. Reads geometry only — owns no data.

**Selection box**: padded rect around `getBBox()` of the selected element's `svgNode`. Skipped for path nodes (handles are the selection indicator).

**Path handles**: when `editor.selectedEl` is an `<svg-cmd-*>` or its parent `<svg-path>` is selected, draw anchors and bezier handles at positions from `computePositions()`. The selected anchor: `editor.selectedEl instanceof SvgCmd && editor.selectedEl === cmdEl`.

**Hit testing on pointer down**: check cursor against anchor/handle positions from last render pass. Each rendered anchor stores a reference to its `<svg-cmd-*>` element. On hit: `editor.selectedEl = cmdEl`. On miss: fall through to element selection via `document.elementFromPoint`.

**Drag**: snapshot `cmdEl`'s named attributes at drag start. On move, apply delta, write back via `cmdEl.setAttribute(name, value)` — `attributeChangedCallback` propagates to path re-render automatically.

**Draw preview**: dashed line from last cmd's `absX/absY` to cursor. Last cmd is `pathEl.lastElementChild` of the current draw path.

---

## Draw mode

On canvas click at `docPos`:
1. If `editor.selectedEl` is an `<svg-cmd-*>` or `<svg-path>`: get the path element, append a new `<svg-cmd-l>` child with `x/y` from `docPos`
2. Else: create `<svg-path>` under the selected container (or document root); append `<svg-cmd-m x y>` as first child; select the path

Right-click or Escape → switch to select mode. Partial path stays as real document nodes.

---

## Tree panel

Walk `customElementTree.children` recursively with DOM APIs. No custom walk utilities.

`<svg-cmd-*>` children of `<svg-path>` appear as real DOM children — no virtual rows, no special path handling. The tree renders them identically to any other child node (different CSS class for visual distinction).

Selected state: `el === editor.selectedEl`.

---

## Attribute panel

If `editor.selectedEl instanceof SvgCmd`: show `customElements.get(el.tagName.toLowerCase()).observedAttributes` (minus `relative`) as numeric inputs. This replaces the KEYS lookup — the registry IS the schema.

If structural element: iterate `el.attributes`, render as editable name/value pairs. Add/remove attributes normally.

No `selectedCmdIdx` stale-index guard needed — the element reference is either valid or null.

---

## Export

Walk the custom element tree recursively:
- Structural elements: tag name (strip `svg-` prefix), copy `el.attributes` (excluding internal attrs)
- `<svg-path>`: collect `<svg-cmd-*>` children → serialize `d`
- Text content nodes: text content
- Ensure `xmlns` on root; prepend XML declaration
- Optional: prepend underlay as `<image>` first child

---

## UI shell

Dark monospace theme. Layout: toolbar (top) + tree panel (left, 220px) + canvas (flex 1) + attr panel (right, 280px). Toolbar: New, Load, Paste, Copy SVG, Download, Fit, Underlay, Delete. Keyboard: S (select), D (draw), F (fit), Delete/Backspace (delete), Escape (cancel / deselect). Cmd-add affordance in tree panel header, visible only when `editor.selectedEl` is or is inside an `<svg-path>`.

---

## Viewport / pan / zoom

`viewport = { x, y, zoom }` applied as transform on the SVG doc group.

- **Pan**: pointer drag on background → `x -= dx / zoom; y -= dy / zoom`
- **Zoom**: wheel → `zoom *= factor`; adjust origin to keep cursor point stationary
- **Fit**: `svgDocGroup.getBBox()`, compute zoom to fill viewport with 12% padding, centre
