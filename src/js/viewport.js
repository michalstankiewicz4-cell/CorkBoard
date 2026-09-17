// viewport.js – pan/zoom transform, fit-to-content, and the minimap.

import { state } from './state.js';
import { boardWrap, canvas, threadSvg } from './dom.js';
import { Minimap } from './minimap.js';
import { t } from './i18n.js';

export const pan = { x: 0, y: 0 };
export let zoom = 1.0;
const ZOOM_MIN = 0.25, ZOOM_MAX = 4.0, ZOOM_STEP = 0.1;
export function zoomBounds() { return { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP }; }

let vpW = window.innerWidth, vpH = window.innerHeight;
export function getViewportSize() { return { vpW, vpH }; }

let minimap = null;
let lastBoardW = 1800, lastBoardH = 900;

export function initViewport() {
  new ResizeObserver(([e]) => { vpW = e.contentRect.width; vpH = e.contentRect.height; }).observe(boardWrap);

  const mmEl = document.getElementById('minimap-container');
  if (!mmEl) return;
  minimap = new Minimap(mmEl);
  minimap.canvas.style.cursor = 'crosshair';
  minimap.canvas.addEventListener('click', e => {
    const r  = minimap.canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const cw = minimap.canvas.width, ch = minimap.canvas.height;
    const boardX = (mx - 4) / (cw - 8) * lastBoardW;
    const boardY = (my - 4) / (ch - 8) * lastBoardH;
    pan.x = vpW / 2 - boardX * zoom;
    pan.y = vpH / 2 - boardY * zoom;
    applyTransform();
    scheduleMinimap();
  });
}

// Screen → canvas coordinate conversion.
// boardWrap has position:fixed; left:0; top:0 – no getBoundingClientRect needed.
export function toCanvas(clientX, clientY) {
  return { x: (clientX - pan.x) / zoom, y: (clientY - pan.y) / zoom };
}

export function applyTransform(checkVisible = false) {
  const tf = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  canvas.style.transform          = tf;
  canvas.style.transformOrigin    = '0 0';
  threadSvg.style.transform       = tf;
  threadSvg.style.transformOrigin = '0 0';
  if (checkVisible) checkCardsVisible();
}

export function checkCardsVisible() {
  if (!state.cards.length) return;
  const anyVisible = state.cards.some(c => {
    const sx = c.x * zoom + pan.x;
    const sy = c.y * zoom + pan.y;
    return sx > -200 && sx < vpW + 200 && sy > -200 && sy < vpH + 200;
  });
  let btn = document.getElementById('back-to-cards');
  if (!anyVisible) {
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'back-to-cards';
      btn.textContent = t('btn.backToCards');
      btn.onclick = fitToCards;
      document.body.appendChild(btn);
    }
    btn.style.display = 'block';
  } else if (btn) {
    btn.style.display = 'none';
  }
}

export function fitToCards() {
  if (!state.cards.length) { resetView(); return; }
  const xs = state.cards.map(c => c.x);
  const ys = state.cards.map(c => c.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs) + 200;
  const minY = Math.min(...ys), maxY = Math.max(...ys) + 200;
  const scaleX = vpW / (maxX - minX);
  const scaleY = vpH / (maxY - minY);
  zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(scaleX, scaleY) * 0.85));
  pan.x = (vpW - (maxX - minX) * zoom) / 2 - minX * zoom;
  pan.y = (vpH - (maxY - minY) * zoom) / 2 - minY * zoom;
  applyTransform(true);
  scheduleMinimap();
  const btn = document.getElementById('back-to-cards');
  if (btn) btn.style.display = 'none';
}

// Export pan/zoom for carousel drag-and-drop (index.html reads this directly)
export function getPanZoom() { return { panX: pan.x, panY: pan.y, zoom }; }

export function resetView() {
  pan.x = 0; pan.y = 0; zoom = 1;
  applyTransform(true);
  scheduleMinimap();
}

export function zoomIn() {
  const mx = vpW / 2, my = vpH / 2;
  const newZoom = Math.min(ZOOM_MAX, +(zoom + ZOOM_STEP).toFixed(2));
  if (newZoom === zoom) return;
  pan.x = mx - (mx - pan.x) * (newZoom / zoom);
  pan.y = my - (my - pan.y) * (newZoom / zoom);
  zoom = newZoom;
  applyTransform(true); scheduleMinimap();
}

export function zoomOut() {
  const mx = vpW / 2, my = vpH / 2;
  const newZoom = Math.max(ZOOM_MIN, +(zoom - ZOOM_STEP).toFixed(2));
  if (newZoom === zoom) return;
  pan.x = mx - (mx - pan.x) * (newZoom / zoom);
  pan.y = my - (my - pan.y) * (newZoom / zoom);
  zoom = newZoom;
  applyTransform(true); scheduleMinimap();
}

// Zoom centered on an arbitrary screen point (used by the mouse-wheel handler).
export function zoomAt(newZoom, clientX, clientY) {
  pan.x = clientX - (clientX - pan.x) * (newZoom / zoom);
  pan.y = clientY - (clientY - pan.y) * (newZoom / zoom);
  zoom = newZoom;
}

let minimapTimer = null;
export function scheduleMinimap() {
  clearTimeout(minimapTimer);
  minimapTimer = setTimeout(() => {
    if (!minimap) return;
    // Dynamic bounding box – accounts for cards far from the center
    const xs = state.cards.map(c => c.x).concat([0, vpW]);
    const ys = state.cards.map(c => c.y).concat([0, vpH]);
    lastBoardW = Math.max(1800, Math.max(...xs) + 300);
    lastBoardH = Math.max(900,  Math.max(...ys) + 200);
    minimap.update(state.cards, state.pins, state.threads, pan, zoom, lastBoardW, lastBoardH, vpW, vpH);
  }, 80);
}
