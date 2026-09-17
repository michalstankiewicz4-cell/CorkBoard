// png-export-dom.js – the DOM save/measure/restore dance around export.js's
// exportPNG(), which needs the board temporarily laid out as one
// un-transformed, un-clipped block for html2canvas to capture.

import { state } from './state.js';
import { boardWrap, canvas, threadSvg } from './dom.js';
import { renderAllThreads } from './threads.js';
import { getVisibleThreads, renderVisibleThreadsNow } from './board-render.js';
import { exportPNG, saveToHash } from './export.js';
import { t } from './i18n.js';

export async function doExportPNG() {
  const MARGIN = 80, CARD_W = 210, CARD_H = 270;
  let minX = 0, minY = 0, maxX = 800, maxY = 600;
  if (state.cards.length > 0) {
    minX = Math.min(...state.cards.map(c => c.x)) - MARGIN;
    minY = Math.min(...state.cards.map(c => c.y)) - MARGIN;
    maxX = Math.max(...state.cards.map(c => c.x + CARD_W)) + MARGIN;
    maxY = Math.max(...state.cards.map(c => c.y + CARD_H)) + MARGIN;
  }
  const contentW = Math.max(maxX - minX, 400);
  const contentH = Math.max(maxY - minY, 300);

  // Save board-wrap styles and transforms
  const savedBW = { position: boardWrap.style.position, width: boardWrap.style.width, height: boardWrap.style.height,
                    top: boardWrap.style.top, left: boardWrap.style.left, overflow: boardWrap.style.overflow };
  const savedCanvasT  = canvas.style.transform;
  const savedSvgT     = threadSvg.style.transform;

  // Save card and pin DOM positions
  const cardEls = [...canvas.querySelectorAll('.card')];
  const pinEls  = [...canvas.querySelectorAll('.pin')];
  const savedCards      = cardEls.map(el => ({ left: el.style.left, top: el.style.top }));
  const savedPins       = pinEls.map( el => ({ left: el.style.left, top: el.style.top }));
  const savedCardShadow = cardEls.map(el => el.style.boxShadow);

  // Hide fixed overlays
  const overlayIds = ['board-frame', 'minimap-wrap', 'left-panel', 'carousel-wrap', 'help-panel', 'back-to-cards'];
  const overlays = overlayIds.map(id => document.getElementById(id)).filter(Boolean);
  const savedDisplay = overlays.map(el => el.style.display);
  let suppressAfterStyle = null;

  try {
    // Shift cards and pins by (-minX, -minY) directly in DOM (no CSS transform)
    cardEls.forEach(el => {
      const c = state.cards.find(c2 => c2.id === el.dataset.id);
      if (c) { el.style.left = (c.x - minX) + 'px'; el.style.top = (c.y - minY) + 'px'; }
    });
    const adjustedPins = state.pins.map(p => ({ ...p, x: p.x - minX, y: p.y - minY }));
    pinEls.forEach(el => {
      const p = adjustedPins.find(p2 => p2.id === el.dataset.id);
      if (p) { el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; }
    });

    // Clear transforms (positions already adjusted)
    canvas.style.transform    = '';
    threadSvg.style.transform = '';

    // Re-render threads with adjusted coordinates (no SVG transform)
    renderAllThreads(threadSvg, getVisibleThreads(), adjustedPins, null);

    // Size board-wrap to fit content exactly
    boardWrap.style.position = 'absolute';
    boardWrap.style.width    = contentW + 'px';
    boardWrap.style.height   = contentH + 'px';
    boardWrap.style.top      = '0';
    boardWrap.style.left     = '0';
    // 'visible' instead of 'hidden' – html2canvas clips box-shadow children at overflow:hidden
    boardWrap.style.overflow = 'visible';

    // html2canvas renders board-wrap::after box-shadow inconsistently (top/left only)
    // – disable the pseudo-element, redraw the frame manually in exportPNG
    // Suppress ::after and board-wrap box-shadow — both are redrawn manually in exportPNG
    suppressAfterStyle = document.createElement('style');
    suppressAfterStyle.textContent = '#board-wrap::after { display: none !important; } #board-wrap { box-shadow: none !important; }';
    document.head.appendChild(suppressAfterStyle);

    // Disable box-shadow – redrawn manually in exportPNG
    cardEls.forEach(el => { el.style.boxShadow = 'none'; });

    overlays.forEach(el => { el.style.display = 'none'; });
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    saveToHash(state);
    await exportPNG(boardWrap, contentW, contentH);
  } catch (e) {
    alert(t('alert.exportFailed') + e.message);
  } finally {
    // Restore card positions, pin positions, and box-shadows
    cardEls.forEach((el, i) => { el.style.left = savedCards[i].left; el.style.top = savedCards[i].top; el.style.boxShadow = savedCardShadow[i]; });
    pinEls.forEach( (el, i) => { el.style.left = savedPins[i].left;  el.style.top = savedPins[i].top;  });
    // Restore transforms and threads
    canvas.style.transform    = savedCanvasT;
    threadSvg.style.transform = savedSvgT;
    renderVisibleThreadsNow();
    // Restore board-wrap
    boardWrap.style.position = savedBW.position;
    boardWrap.style.width    = savedBW.width;
    boardWrap.style.height   = savedBW.height;
    boardWrap.style.top      = savedBW.top;
    boardWrap.style.left     = savedBW.left;
    boardWrap.style.overflow = savedBW.overflow;
    // Restore board-wrap::after and overlays
    if (suppressAfterStyle?.parentNode) document.head.removeChild(suppressAfterStyle);
    overlays.forEach((el, i) => { el.style.display = savedDisplay[i]; });
  }
}
