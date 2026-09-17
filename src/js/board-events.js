// board-events.js – mouse/keyboard/wheel input handling: panning, card
// dragging, multi-select, thread drawing, and their keyboard shortcuts.

import { state } from './state.js';
import { boardWrap, threadSvg } from './dom.js';
import { drawTempThread, removeTempThread } from './threads.js';
import {
  pan, zoom, toCanvas, applyTransform, checkCardsVisible,
  zoomAt, zoomBounds, resetView, scheduleMinimap,
} from './viewport.js';
import { pushHistory, undo, redo } from './history.js';
import { save } from './persist.js';
import { addCard, deleteCard, selectCard, syncPinsOfCard, getSelectedCardId } from './card-actions.js';
import { addPinToCard, addPinAtPosition, deletePin } from './pin-actions.js';
import { addThread } from './thread-actions.js';
import { setTool } from './tools.js';
import { hidePinColorPicker, hideThreadColorPicker } from './color-pickers.js';
import { hideModal, openEditModal } from './modal.js';
import { onContextMenu, hideCtxMenu } from './context-menu.js';
import { renderVisibleThreadsNow, scheduleThreadRender, clearFilter } from './board-render.js';

let dragging      = null;
let threadStart   = null;
let panning       = null;
let multiSelected    = new Set();
let multiDragOffsets = null;

export function bindEvents() {
  boardWrap.addEventListener('mousedown', onMouseDown);
  boardWrap.addEventListener('mousedown', onMiddleDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup',   onMouseUp);
  boardWrap.addEventListener('auxclick', e => e.preventDefault());
  boardWrap.addEventListener('wheel', onWheel, { passive: false });
  boardWrap.addEventListener('contextmenu', onContextMenu);
  boardWrap.addEventListener('dblclick', onDblClick);
  document.addEventListener('click', e => {
    if (!document.getElementById('ctx-menu').contains(e.target)) hideCtxMenu();
  });
  document.addEventListener('keydown', onKeyDown);
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    hideModal(); hideCtxMenu();
    clearFilter();
    clearMultiSelected();
    hidePinColorPicker(); hideThreadColorPicker();
    document.querySelectorAll('.lp-drop.open').forEach(el => el.classList.remove('open'));
    document.getElementById('help-panel')?.classList.remove('open');
    document.getElementById('options-overlay')?.classList.remove('open');
    if (state.tool !== 'select') { setTool('select'); window.setToolUI?.('select'); }
  }
  if ((e.key === 'Delete' || e.key === 'Backspace')
      && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
    if (multiSelected.size > 0) {
      pushHistory();
      [...multiSelected].forEach(id => {
        state.pins.filter(p => p.cardId === id).forEach(p => {
          state.threads = state.threads.filter(th => th.fromPin !== p.id && th.toPin !== p.id);
          document.querySelector(`.pin[data-id="${p.id}"]`)?.remove();
        });
        state.pins  = state.pins.filter(p => p.cardId !== id);
        state.cards = state.cards.filter(c => c.id !== id);
        document.querySelector(`.card[data-id="${id}"]`)?.remove();
        if (state.filterCardId === id) state.filterCardId = null;
      });
      multiSelected.clear();
      renderVisibleThreadsNow();
      save(); scheduleMinimap();
    } else if (getSelectedCardId()) {
      deleteCard(getSelectedCardId());
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey
      && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
    e.preventDefault(); undo();
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))
      && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
    e.preventDefault(); redo();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '0') resetView();
}

function onMouseDown(e) {
  if (e.button !== 0) return;
  const pin  = e.target.closest('.pin');
  const card = e.target.closest('.card');

  if (state.tool === 'thread' && pin) {
    const { x, y } = pinCanvasPos(pin);
    threadStart = { pinId: pin.dataset.id, x, y };
    e.preventDefault(); return;
  }
  if (state.tool === 'pin') {
    if (card)      addPinToCard(card.dataset.id);
    else if (!pin) { const { x, y } = toCanvas(e.clientX, e.clientY); addPinAtPosition(x, y); }
    setTool('select');
    window.setToolUI?.('select');
    e.preventDefault(); return;
  }
  if (state.tool === 'delete') {
    if (pin)  { deletePin(pin.dataset.id);   return; }
    if (card) { deleteCard(card.dataset.id); return; }
    return;
  }
  if (card) {
    const cid = card.dataset.id;

    // Shift+click → toggle multi-select
    if (e.shiftKey && state.tool === 'select') {
      // On first Shift+click, pull current selected card into the set
      if (multiSelected.size === 0 && getSelectedCardId()) {
        multiSelected.add(getSelectedCardId());
        document.querySelector(`.card[data-id="${getSelectedCardId()}"]`)?.classList.add('multi-selected');
      }
      if (multiSelected.has(cid)) { multiSelected.delete(cid); card.classList.remove('multi-selected'); }
      else                        { multiSelected.add(cid);    card.classList.add('multi-selected');    }
      e.preventDefault(); return;
    }

    // Click on selected card → drag all selected cards together
    if (multiSelected.size > 0 && multiSelected.has(cid) && state.tool === 'select') {
      pushHistory();
      const { x: mx, y: my } = toCanvas(e.clientX, e.clientY);
      multiDragOffsets = new Map();
      multiSelected.forEach(id => {
        const c  = state.cards.find(c2 => c2.id === id);
        const el = document.querySelector(`.card[data-id="${id}"]`);
        if (c && el) {
          multiDragOffsets.set(id, { dx: c.x - mx, dy: c.y - my, card: c, el, cardW: el.offsetWidth });
          el.classList.add('dragging');
        }
      });
      document.body.classList.add('card-dragging');
      e.preventDefault(); return;
    }

    // Regular click without Shift → clear multi-select, normal drag
    if (multiSelected.size > 0) clearMultiSelected();
    pushHistory();
    const cardRect  = card.getBoundingClientRect();
    const cardData  = state.cards.find(c => c.id === cid);
    const pinnedPin = state.pins.find(p => p.cardId === cid) || null;
    const hasThreads = pinnedPin
      ? state.threads.some(th => th.fromPin === pinnedPin.id || th.toPin === pinnedPin.id)
      : false;
    dragging = {
      cardId:     cid,
      el:         card,
      card:       cardData,
      cardW:      card.offsetWidth,
      offsetX:    (e.clientX - cardRect.left) / zoom,
      offsetY:    (e.clientY - cardRect.top)  / zoom,
      pin:        pinnedPin,
      pinEl:      pinnedPin ? document.querySelector(`.pin[data-id="${pinnedPin.id}"]`) : null,
      hasThreads,
    };
    card.classList.add('dragging');
    document.body.classList.add('card-dragging');
    selectCard(cid);
    e.preventDefault();
  } else if (!pin && e.button === 0 && state.tool === 'select') {
    clearMultiSelected();
    panning = { startX: e.clientX, startY: e.clientY, panX0: pan.x, panY0: pan.y };
    document.body.classList.add('is-panning');
    boardWrap.style.cursor = 'grabbing';
    e.preventDefault();
  }
}

function onMiddleDown(e) {
  if (e.button !== 1) return;
  e.preventDefault(); // block browser autoscroll
}

let moveRafId = null;
let lastMoveX = 0, lastMoveY = 0;

function onMouseMove(e) {
  if (!panning && !dragging && !multiDragOffsets && !threadStart) return;
  lastMoveX = e.clientX; lastMoveY = e.clientY;
  if (moveRafId) return;
  moveRafId = requestAnimationFrame(applyMove);
}

function applyMove() {
  moveRafId = null;
  if (panning) {
    pan.x = panning.panX0 + (lastMoveX - panning.startX);
    pan.y = panning.panY0 + (lastMoveY - panning.startY);
    applyTransform();
    scheduleMinimap();
    return;
  }
  if (multiDragOffsets) {
    const { x, y } = toCanvas(lastMoveX, lastMoveY);
    multiDragOffsets.forEach((off, cid) => {
      off.card.x = x + off.dx;
      off.card.y = y + off.dy;
      off.el.style.left = off.card.x + 'px'; off.el.style.top = off.card.y + 'px';
      syncPinsOfCard(cid, off.card, off.cardW);
    });
    scheduleThreadRender();
    return;
  }
  if (dragging) {
    const { x: cx, y: cy } = toCanvas(lastMoveX, lastMoveY);
    const x = cx - dragging.offsetX;
    const y = cy - dragging.offsetY;
    dragging.card.x = x; dragging.card.y = y;
    dragging.el.style.left = x + 'px'; dragging.el.style.top = y + 'px';
    if (dragging.pin) {
      const px = x + dragging.cardW / 2, py = y + 4;
      dragging.pin.x = px; dragging.pin.y = py;
      if (dragging.pinEl) { dragging.pinEl.style.left = px + 'px'; dragging.pinEl.style.top = py + 'px'; }
    }
    if (dragging.hasThreads) scheduleThreadRender();
    return;
  }
  if (threadStart) {
    const { x, y } = toCanvas(lastMoveX, lastMoveY);
    drawTempThread(threadSvg, threadStart.x, threadStart.y, x, y, state.selectedThreadColor);
  }
}

function onMouseUp(e) {
  if (moveRafId) { cancelAnimationFrame(moveRafId); moveRafId = null; applyMove(); }
  if (panning) { panning = null; document.body.classList.remove('is-panning'); boardWrap.style.cursor = ''; checkCardsVisible(); return; }
  if (multiDragOffsets) {
    multiDragOffsets.forEach(off => off.el.classList.remove('dragging'));
    multiDragOffsets = null;
    document.body.classList.remove('card-dragging');
    save(); scheduleMinimap(); return;
  }
  if (dragging) {
    dragging.el.classList.remove('dragging');
    document.body.classList.remove('card-dragging');
    dragging = null;
    save();
    scheduleMinimap();
    return;
  }
  if (threadStart) {
    removeTempThread(threadSvg);
    const pin = e.target.closest('.pin');
    if (pin && pin.dataset.id !== threadStart.pinId) addThread(threadStart.pinId, pin.dataset.id);
    threadStart = null;
  }
}

function onDblClick(e) {
  const card = e.target.closest('.card');
  if (card) { openEditModal(card.dataset.id); return; }
  // Double-click on empty board = quick note
  const { x, y } = toCanvas(e.clientX, e.clientY);
  const id = addCard('note', { text: '', color: state.selectedNoteColor }, x, y);
  setTimeout(() => openEditModal(id), 80);
}

let wheelRafId = null;
function onWheel(e) {
  e.preventDefault();
  const { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } = zoomBounds();
  const delta   = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
  const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(zoom + delta).toFixed(2)));
  if (newZoom === zoom) return;
  // Math accumulates synchronously; DOM write deferred to one RAF
  zoomAt(newZoom, e.clientX, e.clientY);
  if (wheelRafId) return;
  wheelRafId = requestAnimationFrame(() => {
    wheelRafId = null;
    applyTransform(true);
    scheduleMinimap();
  });
}

// ── Helpers ──────────────────────────────────────────────
function pinCanvasPos(pinEl) {
  const pr = pinEl.getBoundingClientRect();
  return toCanvas(pr.left + pr.width / 2, pr.top + pr.height / 2);
}

function clearMultiSelected() {
  multiSelected.forEach(cid => {
    document.querySelector(`.card[data-id="${cid}"]`)?.classList.remove('multi-selected');
  });
  multiSelected.clear();
}
