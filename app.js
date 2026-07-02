// app.js – main application logic

import { createCardElement, updateCardElement, renderPinSvg, PIN_COLORS, NOTE_COLORS, esc } from './cards.js';
import { renderAllThreads, drawTempThread, removeTempThread, buildPinMap } from './threads.js';
import { computeViewPositions } from './views.js';
import { saveState, loadState } from './storage.js';
import { SAMPLE_DATA } from './data-sample.js';
import { Minimap } from './minimap.js';
import { exportJSON, importJSON, exportPNG, importPNG, saveToHash, loadFromHash } from './export.js';
import { t } from './i18n.js';

// ── State ────────────────────────────────────────────────
let state = {
  cards: [], pins: [], threads: [],
  nextId: 1, currentView: 'basic',
  selectedPinColor: 'red',
  selectedThreadColor: 'r', selectedThreadColor2: 'w',
  selectedThreadStriped: false, selectedThreadWidth: 1.8,
  selectedNoteColor: 'y',
  tool: 'select',
  filterCardId: null,
  groups: [],
};

// ── DOM ─────────────────────────────────────────────────
const boardWrap    = document.getElementById('board-wrap');
const canvas       = document.getElementById('canvas');
const threadSvg    = document.getElementById('thread-svg');
const ctxMenu      = document.getElementById('ctx-menu');
const modalOverlay = document.getElementById('modal-overlay');
const modal        = document.getElementById('modal');

let dragging      = null;
let threadStart   = null;
let selectedCardId= null;
let contextTarget = null;

let multiSelected    = new Set();
let multiDragOffsets = null;

// Pan + Zoom
let pan    = { x: 0, y: 0 };
let zoom   = 1.0;
const ZOOM_MIN = 0.25, ZOOM_MAX = 4.0, ZOOM_STEP = 0.1;
let panning = null;

// Viewport cache (updated by ResizeObserver – avoids clientWidth in RAF)
let vpW = window.innerWidth, vpH = window.innerHeight;

// Minimap
let minimap = null;
let lastBoardW = 1800, lastBoardH = 900;

// ── Import Notes state ────────────────────────────────────
const IN = { img: null, scale: 1, selections: [], nextId: 1, drawing: null, mode: 'image' };
let _tesseractPromise = null;

// Undo / Redo
const MAX_HISTORY = 50;
const undoStack = [];
const redoStack = [];

// Screen → canvas coordinate conversion
// boardWrap has position:fixed; left:0; top:0 – no getBoundingClientRect needed
function toCanvas(clientX, clientY) {
  return {
    x: (clientX - pan.x) / zoom,
    y: (clientY - pan.y) / zoom,
  };
}

// ── Init ────────────────────────────────────────────────
export function init() {
  // Load order: hash → localStorage → sample data
  const fromHash = loadFromHash();
  const saved    = loadState();
  if (fromHash && fromHash.cards.length) {
    state = { ...state, ...fromHash };
    state.nextId = maxIdFromData(fromHash);
    history.replaceState(null, '', location.pathname + location.search);
  } else if (saved && saved.cards && saved.cards.length) {
    state = { ...state, ...saved };
    if (!state.groups) state.groups = [];
  } else {
    state.cards   = SAMPLE_DATA.cards.map(c => ({...c, data:{...c.data}}));
    state.pins    = SAMPLE_DATA.pins.map(p => ({...p}));
    state.threads = SAMPLE_DATA.threads.map(th => ({...th}));
    state.nextId  = 300;
  }

  const mmEl = document.getElementById('minimap-container');
  if (mmEl) {
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

  renderAll();
  bindEvents();
  updateViewBtns();
  updateToolBtns();
  scheduleMinimap();
}

// ── Render ──────────────────────────────────────────────
function renderAll() {
  canvas.querySelectorAll('.card, .pin').forEach(el => el.remove());
  [...threadSvg.querySelectorAll('.thread-group')].forEach(el => el.remove());

  const connectedSet = state.filterCardId ? getConnectedCards(state.filterCardId) : null;
  if (connectedSet && state.filterCardId) connectedSet.add(state.filterCardId);
  const visible = connectedSet
    ? state.cards.filter(c => connectedSet.has(c.id))
    : state.cards;
  visible.forEach(card => canvas.appendChild(createCardElement(card)));
  state.pins.forEach(pin => {
    const card = state.cards.find(c => c.id === pin.cardId);
    if (!card || visible.includes(card)) canvas.appendChild(makePinEl(pin));
  });
  // Threads with pre-built pinMap
  const pinMap = buildPinMap(state.pins);
  const visThreads = getVisibleThreadsWithMap(connectedSet, pinMap);
  renderAllThreads(threadSvg, visThreads, state.pins, onThreadClick);
}

function makePinEl(pin) {
  const el = document.createElement('div');
  el.className = 'pin';
  el.dataset.id = pin.id;
  el.style.left = pin.x + 'px';
  el.style.top  = pin.y + 'px';
  el.innerHTML  = renderPinSvg(pin.color);
  return el;
}

// Visibility filtering
function getVisibleThreads() {
  const connected = state.filterCardId ? getConnectedCards(state.filterCardId) : null;
  if (connected && state.filterCardId) connected.add(state.filterCardId);
  return getVisibleThreadsWithMap(connected, buildPinMap(state.pins));
}

function getVisibleThreadsWithMap(connectedSet, pinMap) {
  if (!connectedSet) return state.threads;
  return state.threads.filter(th => {
    const a = pinMap[th.fromPin]?.cardId;
    const b = pinMap[th.toPin]?.cardId;
    return connectedSet.has(a) || connectedSet.has(b);
  });
}

function getConnectedCards(cardId, depth = 3) {
  const pinMap = buildPinMap(state.pins);
  const cardPins = {};
  state.pins.forEach(p => {
    if (!cardPins[p.cardId]) cardPins[p.cardId] = [];
    cardPins[p.cardId].push(p.id);
  });
  const visited = new Set();
  const queue   = [cardId];
  for (let d = 0; d < depth && queue.length; d++) {
    const next = [];
    queue.forEach(cid => {
      if (visited.has(cid)) return;
      visited.add(cid);
      (cardPins[cid] || []).forEach(pid => {
        state.threads.forEach(th => {
          const other = th.fromPin === pid ? pinMap[th.toPin]?.cardId
                      : th.toPin   === pid ? pinMap[th.fromPin]?.cardId
                      : null;
          if (other && !visited.has(other)) next.push(other);
        });
      });
    });
    queue.length = 0;
    queue.push(...next);
  }
  return visited;
}

// ── Events ──────────────────────────────────────────────
function bindEvents() {
  new ResizeObserver(([e]) => { vpW = e.contentRect.width; vpH = e.contentRect.height; }).observe(boardWrap);
  boardWrap.addEventListener('mousedown', onMouseDown);
  boardWrap.addEventListener('mousedown', onMiddleDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup',   onMouseUp);
  boardWrap.addEventListener('auxclick', e => e.preventDefault());
  boardWrap.addEventListener('wheel', onWheel, { passive: false });
  boardWrap.addEventListener('contextmenu', onContextMenu);
  boardWrap.addEventListener('dblclick', onDblClick);
  document.addEventListener('click', e => {
    if (!ctxMenu.contains(e.target)) hideCtxMenu();
  });
  document.addEventListener('keydown', e => {
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
            canvas.querySelector(`.pin[data-id="${p.id}"]`)?.remove();
          });
          state.pins  = state.pins.filter(p => p.cardId !== id);
          state.cards = state.cards.filter(c => c.id !== id);
          canvas.querySelector(`.card[data-id="${id}"]`)?.remove();
          if (selectedCardId     === id) selectedCardId     = null;
          if (state.filterCardId === id) state.filterCardId = null;
        });
        multiSelected.clear();
        renderAllThreads(threadSvg, getVisibleThreads(), state.pins, onThreadClick);
        save(); scheduleMinimap();
      } else if (selectedCardId) {
        deleteCard(selectedCardId);
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
  });
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
      if (multiSelected.size === 0 && selectedCardId) {
        multiSelected.add(selectedCardId);
        canvas.querySelector(`.card[data-id="${selectedCardId}"]`)?.classList.add('multi-selected');
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
        const c  = state.cards.find(c => c.id === id);
        const el = canvas.querySelector(`.card[data-id="${id}"]`);
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
      pinEl:      pinnedPin ? canvas.querySelector(`.pin[data-id="${pinnedPin.id}"]`) : null,
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
  const delta   = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
  const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(zoom + delta).toFixed(2)));
  if (newZoom === zoom) return;
  // Math accumulates synchronously; DOM write deferred to one RAF
  pan.x = e.clientX - (e.clientX - pan.x) * (newZoom / zoom);
  pan.y = e.clientY - (e.clientY - pan.y) * (newZoom / zoom);
  zoom  = newZoom;
  if (wheelRafId) return;
  wheelRafId = requestAnimationFrame(() => {
    wheelRafId = null;
    applyTransform(true);
    scheduleMinimap();
  });
}

function onContextMenu(e) {
  e.preventDefault();
  const pin  = e.target.closest('.pin');
  const card = e.target.closest('.card');
  if (!pin && !card) return;
  contextTarget = pin
    ? { type: 'pin',  id: pin.dataset.id }
    : { type: 'card', id: card.dataset.id };
  showCtxMenu(e.clientX, e.clientY);
}

function onThreadClick(threadId) {
  if (state.tool !== 'delete') {
    openThreadEditModal(threadId);
  } else {
    deleteThread(threadId);
  }
}

// ── Transform ────────────────────────────────────────────
function applyTransform(checkVisible = false) {
  const tf = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  canvas.style.transform          = tf;
  canvas.style.transformOrigin    = '0 0';
  threadSvg.style.transform       = tf;
  threadSvg.style.transformOrigin = '0 0';
  if (checkVisible) checkCardsVisible();
}

let rafThreadId = null;
function scheduleThreadRender() {
  if (rafThreadId) return;
  rafThreadId = requestAnimationFrame(() => {
    rafThreadId = null;
    renderAllThreads(threadSvg, getVisibleThreads(), state.pins, onThreadClick);
  });
}

function checkCardsVisible() {
  if (!state.cards.length) return;
  const bw = vpW, bh = vpH;
  const anyVisible = state.cards.some(c => {
    const sx = c.x * zoom + pan.x;
    const sy = c.y * zoom + pan.y;
    return sx > -200 && sx < bw + 200 && sy > -200 && sy < bh + 200;
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

function fitToCards() {
  if (!state.cards.length) { resetView(); return; }
  const bw = vpW, bh = vpH;
  const xs = state.cards.map(c => c.x);
  const ys = state.cards.map(c => c.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs) + 200;
  const minY = Math.min(...ys), maxY = Math.max(...ys) + 200;
  const scaleX = bw / (maxX - minX);
  const scaleY = bh / (maxY - minY);
  zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(scaleX, scaleY) * 0.85));
  pan.x = (bw - (maxX - minX) * zoom) / 2 - minX * zoom;
  pan.y = (bh - (maxY - minY) * zoom) / 2 - minY * zoom;
  applyTransform(true);
  scheduleMinimap();
  const btn = document.getElementById('back-to-cards');
  if (btn) btn.style.display = 'none';
}

// Export pan/zoom for carousel drag-and-drop
export function getPanZoom() { return { panX: pan.x, panY: pan.y, zoom }; }

export function resetView() {
  pan = { x: 0, y: 0 }; zoom = 1;
  applyTransform(true);
  scheduleMinimap();
}

export function zoomIn() {
  const bw = vpW, bh = vpH;
  const mx = bw / 2, my = bh / 2;
  const newZoom = Math.min(ZOOM_MAX, +(zoom + ZOOM_STEP).toFixed(2));
  if (newZoom === zoom) return;
  pan.x = mx - (mx - pan.x) * (newZoom / zoom);
  pan.y = my - (my - pan.y) * (newZoom / zoom);
  zoom = newZoom;
  applyTransform(true); scheduleMinimap();
}

export function zoomOut() {
  const bw = vpW, bh = vpH;
  const mx = bw / 2, my = bh / 2;
  const newZoom = Math.max(ZOOM_MIN, +(zoom - ZOOM_STEP).toFixed(2));
  if (newZoom === zoom) return;
  pan.x = mx - (mx - pan.x) * (newZoom / zoom);
  pan.y = my - (my - pan.y) * (newZoom / zoom);
  zoom = newZoom;
  applyTransform(true); scheduleMinimap();
}

// ── Helpers ──────────────────────────────────────────────
function pinCanvasPos(pinEl) {
  const pr = pinEl.getBoundingClientRect();
  return toCanvas(pr.left + pr.width / 2, pr.top + pr.height / 2);
}

function syncPinsOfCard(cardId, cardData, cardW) {
  // cardData and cardW may come from dragging cache (avoids querySelector/getBoundingClientRect)
  const card = cardData || state.cards.find(c => c.id === cardId);
  if (!card) return;
  const w = cardW ?? (() => {
    const el = canvas.querySelector(`.card[data-id="${cardId}"]`);
    return el ? el.offsetWidth : 0;
  })();
  const cx = card.x + w / 2;
  const cy = card.y + 4;
  state.pins.filter(p => p.cardId === cardId).forEach(pin => {
    pin.x = cx; pin.y = cy;
    const pel = canvas.querySelector(`.pin[data-id="${pin.id}"]`);
    if (pel) { pel.style.left = cx + 'px'; pel.style.top = cy + 'px'; }
  });
}

function snapState() {
  return JSON.parse(JSON.stringify({
    cards: state.cards, pins: state.pins, threads: state.threads,
    groups: state.groups, nextId: state.nextId,
  }));
}
function pushHistory() {
  undoStack.push(snapState());
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
}
function applySnap(snap) {
  state.cards   = snap.cards;
  state.pins    = snap.pins;
  state.threads = snap.threads;
  state.groups  = snap.groups;
  state.nextId  = snap.nextId;
  renderAll(); save(); scheduleMinimap();
}
export function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapState());
  applySnap(undoStack.pop());
}
export function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapState());
  applySnap(redoStack.pop());
}

let minimapTimer = null;
function scheduleMinimap() {
  clearTimeout(minimapTimer);
  minimapTimer = setTimeout(() => {
    if (!minimap) return;
    const bw = vpW, bh = vpH;
    // Dynamic bounding box – accounts for cards far from the center
    const xs = state.cards.map(c => c.x).concat([0, bw]);
    const ys = state.cards.map(c => c.y).concat([0, bh]);
    lastBoardW = Math.max(1800, Math.max(...xs) + 300);
    lastBoardH = Math.max(900,  Math.max(...ys) + 200);
    minimap.update(state.cards, state.pins, state.threads, pan, zoom, lastBoardW, lastBoardH, bw, bh);
  }, 80);
}

// ── Cards ────────────────────────────────────────────────
export function addCard(type, data, x, y) {
  pushHistory();
  const id    = 'card-' + (state.nextId++);
  const angle = parseFloat((Math.random() * 12 - 6).toFixed(1));
  x = x ?? 150 + Math.random() * 500;
  y = y ?? 150 + Math.random() * 250;
  const card = { id, type, x, y, angle, data };
  state.cards.push(card);
  canvas.appendChild(createCardElement(card));
  save();
  scheduleMinimap();
  return id;
}

function deleteCard(id) {
  pushHistory();
  state.pins.filter(p => p.cardId === id).map(p => p.id)
    .forEach(pid => deletePin(pid, false));
  state.cards = state.cards.filter(c => c.id !== id);
  canvas.querySelector(`.card[data-id="${id}"]`)?.remove();
  if (selectedCardId === id) selectedCardId = null;
  if (state.filterCardId === id) state.filterCardId = null;
  renderAllThreads(threadSvg, getVisibleThreads(), state.pins, onThreadClick);
  save(); scheduleMinimap();
}

function selectCard(id) {
  if (selectedCardId) canvas.querySelector(`.card[data-id="${selectedCardId}"]`)?.classList.remove('selected');
  selectedCardId = id;
  canvas.querySelector(`.card[data-id="${id}"]`)?.classList.add('selected');
}

// ── Connection filter ────────────────────────────────────
export function filterByCard(cardId) {
  state.filterCardId = state.filterCardId === cardId ? null : cardId;
  renderAll();
}

function clearFilter() {
  if (!state.filterCardId) return;
  state.filterCardId = null;
  renderAll();
}

// ── Multi-select (Shift+click) ───────────────────────────
function clearMultiSelected() {
  multiSelected.forEach(cid => {
    canvas.querySelector(`.card[data-id="${cid}"]`)?.classList.remove('multi-selected');
  });
  multiSelected.clear();
}

window.hideModalUI = hideModal;

// ── Pin color picker (opened from carousel) ──────────────
export function showPinColorPicker(anchorEl) {
  hidePinColorPicker(); hideThreadColorPicker();

  const picker = document.createElement('div');
  picker.id = 'pin-color-picker';
  const swatches = Object.entries(PIN_COLORS).map(([key, val]) => {
    const active = state.selectedPinColor === key ? 'pcp-active' : '';
    return `<div class="pcp-swatch ${active}" data-key="${key}" style="background:${val.head}"></div>`;
  }).join('');
  picker.innerHTML = `<div class="pcp-colors">${swatches}</div>`;

  const ar = anchorEl.getBoundingClientRect();
  picker.style.right     = (window.innerWidth - ar.left + 8) + 'px';
  picker.style.top       = (ar.top + ar.height / 2) + 'px';
  picker.style.transform = 'translateY(-50%)';
  document.body.appendChild(picker);
  picker.addEventListener('click', e => e.stopPropagation());

  picker.querySelectorAll('.pcp-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      state.selectedPinColor = sw.dataset.key;
      setTool('pin');
      window.setToolUI?.('pin');
      hidePinColorPicker();
    });
  });
  setTimeout(() => document.addEventListener('click', hidePinColorPicker, { once: true }), 0);
}

export function hidePinColorPicker() {
  document.getElementById('pin-color-picker')?.remove();
}

// ── Thread color picker (opened from carousel) ───────────
const THREAD_PALETTE = [
  ['r','#e63946'], ['g','#2e7d32'], ['b','#1565c0'],
  ['y','#f9c811'], ['m','#c2185b'], ['c','#0097a7'],
  ['w','#e0e0e0'], ['k','#222222'],
  ['or','#f4511e'], ['pu','#6a1b9a'], ['go','#c8971c'],
];

export function showThreadColorPicker(anchorEl) {
  hideThreadColorPicker(); hidePinColorPicker();

  const mkRow = (sel, row) => THREAD_PALETTE.map(([key, hex]) => {
    const dim = hex === '#e0e0e0' ? ';outline:1px solid #666;outline-offset:-2px' : '';
    return `<div class="pcp-swatch ${sel===key?'pcp-active':''}" data-key="${key}" data-row="${row}" style="background:${hex}${dim}"></div>`;
  }).join('');

  const picker = document.createElement('div');
  picker.id = 'thread-color-picker';
  const WIDTHS = [[1,'—'],[1.8,'━'],[3,'▬'],[5,'█']];
  const mkWidths = () => WIDTHS.map(([w, lbl]) =>
    `<button class="tcp-wbtn${state.selectedThreadWidth==w?' tcp-wbtn-active':''}" data-w="${w}">${lbl}</button>`
  ).join('');

  picker.innerHTML = `
    <div class="tcp-label">${t('tcp.threadColor')}</div>
    <div class="pcp-colors" id="tcp-row1">${mkRow(state.selectedThreadColor, 1)}</div>
    <div class="tcp-row2-hdr">
      <span class="tcp-label">${t('tcp.stripeColor')}</span>
      <label class="tcp-check"><input type="checkbox" id="tcp-striped"${state.selectedThreadStriped?' checked':''}> ${t('tcp.striped')}</label>
    </div>
    <div class="pcp-colors${state.selectedThreadStriped?'':' tcp-dim'}" id="tcp-row2">${mkRow(state.selectedThreadColor2, 2)}</div>
    <div class="tcp-row2-hdr"><span class="tcp-label">${t('tcp.thickness')}</span><div class="tcp-widths" id="tcp-widths">${mkWidths()}</div></div>`;

  const ar = anchorEl.getBoundingClientRect();
  picker.style.right     = (window.innerWidth - ar.left + 8) + 'px';
  picker.style.top       = (ar.top + ar.height / 2) + 'px';
  picker.style.transform = 'translateY(-50%)';
  document.body.appendChild(picker);
  picker.addEventListener('click', e => e.stopPropagation());

  picker.querySelectorAll('[data-row="1"]').forEach(sw => sw.addEventListener('click', () => {
    state.selectedThreadColor = sw.dataset.key;
    picker.querySelectorAll('[data-row="1"]').forEach(s => s.classList.toggle('pcp-active', s === sw));
    activate();
  }));
  picker.querySelectorAll('[data-row="2"]').forEach(sw => sw.addEventListener('click', () => {
    state.selectedThreadColor2 = sw.dataset.key;
    picker.querySelectorAll('[data-row="2"]').forEach(s => s.classList.toggle('pcp-active', s === sw));
    activate();
  }));
  picker.querySelector('#tcp-striped').addEventListener('change', e => {
    state.selectedThreadStriped = e.target.checked;
    picker.querySelector('#tcp-row2').classList.toggle('tcp-dim', !e.target.checked);
    activate();
  });

  picker.querySelectorAll('.tcp-wbtn').forEach(btn => btn.addEventListener('click', () => {
    state.selectedThreadWidth = parseFloat(btn.dataset.w);
    picker.querySelectorAll('.tcp-wbtn').forEach(b => b.classList.toggle('tcp-wbtn-active', b === btn));
    activate();
  }));

  function activate() { setTool('thread'); window.setToolUI?.('thread'); }
  setTimeout(() => document.addEventListener('click', hideThreadColorPicker, { once: true }), 0);
}

export function hideThreadColorPicker() {
  document.getElementById('thread-color-picker')?.remove();
}

// ── Pins ─────────────────────────────────────────────────
function addPinToCard(cardId) {
  if (state.pins.some(p => p.cardId === cardId)) return;
  const el = canvas.querySelector(`.card[data-id="${cardId}"]`);
  if (!el) return;
  pushHistory();
  const rect = el.getBoundingClientRect();
  const pinPos = toCanvas(rect.left + rect.width / 2, rect.top);
  const pin = {
    id: 'pin-' + (state.nextId++), cardId,
    x: pinPos.x,
    y: pinPos.y + 4,
    color: state.selectedPinColor,
  };
  state.pins.push(pin);
  canvas.appendChild(makePinEl(pin));
  save();
}

function addPinAtPosition(x, y) {
  pushHistory();
  const pin = {
    id: 'pin-' + (state.nextId++), cardId: null,
    x, y,
    color: state.selectedPinColor,
  };
  state.pins.push(pin);
  canvas.appendChild(makePinEl(pin));
  save();
}

function deletePin(pinId, rerender = true) {
  if (rerender) pushHistory();
  state.threads = state.threads.filter(th => th.fromPin !== pinId && th.toPin !== pinId);
  state.pins    = state.pins.filter(p => p.id !== pinId);
  canvas.querySelector(`.pin[data-id="${pinId}"]`)?.remove();
  if (rerender) { renderAllThreads(threadSvg, getVisibleThreads(), state.pins, onThreadClick); save(); }
}

// ── Threads ──────────────────────────────────────────────
function addThread(fromPinId, toPinId) {
  const dup = state.threads.find(th =>
    (th.fromPin===fromPinId && th.toPin===toPinId) ||
    (th.fromPin===toPinId   && th.toPin===fromPinId));
  if (dup) return;
  pushHistory();
  state.threads.push({
    id: 'thread-' + (state.nextId++),
    fromPin: fromPinId, toPin: toPinId,
    color: state.selectedThreadColor,
    striped: state.selectedThreadStriped,
    stripeColor2: state.selectedThreadColor2,
    width: state.selectedThreadWidth,
    label: '',
  });
  renderAllThreads(threadSvg, getVisibleThreads(), state.pins, onThreadClick);
  save();
}

function deleteThread(threadId) {
  pushHistory();
  state.threads = state.threads.filter(th => th.id !== threadId);
  renderAllThreads(threadSvg, getVisibleThreads(), state.pins, onThreadClick);
  save();
}

function openThreadEditModal(threadId) {
  const thd = state.threads.find(th => th.id === threadId);
  if (!thd) return;
  modal.innerHTML = `
    <h3>${t('thread.edit')}</h3>
    <div class="modal-field"><label>${t('thread.label')}</label>
      <input id="tf-label" value="${esc(thd.label)}" placeholder="${t('thread.placeholder')}"/></div>
    <div class="modal-field"><label>${t('thread.thickness')}</label>
      <select id="tf-width">
        <option value="1"   ${thd.width==1  ?'selected':''}>${t('thread.thin')}</option>
        <option value="1.8" ${(thd.width==1.8||!thd.width)?'selected':''}>${t('thread.normal')}</option>
        <option value="3"   ${thd.width==3  ?'selected':''}>${t('thread.thick')}</option>
        <option value="5"   ${thd.width==5  ?'selected':''}>${t('thread.veryThick')}</option>
      </select></div>
    <div class="modal-btns">
      <button class="modal-btn cancel" id="tf-delete" data-tid="${threadId}"
        style="background:rgba(230,57,70,.15);color:#e63946;border-color:rgba(230,57,70,.3)">${t('thread.delete')}</button>
      <button class="modal-btn cancel" onclick="hideModalUI()">${t('btn.cancel')}</button>
      <button class="modal-btn primary" id="tf-ok">${t('btn.save')}</button>
    </div>`;
  modalOverlay.classList.add('visible');
  modal.querySelector('#tf-delete').onclick = e => {
    deleteThread(e.currentTarget.dataset.tid); hideModal();
  };
  modal.querySelector('#tf-ok').onclick = () => {
    pushHistory();
    thd.label = modal.querySelector('#tf-label').value.trim();
    thd.width = parseFloat(modal.querySelector('#tf-width').value);
    renderAllThreads(threadSvg, getVisibleThreads(), state.pins, onThreadClick);
    hideModal(); save();
  };
}

window.deleteThreadUI = (id) => { deleteThread(id); hideModal(); };

// ── Image file preview helper (called from modal file input) ──
window._loadImgPreview = function(input, directUrl) {
  const prev = document.getElementById('mf-img-preview');
  const urlEl = document.getElementById('mf-url');
  if (directUrl !== undefined) {
    if (prev) prev.innerHTML = directUrl
      ? `<img src="${esc(directUrl)}" style="max-width:220px;max-height:150px;border-radius:5px;object-fit:contain"/>`
      : '';
    return;
  }
  const file = input?.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    if (urlEl) urlEl.value = ev.target.result;
    if (prev) prev.innerHTML = `<img src="${ev.target.result}" style="max-width:220px;max-height:150px;border-radius:5px;object-fit:contain"/>`;
  };
  reader.readAsDataURL(file);
};

// ── Import Notes ──────────────────────────────────────────
export function doImportNotes() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => openInOverlay(img);
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function openInOverlay(img) {
  IN.img = img; IN.selections = []; IN.nextId = 1; IN.drawing = null; IN.mode = 'image';
  const overlay = document.getElementById('in-overlay');
  overlay.style.display = 'flex';
  document.querySelectorAll('.in-mode-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === 'image'));
  requestAnimationFrame(() => {
    const wrap = document.getElementById('in-canvas-wrap');
    const maxW = wrap.clientWidth - 20;
    const maxH = wrap.clientHeight - 20;
    IN.scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const cv = document.getElementById('in-canvas');
    cv.width  = Math.round(img.width  * IN.scale);
    cv.height = Math.round(img.height * IN.scale);
    inRedraw();
    inUpdateList();
    cv.onmousedown  = inMouseDown;
    cv.onmousemove  = inMouseMove;
    cv.onmouseup    = inMouseUp;
    cv.onmouseleave = () => { IN.drawing = null; inRedraw(); };
  });
}

function inRedraw() {
  const cv = document.getElementById('in-canvas'); if (!cv || !IN.img) return;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(IN.img, 0, 0, cv.width, cv.height);
  IN.selections.forEach((s, i) => {
    const col = s.type === 'image' ? '#4fc3f7' : '#aed581';
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([]);
    ctx.strokeRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = col;
    ctx.fillRect(s.x, s.y - 18, 22, 18);
    ctx.fillStyle = '#000'; ctx.font = 'bold 13px sans-serif';
    ctx.fillText(i + 1, s.x + 5, s.y - 3);
  });
  if (IN.drawing) {
    const col = IN.mode === 'image' ? '#4fc3f7' : '#aed581';
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
    ctx.strokeRect(IN.drawing.x, IN.drawing.y, IN.drawing.w, IN.drawing.h);
    ctx.setLineDash([]);
  }
}

function inMouseDown(e) {
  const r = e.currentTarget.getBoundingClientRect();
  IN.drawing = { x: e.clientX - r.left, y: e.clientY - r.top, w: 0, h: 0 };
}
function inMouseMove(e) {
  if (!IN.drawing) return;
  const r = e.currentTarget.getBoundingClientRect();
  IN.drawing.w = (e.clientX - r.left) - IN.drawing.x;
  IN.drawing.h = (e.clientY - r.top)  - IN.drawing.y;
  inRedraw();
}
function inMouseUp(e) {
  if (!IN.drawing) return;
  const { x, y, w, h } = IN.drawing; IN.drawing = null;
  if (Math.abs(w) < 10 || Math.abs(h) < 10) { inRedraw(); return; }
  const nx = w < 0 ? x + w : x, ny = h < 0 ? y + h : y;
  const nw = Math.abs(w), nh = Math.abs(h);
  const crop = document.createElement('canvas');
  crop.width = nw; crop.height = nh;
  crop.getContext('2d').drawImage(IN.img, nx / IN.scale, ny / IN.scale, nw / IN.scale, nh / IN.scale, 0, 0, nw, nh);
  const sel = { id: IN.nextId++, x: nx, y: ny, w: nw, h: nh, type: IN.mode, dataUrl: crop.toDataURL(), ocrText: undefined };
  IN.selections.push(sel);
  inRedraw(); inUpdateList();
  if (sel.type === 'ocr') inRunOCR(sel);
}

function inUpdateList() {
  const list = document.getElementById('in-list'); if (!list) return;
  if (IN.selections.length === 0) {
    list.innerHTML = `<div class="in-empty">${t('in.noSel')}</div>`; return;
  }
  list.innerHTML = IN.selections.map((s, i) => `
    <div class="in-sel">
      <div class="in-sel-num">${i + 1}</div>
      <img class="in-sel-thumb" src="${s.dataUrl}" alt=""/>
      <div class="in-sel-row">
        <button class="in-tbtn${s.type==='image'?' active':''}" onclick="window._inType(${s.id},'image')">🖼</button>
        <button class="in-tbtn${s.type==='ocr'?' active':''}" onclick="window._inType(${s.id},'ocr')">🔤</button>
        <button class="in-del" onclick="window._inDel(${s.id})">✕</button>
      </div>
      ${s.type==='ocr' ? `<div class="in-ocr-text">${s.ocrText !== undefined ? esc(s.ocrText) : `<em>${t('in.recognizing')}</em>`}</div>` : ''}
    </div>`).join('');
}

async function inRunOCR(sel) {
  inUpdateList(); // show "Recognizing…" immediately (ocrText is undefined)
  try {
    if (!window.Tesseract) {
      if (!_tesseractPromise) {
        _tesseractPromise = new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
          s.onload = res; s.onerror = rej; document.head.appendChild(s);
        });
      }
      await _tesseractPromise;
    }
    const { data: { text } } = await Tesseract.recognize(sel.dataUrl, 'eng+pol');
    sel.ocrText = text.trim();
  } catch (err) {
    console.warn('OCR error:', err);
    sel.ocrText = ''; // empty string = done (prevents infinite retry)
  }
  inUpdateList();
}

window._inType = (id, type) => {
  const sel = IN.selections.find(s => s.id === id); if (!sel) return;
  sel.type = type;
  if (type === 'ocr' && sel.ocrText === undefined) inRunOCR(sel);
  else inUpdateList();
  inRedraw();
};
window._inDel = (id) => {
  IN.selections = IN.selections.filter(s => s.id !== id);
  inRedraw(); inUpdateList();
};
window._inSetMode = (mode) => {
  IN.mode = mode;
  document.querySelectorAll('.in-mode-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode));
};
window._inClearAll = () => { IN.selections = []; IN.nextId = 1; inRedraw(); inUpdateList(); };
window._inClose = () => {
  document.getElementById('in-overlay').style.display = 'none';
  IN.img = null; IN.selections = [];
};
window._inAddToBoard = () => {
  if (IN.selections.length === 0) return;
  const hasPending = IN.selections.some(s => s.type === 'ocr' && s.ocrText === undefined);
  if (hasPending && !confirm(t('confirm.ocrPending'))) return;
  const CARD_W = 220, GAP = 16;
  const total = IN.selections.length;
  const startX = (-pan.x + vpW / 2) / zoom - (total * (CARD_W + GAP)) / 2;
  const startY = (-pan.y + vpH / 2) / zoom - 120;
  IN.selections.forEach((sel, i) => {
    const x = startX + i * (CARD_W + GAP);
    if (sel.type === 'image') addCard('image', { url: sel.dataUrl, caption: '' }, x, startY);
    else addCard('note', { text: sel.ocrText || '', color: 'y' }, x, startY);
  });
  document.getElementById('in-overlay').style.display = 'none';
  IN.img = null; IN.selections = [];
};

// ── Views ────────────────────────────────────────────────
export async function switchView(view) {
  state.currentView = view;
  updateViewBtns();
  canvas.querySelectorAll('.card').forEach(el => el.classList.add('view-transition'));
  const positions = await computeViewPositions(state.cards, view, state.threads, state.pins);
  state.cards.forEach(card => {
    const pos = positions[card.id];
    if (!pos) return;
    const el = canvas.querySelector(`.card[data-id="${card.id}"]`);
    if (el) { el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px'; }
  });
  setTimeout(() => {
    const tempPins = state.pins.map(pin => {
      const card = state.cards.find(c => c.id === pin.cardId);
      if (!card) return pin;
      const pos = positions[card.id];
      if (!pos) return pin;
      return { ...pin, x: pos.x + 75, y: pos.y + 4 };
    });
    tempPins.forEach(tpin => {
      const pel = canvas.querySelector(`.pin[data-id="${tpin.id}"]`);
      if (pel) { pel.style.left = tpin.x + 'px'; pel.style.top = tpin.y + 'px'; }
    });
    renderAllThreads(threadSvg, getVisibleThreads(), tempPins, onThreadClick);
    canvas.querySelectorAll('.card').forEach(el => el.classList.remove('view-transition'));
    scheduleMinimap();
  }, 540);
}

function updateViewBtns() {
  document.querySelectorAll('.view-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.view === state.currentView));
}

// ── Tools ────────────────────────────────────────────────
export function setTool(tool) {
  state.tool = tool;
  canvas.style.cursor = { select:'default', pin:'cell', thread:'crosshair', delete:'not-allowed' }[tool] || 'default';
  updateToolBtns();
}

function updateToolBtns() {
  document.querySelectorAll('.ci-tool[data-tool]').forEach(b =>
    b.classList.toggle('active-tool', b.dataset.tool === state.tool));
}

export function setPinColor(c)        { state.selectedPinColor = c; }
export function setThreadStriped(v)   { state.selectedThreadStriped = v; }
export function setThreadWidth(v)     { state.selectedThreadWidth = parseFloat(v); }
export function setNoteColor(c)       { state.selectedNoteColor = c; }

// ── Context menu ──────────────────────────────────────────
function showCtxMenu(x, y) {
  ctxMenu.innerHTML = '';
  if (contextTarget.type === 'card') {
    addCtxItem('✏️', t('ctx.editCard'),          () => openEditModal(contextTarget.id));
    addCtxItem('📌', t('ctx.addPin'),             () => addPinToCard(contextTarget.id));
    addCtxItem('🔍', t('ctx.filterConnections'),  () => { filterByCard(contextTarget.id); setTool('select'); });
    addCtxSep();
    addCtxItem('🗑️', t('ctx.deleteCard'),         () => deleteCard(contextTarget.id));
  } else {
    addCtxItem('🗑️', t('ctx.deletePin'),          () => deletePin(contextTarget.id));
  }
  ctxMenu.style.left = x + 'px'; ctxMenu.style.top = y + 'px';
  ctxMenu.classList.add('visible');
}

function addCtxItem(icon, label, fn) {
  const el = document.createElement('div');
  el.className = 'ctx-item';
  el.innerHTML = `<span>${icon}</span>${label}`;
  el.onclick = () => { fn(); hideCtxMenu(); };
  ctxMenu.appendChild(el);
}
function addCtxSep() {
  const el = document.createElement('div'); el.className = 'ctx-sep'; ctxMenu.appendChild(el);
}
function hideCtxMenu() { ctxMenu.classList.remove('visible'); }

// Open edit modal for a card just added via drag-and-drop
export function openAddModalForId(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  // Note and date cards have sensible defaults – skip the modal
  if (card.type === 'note' || card.type === 'date') return;
  openEditModal(cardId);
}

// ── Modal ─────────────────────────────────────────────────
let modalType = null, editingId = null;

export function openAddModal(type) { modalType=type; editingId=null; renderModal(type,null); }

function openEditModal(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  modalType=card.type; editingId=cardId; renderModal(card.type, card.data);
}

function renderModal(type, d) {
  modal.innerHTML = buildModalHTML(type, d);
  modalOverlay.classList.add('visible');
  modal.querySelector('.modal-btn.primary').onclick = submitModal;
  modal.querySelector('.modal-btn.cancel').onclick  = hideModal;
  modal.querySelector('input, textarea')?.focus();
}

function hideModal() { modalOverlay.classList.remove('visible'); }

function submitModal() {
  const data = readModalForm(modalType);
  if (!data) return;
  if (editingId) {
    const card = state.cards.find(c => c.id === editingId);
    if (card) { card.data = data; const el = canvas.querySelector(`.card[data-id="${editingId}"]`); if (el) updateCardElement(el, card); }
    save();
  } else { addCard(modalType, data); }
  hideModal();
}

function buildModalHTML(type, d) {
  const noteOpts = Object.keys(NOTE_COLORS)
    .map(k => `<option value="${k}"${d?.color===k?' selected':''}>${t('color.' + k)}</option>`).join('');
  const newsAccents = ['#e63946','#1565c0','#2e7d32','#9b59b6','#f4511e','#0097a7','#c8971c']
    .map(c => `<option value="${c}"${d?.accentColor===c?' selected':''}>${c}</option>`).join('');
  let fields = '';
  if (type==='person'||type==='unknown') {
    fields=`
      <div class="modal-field"><label>${t('field.name')}</label><input id="mf-name" value="${esc(d?.name)}"/></div>
      <div class="modal-field"><label>${t('field.role')}</label><input id="mf-role" value="${esc(d?.role)}"/></div>
      <div class="modal-field"><label>${t('field.party')}</label><input id="mf-party" value="${esc(d?.party)}"/></div>
      <div class="modal-field"><label>${t('field.partyColor')}</label><input id="mf-partyColor" value="${esc(d?.partyColor,'#666666')}"/></div>
      <div class="modal-field"><label>${t('field.emoji')}</label><input id="mf-emoji" value="${esc(d?.emoji,'👤')}"/></div>
      <div class="modal-field"><label>${t('field.photo')}</label><input id="mf-photo" value="${esc(d?.photo)}"/></div>`;
  } else if (type==='party') {
    fields=`
      <div class="modal-field"><label>${t('field.partyName')}</label><input id="mf-name" value="${esc(d?.name)}"/></div>
      <div class="modal-field"><label>${t('field.logo')}</label><input id="mf-logo" value="${esc(d?.logo,'🏛️')}"/></div>
      <div class="modal-field"><label>${t('field.color')}</label><input id="mf-color" value="${esc(d?.color,'#666666')}"/></div>
      <div class="modal-field"><label>${t('field.desc')}</label><textarea id="mf-desc">${esc(d?.desc)}</textarea></div>`;
  } else if (type==='law') {
    fields=`
      <div class="modal-field"><label>${t('field.actTitle')}</label><input id="mf-title" value="${esc(d?.title)}"/></div>
      <div class="modal-field"><label>${t('field.date')}</label><input id="mf-date" value="${esc(d?.date)}"/></div>
      <div class="modal-field"><label>${t('field.desc')}</label><textarea id="mf-desc">${esc(d?.desc)}</textarea></div>`;
  } else if (type==='news') {
    fields=`
      <div class="modal-field"><label>${t('field.source')}</label><input id="mf-source" value="${esc(d?.source)}"/></div>
      <div class="modal-field"><label>${t('field.headline')}</label><input id="mf-title" value="${esc(d?.title)}"/></div>
      <div class="modal-field"><label>${t('field.content')}</label><textarea id="mf-body">${esc(d?.body)}</textarea></div>
      <div class="modal-field"><label>${t('field.linkURL')}</label><input id="mf-url" value="${esc(d?.url)}"/></div>
      <div class="modal-field"><label>${t('field.accentColor')}</label><select id="mf-accent">${newsAccents}</select></div>`;
  } else if (type==='note') {
    fields=`
      <div class="modal-field"><label>${t('field.noteText')}</label><textarea id="mf-text">${esc(d?.text)}</textarea></div>
      <div class="modal-field"><label>${t('field.noteColor')}</label><select id="mf-color">${noteOpts}</select></div>`;
  } else if (type==='date') {
    fields=`
      <div class="modal-field"><label>${t('field.label')}</label><input id="mf-label" value="${esc(d?.label)}"/></div>
      <div class="modal-field"><label>${t('field.date')} *</label><input id="mf-date" value="${esc(d?.date)}"/></div>
      <div class="modal-field"><label>${t('field.noteColor')}</label><select id="mf-color">${noteOpts}</select></div>`;
  }
  if (type==='video') {
    fields=`
      <div class="modal-field"><label>${t('field.ytLink')}</label><input id="mf-url" placeholder="https://youtu.be/..." value="${esc(d?.url)}"/></div>
      <div class="modal-field"><label>${t('field.title')}</label><input id="mf-title" value="${esc(d?.title)}"/></div>`;
  }
  if (type==='image') {
    fields=`
      <div class="modal-field"><label>${t('field.imageFile')}</label>
        <input type="file" id="mf-imgfile" accept="image/*" style="color:#c8a870" onchange="window._loadImgPreview(this)"/></div>
      <div class="modal-field"><label>${t('field.imageURL')}</label>
        <input id="mf-url" value="${esc(d?.url)}" placeholder="https://..." oninput="window._loadImgPreview(null,this.value)"/></div>
      <div id="mf-img-preview" style="text-align:center;margin:4px 0;min-height:40px">
        ${d?.url ? `<img src="${esc(d.url)}" style="max-width:220px;max-height:150px;border-radius:5px;object-fit:contain"/>` : ''}</div>
      <div class="modal-field"><label>${t('field.caption')}</label><input id="mf-caption" value="${esc(d?.caption)}"/></div>`;
  }
  const titles = {
    person:  t('modal.person'),  unknown: t('modal.unknown'),
    party:   t('modal.party'),   law:     t('modal.law'),
    news:    t('modal.news'),    note:    t('modal.note'),
    date:    t('modal.date'),    video:   t('modal.video'),
    image:   t('modal.image'),
  };
  return `<h3>${titles[type]||type}</h3>${fields}
    <div class="modal-btns">
      <button class="modal-btn cancel">${t('btn.cancel')}</button>
      <button class="modal-btn primary">${t('btn.save')}</button>
    </div>`;
}

function readModalForm(type) {
  const v   = id => (document.getElementById(id)?.value??'').trim();
  const sel = id => document.getElementById(id)?.value||'y';
  if (type==='person'||type==='unknown') {
    const name=v('mf-name'); if(!name) return alert(t('alert.enterName')),null;
    return { name, role:v('mf-role'), party:v('mf-party'), partyColor:v('mf-partyColor')||'#666', emoji:v('mf-emoji')||'👤', photo:v('mf-photo') };
  }
  if (type==='party') {
    const name=v('mf-name'); if(!name) return alert(t('alert.enterPartyName')),null;
    return { name, logo:v('mf-logo')||'🏛️', color:v('mf-color')||'#666', desc:v('mf-desc') };
  }
  if (type==='law') {
    const title=v('mf-title'); if(!title) return alert(t('alert.enterTitle')),null;
    return { title, date:v('mf-date'), desc:v('mf-desc') };
  }
  if (type==='news') {
    const title=v('mf-title'); if(!title) return alert(t('alert.enterHeadline')),null;
    return { source:v('mf-source'), title, body:v('mf-body'), url:v('mf-url'), accentColor:sel('mf-accent') };
  }
  if (type==='note') return { text:v('mf-text'), color:sel('mf-color') };
  if (type==='date') {
    const date=v('mf-date'); if(!date) return alert(t('alert.enterDate')),null;
    return { label:v('mf-label'), date, color:sel('mf-color') };
  }
  if (type==='video') {
    const url=v('mf-url'); if(!url) return alert(t('alert.enterYTLink')),null;
    return { url, title:v('mf-title') };
  }
  if (type==='image') {
    const url=v('mf-url'); if(!url) return alert(t('alert.noImage')),null;
    return { url, caption:v('mf-caption') };
  }
  return null;
}

// ── Export / Import ───────────────────────────────────────
export async function doExportJSON() { await exportJSON(state); }
function maxIdFromData(data) {
  const all = [...data.cards, ...data.pins, ...data.threads];
  const nums = all.map(e => { const n = parseInt((e.id.match(/\d+$/) || [0])[0]); return isNaN(n) ? 0 : n; });
  return Math.max(300, ...nums) + 1;
}
export function doImportJSON() {
  importJSON(data => {
    pushHistory();
    state.cards=data.cards; state.pins=data.pins; state.threads=data.threads;
    state.nextId = maxIdFromData(data);
    renderAll(); save(); scheduleMinimap();
  });
}
export function doImportPNG() {
  importPNG(data => {
    pushHistory();
    state.cards=data.cards; state.pins=data.pins; state.threads=data.threads;
    state.nextId = maxIdFromData(data);
    renderAll(); save(); scheduleMinimap();
  });
}
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
    suppressAfterStyle = document.createElement('style');
    suppressAfterStyle.textContent = '#board-wrap::after { display: none !important; }';
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
    renderAllThreads(threadSvg, getVisibleThreads(), state.pins, onThreadClick);
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

export function doShareURL() {
  saveToHash(state);
  const shareURL = window.location.href;
  // Clear hash from address bar – link is already in clipboard, hash on F5 would overwrite localStorage
  history.replaceState(null, '', location.pathname + location.search);
  navigator.clipboard?.writeText(shareURL)
    .then(() => showToast(t('toast.linkCopied')))
    .catch(() => { showToast(t('toast.copyManual')); prompt(t('toast.linkPrompt'), shareURL); });
}

function showToast(msg) {
  let el = document.getElementById('app-toast');
  if (!el) { el = document.createElement('div'); el.id='app-toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = 'app-toast show';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ── Reset / Clear ─────────────────────────────────────────
export function resetToSample() {
  if (!confirm(t('confirm.reset'))) return;
  pushHistory();
  state.cards=SAMPLE_DATA.cards.map(c=>({...c,data:{...c.data}}));
  state.pins=SAMPLE_DATA.pins.map(p=>({...p}));
  state.threads=SAMPLE_DATA.threads.map(th=>({...th}));
  state.nextId=300; state.groups=[];
  renderAll(); save(); scheduleMinimap();
}
export function clearBoard() {
  if (!confirm(t('confirm.clear'))) return;
  pushHistory();
  state.cards=[];state.pins=[];state.threads=[];state.groups=[];state.nextId=1;
  renderAll(); save(); scheduleMinimap();
}

// ── Save ─────────────────────────────────────────────────
function save() {
  saveState({ cards:state.cards, pins:state.pins, threads:state.threads, nextId:state.nextId, groups:state.groups });
}
