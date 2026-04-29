# SVG Editor — Architecture Brief

## Model

Custom elements are the document model. Each element type (`<svg-circle>`, `<svg-path>`, `<svg-rect>`, …) is a class registered via `customElements.define`. The class definition is the type system:

- `static observedAttributes` — declares the valid attribute set for that node type
- `connectedCallback` — creates the corresponding SVG element in the shared `<svg>` and appends it under the parent element's SVG node
- `attributeChangedCallback(name, _, value)` — updates the live SVG element in place
- `disconnectedCallback` — removes the SVG element

Each custom element stores a reference to its SVG counterpart (`this.svgNode`). Parent lookup is a single `this.parentElement.svgNode` call — DOM ancestry IS the SVG ancestry. The browser renders the SVG tree. No reconciler, no sync layer.

```
<svg-document>         → <svg>
  <svg-g>              →   <g>
    <svg-path>         →     <path d="…"/>
    <svg-circle>       →     <circle cx="…" cy="…" r="…"/>
```

The registry is the grammar. The tree is the document. The browser is the renderer.

---

## Editor state

A plain module (not part of the document model):

```js
export const editor = {
  selectedEl:    null,   // custom element reference | null
  selectedCmdIdx: null,  // path command index | null
  mode:          'select', // 'select' | 'draw'
  viewport:      { x: 0, y: 0, zoom: 1 },
  underlay:      null,   // { dataUrl, opacity, includeInExport } | null
};
```

Selection is a DOM reference, not an ID. No ID management needed.

---

## Path data model (carry forward verbatim)

Path `d` attribute parsing is non-trivial. The following logic is proven correct and worth porting directly into `SvgPathElement`:

**`parseD(d) → PathCommand[]`**  
Tokenises the `d` string. Expands implicit repetition (M followed by extra coord pairs → M then L). Each command is a named-prop object matching SVG 1.1 spec:
- `{ letter: 'M', x, y }`
- `{ letter: 'L', x, y }`
- `{ letter: 'C', x1, y1, x2, y2, x, y }`
- `{ letter: 'H', x }` / `{ letter: 'V', y }`
- `{ letter: 'A', rx, ry, 'x-axis-rotation', 'large-arc-flag', 'sweep-flag', x, y }`
- `{ letter: 'Z' }`

**`serializeD(commands) → string`**  
Serialises back to `d`. Uses a `KEYS` table (command letter → ordered named props) as the single source of truth for arity.

**`computePositions(commands) → { absX, absY, controls: [{x,y}] }[]`**  
Walks commands tracking current position. Returns absolute anchor + bezier control point positions for each command. Used by the canvas overlay to draw handles. Handles S/s reflected control points correctly.

**`defaultCmd(letter, cx, cy) → PathCommand`**  
Returns a new command with sensible defaults offset from the current position `(cx, cy)`. Used when appending a command via the UI.

**`KEYS` table**
```js
{
  M: ['x','y'],   m: ['x','y'],
  L: ['x','y'],   l: ['x','y'],
  H: ['x'],       h: ['x'],
  V: ['y'],       v: ['y'],
  C: ['x1','y1','x2','y2','x','y'],
  S: ['x2','y2','x','y'],
  Q: ['x1','y1','x','y'],
  T: ['x','y'],
  A: ['rx','ry','x-axis-rotation','large-arc-flag','sweep-flag','x','y'],
  Z: [],
}
```

---

## Canvas overlay

A `<canvas>` positioned over the `<svg>` (absolute, pointer-events on canvas only). Reads SVG element geometry via `svgEl.getBBox()`. Owns no data.

**Draws:**
- Selection box: padded rect around `getBBox()` of selected element (skip for paths — handles are the indicator)
- Document border: thin dashed rect from `<svg viewBox>`
- Path anchors: circles at each command's `absX/absY` from `computePositions()`; filled orange when `selectedCmdIdx` matches, blue otherwise
- Bezier control handles: smaller circles at `controls[]` positions; dashed lines from anchor to handle
- Draw preview: dashed line from last anchor to current cursor position (draw mode only)

**Hit testing:**  
On pointer down, check cursor against known handle/anchor positions (from last render). Anchor hit → start drag for that command. No SVG element hit — fall through to element selection via `document.elementFromPoint` + `closest('[data-svg-el]')` or similar.

**Drag (path anchors/handles):**  
Snapshot the relevant named props at drag start. On move, apply delta to the snapshotted values and write back to `element.svgNode.setAttribute(...)` and `element.setAttribute(...)` to keep both in sync. Named props (not positional indices) make this unambiguous.

---

## Viewport / pan / zoom

`viewport = { x, y, zoom }` applied as a `transform` on the doc group inside `<svg>`:
```
translate(${-x * zoom}, ${-y * zoom}) scale(${zoom})
```
or equivalently a `viewBox` update on the root `<svg>`.

- **Pan:** pointer drag on background → `x -= dx / zoom; y -= dy / zoom`
- **Zoom:** wheel → `zoom *= factor`; adjust x/y to keep cursor point stationary
- **Fit:** get `<svg>.getBBox()` of all content; compute zoom to fit with 12% padding; centre

---

## Draw mode

On canvas click at `docPos`:
1. If `editor.selectedEl` is an `<svg-path>`: append an L command to its `d` attribute
2. Else: create a new `<svg-path>` child of the selected element (or document root); select it; set its `d` to `M x y`

**Building an L command from click position:**
```js
const cmds = parseD(pathEl.getAttribute('d') || '');
const positions = computePositions(cmds);
const { absX: cx, absY: cy } = positions.at(-1);
cmds.push({ letter: 'L', x: docPos.x, y: docPos.y });
pathEl.setAttribute('d', serializeD(cmds));
```

Right-click or Escape exits draw mode. Partial path stays as a real document node.

---

## Tree panel

Walks the custom element tree with DOM APIs — no custom walk utilities needed:
```js
function buildRow(el) {
  // el.tagName, el.attributes, el.children
  // querySelector / closest for navigation
}
```

Path commands shown as virtual child rows below `<svg-path>`, derived from `parseD(el.getAttribute('d'))`.

Cmd-add affordance visible only when selected element is `<svg-path>`.

---

## Attribute panel

For selected element: iterate `el.attributes`, render as editable name/value pairs.  
For selected path command: show `KEYS[cmd.letter]` props as numeric inputs.  
Stale-index guard: if `parseD(d)[selectedCmdIdx]` is undefined, null out `selectedCmdIdx`.

---

## Export

Walk the custom element tree recursively. For each element, read `el.tagName` (strip `svg-` prefix → SVG tag name) and `el.attributes`. Serialize to SVG string. Ensure `xmlns="http://www.w3.org/2000/svg"` on root. Prepend XML declaration.

Optionally prepend underlay as `<image href="…" opacity="…"/>` first child.

---

## UI shell

Dark monospace theme. Layout: toolbar (top) + tree panel (left, 220px) + canvas (flex 1) + attr panel (right, 280px). Panels scroll independently. Dialogs for paste, underlay. All existing toolbar operations carry over: New, Load, Paste, Copy SVG, Download, Fit, Underlay, Delete. Keyboard: S (select), D (draw), F (fit), Delete/Backspace (delete node), Escape (cancel / deselect).
