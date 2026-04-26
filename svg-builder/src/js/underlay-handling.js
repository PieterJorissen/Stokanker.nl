import drawing, { commitDrawingToStorage } from './drawing/drawing.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const UNDERLAY_ID = 'underlay-image';

export {
    handleUnderlayUpload,
    handleUnderlayOpacity,
    handleUnderlayExportToggle,
    renderUnderlayElement,
    removeUnderlayElement,
};

function handleUnderlayUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener('load', ({ target }) => {
        drawing.underlay.src = target.result;
        commitDrawingToStorage();
        document.dispatchEvent(new Event('initializeCanvas'));
    });
    reader.readAsDataURL(file);
}

function handleUnderlayOpacity(event) {
    const opacity = parseFloat(event.target.value);
    drawing.underlay.opacity = opacity;
    const el = document.getElementById(UNDERLAY_ID);
    if (el) el.setAttribute('opacity', opacity);
    commitDrawingToStorage();
}

function handleUnderlayExportToggle(event) {
    drawing.underlay.includeInExport = event.target.checked;
    commitDrawingToStorage();
}

/**
 * Prepends an <image> element to the drawing content group when an underlay is set.
 * Must be called after replaceChildren() so the underlay lands at index 0 (below layers).
 * @param { SVGGElement } drawingContentGroup
 */
function renderUnderlayElement(drawingContentGroup) {
    removeUnderlayElement();
    if (!drawing.underlay.src) return;

    const img = document.createElementNS(SVG_NS, 'image');
    img.setAttribute('id', UNDERLAY_ID);
    img.setAttribute('href', drawing.underlay.src);
    img.setAttribute('x', '0');
    img.setAttribute('y', '0');
    img.setAttribute('width', '100%');
    img.setAttribute('height', '100%');
    img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    img.setAttribute('opacity', drawing.underlay.opacity);
    img.setAttribute('pointer-events', 'none');
    drawingContentGroup.prepend(img);
}

function removeUnderlayElement() {
    document.getElementById(UNDERLAY_ID)?.remove();
}
