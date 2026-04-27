import { drawingContent, svg } from './dom-selections.js';

let vb = { x: 0, y: 0, w: 500, h: 500 };
let panActive = false;
let panPointerId = null;
let lastPanX = 0;
let lastPanY = 0;
let spaceDown = false;

function initCanvasNavigation() {
    const rect = svg.getBoundingClientRect();
    vb = { x: 0, y: 0, w: rect.width || 500, h: rect.height || 500 };
    applyViewBox();

    // Capture phase so we can stop addPoint from firing during pan
    svg.addEventListener('pointerdown', onPanStart, true);
    svg.addEventListener('pointermove', onPanMove);
    svg.addEventListener('pointerup', onPanEnd);
    svg.addEventListener('pointercancel', onPanEnd);
    // passive: false set in index.js for the wheel listener
    svg.addEventListener('wheel', onWheel, { passive: false });

    window.addEventListener('keydown', (e) => { if (e.code === 'Space') spaceDown = true; });
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') spaceDown = false; });
}

function resetViewBox() {
    const svgRect = svg.getBoundingClientRect();
    const dcRect = drawingContent.getBoundingClientRect();

    if (dcRect.width === 0 && dcRect.height === 0) {
        vb = { x: 0, y: 0, w: svgRect.width || 500, h: svgRect.height || 500 };
    } else {
        // Convert screen-space rect to SVG viewBox space (accounts for all transforms)
        const scaleX = vb.w / svgRect.width;
        const scaleY = vb.h / svgRect.height;
        const x = vb.x + (dcRect.left - svgRect.left) * scaleX;
        const y = vb.y + (dcRect.top - svgRect.top) * scaleY;
        const w = dcRect.width * scaleX;
        const h = dcRect.height * scaleY;
        const padding = Math.max(w, h) * 0.12;
        vb = { x: x - padding, y: y - padding, w: w + padding * 2, h: h + padding * 2 };
    }

    applyViewBox();
}

function isHandModeActive() {
    return document.getElementById('pan-mode-toggle')?.checked ?? false;
}

function isPanEvent(event) {
    return event.button === 1 || isHandModeActive() || spaceDown;
}

function onPanStart(event) {
    if (!isPanEvent(event)) return;
    // Prevent addPoint and other bubble-phase handlers from firing
    event.stopImmediatePropagation();
    panActive = true;
    panPointerId = event.pointerId;
    lastPanX = event.clientX;
    lastPanY = event.clientY;
    svg.setPointerCapture(event.pointerId);
    svg.style.cursor = 'grabbing';
}

function onPanMove(event) {
    if (!panActive || event.pointerId !== panPointerId) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = vb.w / rect.width;
    const scaleY = vb.h / rect.height;
    vb.x -= (event.clientX - lastPanX) * scaleX;
    vb.y -= (event.clientY - lastPanY) * scaleY;
    lastPanX = event.clientX;
    lastPanY = event.clientY;
    applyViewBox();
}

function onPanEnd(event) {
    if (event.pointerId !== panPointerId) return;
    panActive = false;
    panPointerId = null;
    svg.style.cursor = isHandModeActive() ? 'grab' : '';
}

function onWheel(event) {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 1.1 : (1 / 1.1);
    const rect = svg.getBoundingClientRect();
    const fracX = (event.clientX - rect.left) / rect.width;
    const fracY = (event.clientY - rect.top) / rect.height;
    // SVG-space position of cursor before zoom
    const cx = vb.x + fracX * vb.w;
    const cy = vb.y + fracY * vb.h;
    // Scale viewBox, keeping cursor point fixed
    vb.w *= factor;
    vb.h *= factor;
    vb.x = cx - fracX * vb.w;
    vb.y = cy - fracY * vb.h;
    applyViewBox();
}

function applyViewBox() {
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
}

export { initCanvasNavigation, isHandModeActive, resetViewBox };
