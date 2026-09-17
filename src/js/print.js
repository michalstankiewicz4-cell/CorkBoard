// print.js – lay the board out as one flat, untransformed block for the
// browser's native print dialog (Ctrl+P), then restore it afterwards.
// Import this module once (for its side effect of registering the
// beforeprint/afterprint listeners) — it has no exports.

import { state } from './state.js';
import { boardWrap, canvas, threadSvg } from './dom.js';
import { renderAllThreads } from './threads.js';
import { getVisibleThreads, renderVisibleThreadsNow } from './board-render.js';
import { scheduleMinimap } from './viewport.js';

let savedBoardWrap = null, savedCanvasTransform = null, savedSvgTransform = null;

window.addEventListener('beforeprint', () => {
  if (savedBoardWrap !== null) return; // re-entrancy guard (Chromium re-fires on settings change)
  if (!state.cards.length) return;
  const CARD_W = 220, CARD_H = 180, MARGIN = 30;
  const minX = Math.min(...state.cards.map(c => c.x)) - MARGIN;
  const minY = Math.min(...state.cards.map(c => c.y)) - MARGIN;
  const maxX = Math.max(...state.cards.map(c => c.x + CARD_W)) + MARGIN;
  const maxY = Math.max(...state.cards.map(c => c.y + CARD_H)) + MARGIN;
  const contentW = Math.max(maxX - minX, 400);
  const contentH = Math.max(maxY - minY, 300);

  savedBoardWrap = { position: boardWrap.style.position, width: boardWrap.style.width,
                     height: boardWrap.style.height, top: boardWrap.style.top,
                     left: boardWrap.style.left, overflow: boardWrap.style.overflow };
  savedCanvasTransform = canvas.style.transform;
  savedSvgTransform    = threadSvg.style.transform;

  canvas.querySelectorAll('.card').forEach(el => {
    const c = state.cards.find(c2 => c2.id === el.dataset.id);
    if (c) { el.style.left = (c.x - minX) + 'px'; el.style.top = (c.y - minY) + 'px'; }
  });
  const adjPins = state.pins.map(p => ({ ...p, x: p.x - minX, y: p.y - minY }));
  canvas.querySelectorAll('.pin').forEach(el => {
    const p = adjPins.find(p2 => p2.id === el.dataset.id);
    if (p) { el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; }
  });

  canvas.style.transform    = '';
  threadSvg.style.transform = '';
  // Temporarily clear card filter so all threads print
  const savedFilter = state.filterCardId;
  state.filterCardId = null;
  renderAllThreads(threadSvg, getVisibleThreads(), adjPins, null);
  state.filterCardId = savedFilter;

  boardWrap.style.position = 'absolute';
  boardWrap.style.width    = contentW + 'px';
  boardWrap.style.height   = contentH + 'px';
  boardWrap.style.top      = '0';
  boardWrap.style.left     = '0';
  boardWrap.style.overflow = 'visible';
});

window.addEventListener('afterprint', () => {
  if (!savedBoardWrap) return;
  Object.assign(boardWrap.style, savedBoardWrap);
  // Restore by card ID from state — avoids index mismatch if DOM changed
  canvas.querySelectorAll('.card').forEach(el => {
    const c = state.cards.find(c2 => c2.id === el.dataset.id);
    if (c) { el.style.left = c.x + 'px'; el.style.top = c.y + 'px'; }
  });
  canvas.querySelectorAll('.pin').forEach(el => {
    const p = state.pins.find(p2 => p2.id === el.dataset.id);
    if (p) { el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; }
  });
  canvas.style.transform    = savedCanvasTransform;
  threadSvg.style.transform = savedSvgTransform;
  renderVisibleThreadsNow();
  scheduleMinimap();
  savedBoardWrap = null;
});
