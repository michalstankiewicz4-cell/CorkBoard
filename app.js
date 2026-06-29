// app.js – główna logika aplikacji

import { createCardElement, updateCardElement, renderPinSvg, PIN_COLORS, NOTE_COLORS, esc } from './cards.js';
import { renderAllThreads, drawTempThread, removeTempThread, buildPinMap } from './threads.js';
import { computeViewPositions } from './views.js';
import { saveState, loadState } from './storage.js';
import { SAMPLE_DATA } from './data-sample.js';
import { Minimap } from './minimap.js';
import { exportJSON, importJSON, exportPNG, importPNG, saveToHash, loadFromHash } from './export.js';

// ── Stan ────────────────────────────────────────────────
let state = {
  cards: [], pins: [], threads: [],
  nextId: 1, currentView: 'basic',
  selectedPinColor: 'red',
  selectedThreadColor: 'r', selectedThreadColor2: 'w',
  selectedThreadStriped: false, selectedThreadWidth: 1.8,
  selectedNoteColor: 'y',
  tool: 'select',
  filterCardId: null,   // filtrowanie powiązań
  groups: [],           // [{id, name, color, cardIds[]}]
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

// Viewport cache (aktualizowany przez ResizeObserver – brak clientWidth w RAF)
let vpW = window.innerWidth, vpH = window.innerHeight;

// Minimap
let minimap = null;

// Undo / Redo
const MAX_HISTORY = 50;
const undoStack = [];
const redoStack = [];

// DRY: konwersja współrzędnych ekran → przestrzeń canvas
// boardWrap ma position:fixed; left:0; top:0 – brak potrzeby getBoundingClientRect
function toCanvas(clientX, clientY) {
  return {
    x: (clientX - pan.x) / zoom,
    y: (clientY - pan.y) / zoom,
  };
}

// ── Init ────────────────────────────────────────────────
export function init() {
  // Próba wczytania: hash → localStorage → przykładowe dane
  const fromHash = loadFromHash();
  const saved    = loadState();
  if (fromHash && fromHash.cards.length) {
    state = { ...state, ...fromHash };
    state.nextId = 300;
    history.replaceState(null, '', location.pathname + location.search);
  } else if (saved && saved.cards && saved.cards.length) {
    state = { ...state, ...saved };
    if (!state.groups) state.groups = [];
  } else {
    state.cards   = SAMPLE_DATA.cards.map(c => ({...c, data:{...c.data}}));
    state.pins    = SAMPLE_DATA.pins.map(p => ({...p}));
    state.threads = SAMPLE_DATA.threads.map(t => ({...t}));
    state.nextId  = 300;
  }

  // Minimap
  const mmEl = document.getElementById('minimap-container');
  if (mmEl) minimap = new Minimap(mmEl);

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
  // Nitki z pre-built pinMap
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

// Filtrowanie widoczności
function getVisibleThreads() {
  const connected = state.filterCardId ? getConnectedCards(state.filterCardId) : null;
  if (connected && state.filterCardId) connected.add(state.filterCardId);
  return getVisibleThreadsWithMap(connected, buildPinMap(state.pins));
}

function getVisibleThreadsWithMap(connectedSet, pinMap) {
  if (!connectedSet) return state.threads;
  return state.threads.filter(t => {
    const a = pinMap[t.fromPin]?.cardId;
    const b = pinMap[t.toPin]?.cardId;
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
        state.threads.forEach(t => {
          const other = t.fromPin === pid ? pinMap[t.toPin]?.cardId
                      : t.toPin   === pid ? pinMap[t.fromPin]?.cardId
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
      if (state.tool !== 'select') { setTool('select'); window.setToolUI?.('select'); }
    }
    if ((e.key === 'Delete' || e.key === 'Backspace')
        && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
      if (multiSelected.size > 0) {
        pushHistory();
        [...multiSelected].forEach(id => {
          state.pins.filter(p => p.cardId === id).forEach(p => {
            state.threads = state.threads.filter(t => t.fromPin !== p.id && t.toPin !== p.id);
            canvas.querySelector(`.pin[data-id="${p.id}"]`)?.remove();
          });
          state.pins  = state.pins.filter(p => p.cardId !== id);
          state.cards = state.cards.filter(c => c.id !== id);
          canvas.querySelector(`.card[data-id="${id}"]`)?.remove();
          if (selectedCardId   === id) selectedCardId   = null;
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

    // Shift+klik → zaznacz/odznacz do multi-select
    if (e.shiftKey && state.tool === 'select') {
      // Przy pierwszym shift+kliku wciągnij aktualnie wybraną kartę do zaznaczenia
      if (multiSelected.size === 0 && selectedCardId) {
        multiSelected.add(selectedCardId);
        canvas.querySelector(`.card[data-id="${selectedCardId}"]`)?.classList.add('multi-selected');
      }
      if (multiSelected.has(cid)) { multiSelected.delete(cid); card.classList.remove('multi-selected'); }
      else                        { multiSelected.add(cid);    card.classList.add('multi-selected');    }
      e.preventDefault(); return;
    }

    // Klik na zaznaczoną kartę → przesuń wszystkie zaznaczone
    if (multiSelected.size > 0 && multiSelected.has(cid) && state.tool === 'select') {
      pushHistory();
      const { x: mx, y: my } = toCanvas(e.clientX, e.clientY);
      multiDragOffsets = new Map();
      multiSelected.forEach(id => {
        const c  = state.cards.find(c => c.id === id);
        const el = canvas.querySelector(`.card[data-id="${id}"]`);
        if (c && el) multiDragOffsets.set(id, { dx: c.x - mx, dy: c.y - my, card: c, el, cardW: el.offsetWidth });
      });
      e.preventDefault(); return;
    }

    // Klik bez shift → wyczyść zaznaczenie, zwykły drag
    if (multiSelected.size > 0) clearMultiSelected();
    pushHistory();
    const cardRect  = card.getBoundingClientRect();
    const cardData  = state.cards.find(c => c.id === cid);
    const pinnedPin = state.pins.find(p => p.cardId === cid) || null;
    const hasThreads = pinnedPin
      ? state.threads.some(t => t.fromPin === pinnedPin.id || t.toPin === pinnedPin.id)
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
    selectCard(cid);
    e.preventDefault();
  } else if (!pin && e.button === 0 && state.tool === 'select') {
    clearMultiSelected();
    panning = { startX: e.clientX, startY: e.clientY, panX0: pan.x, panY0: pan.y };
    boardWrap.style.cursor = 'grabbing';
    e.preventDefault();
  }
}

function onMiddleDown(e) {
  if (e.button !== 1) return;
  e.preventDefault(); // blokuj autoscroll przeglądarki
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
  if (panning) { panning = null; boardWrap.style.cursor = ''; checkCardsVisible(); return; }
  if (multiDragOffsets) { multiDragOffsets = null; save(); scheduleMinimap(); return; }
  if (dragging) {
    dragging.el.classList.remove('dragging');
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
  // Podwójny klik na pustej tablicy = szybka notatka
  const { x, y } = toCanvas(e.clientX, e.clientY);
  const id = addCard('note', { text: '', color: state.selectedNoteColor }, x, y);
  // Otwórz od razu edytor
  setTimeout(() => openEditModal(id), 80);
}

let wheelRafId = null;
function onWheel(e) {
  e.preventDefault();
  const delta   = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
  const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(zoom + delta).toFixed(2)));
  if (newZoom === zoom) return;
  // Math akumuluje się synchronicznie; DOM-write odkładamy na jeden RAF
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
  const t = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  canvas.style.transform         = t;
  canvas.style.transformOrigin   = '0 0';
  threadSvg.style.transform      = t;
  threadSvg.style.transformOrigin= '0 0';
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
  // Sprawdź czy choć jedna karta jest w viewport
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
      btn.textContent = '🎯 Wróć do kart';
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

// Eksport pan/zoom dla drag&drop z karuzeli
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
  // cardData i cardW mogą być przekazane z cache dragging (bez querySelector/getBoundingClientRect)
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
    // Dynamiczny bounding box – uwzględnia karty daleko poza centrum
    const xs = state.cards.map(c => c.x).concat([0, bw]);
    const ys = state.cards.map(c => c.y).concat([0, bh]);
    const boardW = Math.max(1800, Math.max(...xs) + 300);
    const boardH = Math.max(900,  Math.max(...ys) + 200);
    minimap.update(state.cards, state.pins, state.threads, pan, zoom, boardW, boardH, bw, bh);
  }, 80);
}

// ── Karty ───────────────────────────────────────────────
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

// ── Filtrowanie powiązań ─────────────────────────────────
export function filterByCard(cardId) {
  state.filterCardId = state.filterCardId === cardId ? null : cardId;

  renderAll();
}

function clearFilter() {
  if (!state.filterCardId) return;
  state.filterCardId = null;
  renderAll();
}

// ── Multi-select (Shift+klik) ────────────────────────────
function clearMultiSelected() {
  multiSelected.forEach(cid => {
    canvas.querySelector(`.card[data-id="${cid}"]`)?.classList.remove('multi-selected');
  });
  multiSelected.clear();
}


window.hideModalUI = hideModal;

// ── Color picker pinezki (otwierany z karuzeli) ──────────
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

// ── Color picker nitki (otwierany z karuzeli) ─────────────
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
    <div class="tcp-label">Kolor nitki</div>
    <div class="pcp-colors" id="tcp-row1">${mkRow(state.selectedThreadColor, 1)}</div>
    <div class="tcp-row2-hdr">
      <span class="tcp-label">Kolor paska</span>
      <label class="tcp-check"><input type="checkbox" id="tcp-striped"${state.selectedThreadStriped?' checked':''}> paskowana</label>
    </div>
    <div class="pcp-colors${state.selectedThreadStriped?'':' tcp-dim'}" id="tcp-row2">${mkRow(state.selectedThreadColor2, 2)}</div>
    <div class="tcp-row2-hdr"><span class="tcp-label">Grubość</span><div class="tcp-widths" id="tcp-widths">${mkWidths()}</div></div>`;

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

// ── Pinezki ──────────────────────────────────────────────
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
  state.threads = state.threads.filter(t => t.fromPin !== pinId && t.toPin !== pinId);
  state.pins    = state.pins.filter(p => p.id !== pinId);
  canvas.querySelector(`.pin[data-id="${pinId}"]`)?.remove();
  if (rerender) { renderAllThreads(threadSvg, getVisibleThreads(), state.pins, onThreadClick); save(); }
}

// ── Nitki ────────────────────────────────────────────────
function addThread(fromPinId, toPinId) {
  const dup = state.threads.find(t =>
    (t.fromPin===fromPinId && t.toPin===toPinId) ||
    (t.fromPin===toPinId   && t.toPin===fromPinId));
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
  state.threads = state.threads.filter(t => t.id !== threadId);
  renderAllThreads(threadSvg, getVisibleThreads(), state.pins, onThreadClick);
  save();
}

function openThreadEditModal(threadId) {
  const t = state.threads.find(th => th.id === threadId);
  if (!t) return;
  modal.innerHTML = `
    <h3>✏️ Edytuj nitkę</h3>
    <div class="modal-field"><label>Etykieta (opis połączenia)</label>
      <input id="tf-label" value="${esc(t.label)}" placeholder="np. finansuje, głosował za…"/></div>
    <div class="modal-field"><label>Grubość</label>
      <select id="tf-width">
        <option value="1" ${t.width==1?'selected':''}>Cienka</option>
        <option value="1.8" ${(t.width==1.8||!t.width)?'selected':''}>Normalna</option>
        <option value="3" ${t.width==3?'selected':''}>Gruba</option>
        <option value="5" ${t.width==5?'selected':''}>Bardzo gruba</option>
      </select></div>
    <div class="modal-btns">
      <button class="modal-btn cancel" id="tf-delete" data-tid="${threadId}"
        style="background:rgba(230,57,70,.15);color:#e63946;border-color:rgba(230,57,70,.3)">🗑 Usuń nitkę</button>
      <button class="modal-btn cancel" onclick="hideModalUI()">Anuluj</button>
      <button class="modal-btn primary" id="tf-ok">Zapisz</button>
    </div>`;
  modalOverlay.classList.add('visible');
  modal.querySelector('#tf-delete').onclick = e => {
    deleteThread(e.currentTarget.dataset.tid); hideModal();
  };
  modal.querySelector('#tf-ok').onclick = () => {
    pushHistory();
    t.label = modal.querySelector('#tf-label').value.trim();
    t.width = parseFloat(modal.querySelector('#tf-width').value);
    renderAllThreads(threadSvg, getVisibleThreads(), state.pins, onThreadClick);
    hideModal(); save();
  };
}

window.deleteThreadUI = (id) => { deleteThread(id); hideModal(); };

// ── Widoki ───────────────────────────────────────────────
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

// ── Narzędzia ─────────────────────────────────────────────
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
    addCtxItem('✏️', 'Edytuj kartę',         () => openEditModal(contextTarget.id));
    addCtxItem('📌', 'Wbij pinezkę',          () => addPinToCard(contextTarget.id));
    addCtxItem('🔍', 'Filtruj powiązania',    () => { filterByCard(contextTarget.id); setTool('select'); });
    addCtxSep();
    addCtxItem('🗑️', 'Usuń kartę',            () => deleteCard(contextTarget.id));
  } else {
    addCtxItem('🗑️', 'Usuń pinezkę',         () => deletePin(contextTarget.id));
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

// Otwórz modal edycji dla nowo dodanej karty (po drag z karuzeli)
export function openAddModalForId(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  // Dla note/date nie otwieramy – mają sensowne defaults
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
  const noteOpts = Object.entries(NOTE_COLORS)
    .map(([k,v]) => `<option value="${k}"${d?.color===k?' selected':''}>${v.label}</option>`).join('');
  const newsAccents = ['#e63946','#1565c0','#2e7d32','#9b59b6','#f4511e','#0097a7','#c8971c']
    .map(c=>`<option value="${c}"${d?.accentColor===c?' selected':''}>${c}</option>`).join('');
  let fields = '';
  if (type==='person'||type==='unknown') {
    fields=`
      <div class="modal-field"><label>Imię i nazwisko *</label><input id="mf-name" value="${esc(d?.name)}"/></div>
      <div class="modal-field"><label>Funkcja / rola</label><input id="mf-role" value="${esc(d?.role)}"/></div>
      <div class="modal-field"><label>Partia</label><input id="mf-party" value="${esc(d?.party)}"/></div>
      <div class="modal-field"><label>Kolor partii</label><input id="mf-partyColor" value="${esc(d?.partyColor,'#666666')}"/></div>
      <div class="modal-field"><label>Emoji (avatar)</label><input id="mf-emoji" value="${esc(d?.emoji,'👤')}"/></div>
      <div class="modal-field"><label>URL zdjęcia</label><input id="mf-photo" value="${esc(d?.photo)}"/></div>`;
  } else if (type==='party') {
    fields=`
      <div class="modal-field"><label>Nazwa partii *</label><input id="mf-name" value="${esc(d?.name)}"/></div>
      <div class="modal-field"><label>Logo (emoji)</label><input id="mf-logo" value="${esc(d?.logo,'🏛️')}"/></div>
      <div class="modal-field"><label>Kolor (hex)</label><input id="mf-color" value="${esc(d?.color,'#666666')}"/></div>
      <div class="modal-field"><label>Opis</label><textarea id="mf-desc">${esc(d?.desc)}</textarea></div>`;
  } else if (type==='law') {
    fields=`
      <div class="modal-field"><label>Tytuł ustawy *</label><input id="mf-title" value="${esc(d?.title)}"/></div>
      <div class="modal-field"><label>Data</label><input id="mf-date" value="${esc(d?.date)}"/></div>
      <div class="modal-field"><label>Opis</label><textarea id="mf-desc">${esc(d?.desc)}</textarea></div>`;
  } else if (type==='news') {
    fields=`
      <div class="modal-field"><label>Źródło</label><input id="mf-source" value="${esc(d?.source)}"/></div>
      <div class="modal-field"><label>Nagłówek *</label><input id="mf-title" value="${esc(d?.title)}"/></div>
      <div class="modal-field"><label>Treść</label><textarea id="mf-body">${esc(d?.body)}</textarea></div>
      <div class="modal-field"><label>Link URL</label><input id="mf-url" value="${esc(d?.url)}"/></div>
      <div class="modal-field"><label>Kolor akcentu</label><select id="mf-accent">${newsAccents}</select></div>`;
  } else if (type==='note') {
    fields=`
      <div class="modal-field"><label>Treść notatki</label><textarea id="mf-text">${esc(d?.text)}</textarea></div>
      <div class="modal-field"><label>Kolor</label><select id="mf-color">${noteOpts}</select></div>`;
  } else if (type==='date') {
    fields=`
      <div class="modal-field"><label>Etykieta</label><input id="mf-label" value="${esc(d?.label,'Data')}"/></div>
      <div class="modal-field"><label>Data *</label><input id="mf-date" value="${esc(d?.date)}"/></div>
      <div class="modal-field"><label>Kolor</label><select id="mf-color">${noteOpts}</select></div>`;
  }
  if (type==='video') {
    fields=`
      <div class="modal-field"><label>Link YouTube *</label><input id="mf-url" placeholder="https://youtu.be/..." value="${esc(d?.url)}"/></div>
      <div class="modal-field"><label>Tytuł (opcjonalny)</label><input id="mf-title" value="${esc(d?.title)}"/></div>`;
  }
  const titles={person:'Osoba',unknown:'Nieznana osoba',party:'Partia',law:'Ustawa',news:'News',note:'Notatka',date:'Data',video:'Film YouTube'};
  return `<h3>${titles[type]||type}</h3>${fields}
    <div class="modal-btns">
      <button class="modal-btn cancel">Anuluj</button>
      <button class="modal-btn primary">Zapisz</button>
    </div>`;
}

function readModalForm(type) {
  const v   = id => (document.getElementById(id)?.value??'').trim();
  const sel = id => document.getElementById(id)?.value||'y';
  if (type==='person'||type==='unknown') {
    const name=v('mf-name'); if(!name) return alert('Podaj imię'),null;
    return { name, role:v('mf-role'), party:v('mf-party'), partyColor:v('mf-partyColor')||'#666', emoji:v('mf-emoji')||'👤', photo:v('mf-photo') };
  }
  if (type==='party') {
    const name=v('mf-name'); if(!name) return alert('Podaj nazwę'),null;
    return { name, logo:v('mf-logo')||'🏛️', color:v('mf-color')||'#666', desc:v('mf-desc') };
  }
  if (type==='law') {
    const title=v('mf-title'); if(!title) return alert('Podaj tytuł'),null;
    return { title, date:v('mf-date'), desc:v('mf-desc') };
  }
  if (type==='news') {
    const title=v('mf-title'); if(!title) return alert('Podaj nagłówek'),null;
    return { source:v('mf-source'), title, body:v('mf-body'), url:v('mf-url'), accentColor:sel('mf-accent') };
  }
  if (type==='note') return { text:v('mf-text'), color:sel('mf-color') };
  if (type==='date') {
    const date=v('mf-date'); if(!date) return alert('Podaj datę'),null;
    return { label:v('mf-label')||'Data', date, color:sel('mf-color') };
  }
  if (type==='video') {
    const url=v('mf-url'); if(!url) return alert('Podaj link YouTube'),null;
    return { url, title:v('mf-title') };
  }
  return null;
}

// ── Eksport / Import ──────────────────────────────────────
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

  // Zachowaj style board-wrap i transformy
  const savedBW = { position: boardWrap.style.position, width: boardWrap.style.width, height: boardWrap.style.height,
                    top: boardWrap.style.top, left: boardWrap.style.left, overflow: boardWrap.style.overflow };
  const savedCanvasT  = canvas.style.transform;
  const savedSvgT     = threadSvg.style.transform;

  // Zachowaj pozycje kart i pinezek w DOM
  const cardEls = [...canvas.querySelectorAll('.card')];
  const pinEls  = [...canvas.querySelectorAll('.pin')];
  const savedCards      = cardEls.map(el => ({ left: el.style.left, top: el.style.top }));
  const savedPins       = pinEls.map( el => ({ left: el.style.left, top: el.style.top }));
  const savedCardShadow = cardEls.map(el => el.style.boxShadow);

  // Ukryj nakładki fixed
  const overlayIds = ['board-frame', 'minimap-wrap', 'left-panel', 'carousel-wrap', 'help-panel', 'back-to-cards'];
  const overlays = overlayIds.map(id => document.getElementById(id)).filter(Boolean);
  const savedDisplay = overlays.map(el => el.style.display);
  let suppressAfterStyle = null;

  try {
    // Przesuń karty i pinezki o (-minX, -minY) bezpośrednio w DOM (bez CSS transform)
    cardEls.forEach(el => {
      const c = state.cards.find(c2 => c2.id === el.dataset.id);
      if (c) { el.style.left = (c.x - minX) + 'px'; el.style.top = (c.y - minY) + 'px'; }
    });
    const adjustedPins = state.pins.map(p => ({ ...p, x: p.x - minX, y: p.y - minY }));
    pinEls.forEach(el => {
      const p = adjustedPins.find(p2 => p2.id === el.dataset.id);
      if (p) { el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; }
    });

    // Wyczyść transformy canvas i SVG (pozycje już przeliczone)
    canvas.style.transform    = '';
    threadSvg.style.transform = '';

    // Re-renderuj nitki SVG ze zmodyfikowanymi koordynatami (bez transformu na SVG)
    renderAllThreads(threadSvg, getVisibleThreads(), adjustedPins, null);

    // Nadaj board-wrap rozmiar całej zawartości
    boardWrap.style.position = 'absolute';
    boardWrap.style.width    = contentW + 'px';
    boardWrap.style.height   = contentH + 'px';
    boardWrap.style.top      = '0';
    boardWrap.style.left     = '0';
    // 'visible' zamiast 'hidden' — html2canvas ucina box-shadow dzieci przy overflow:hidden
    boardWrap.style.overflow = 'visible';

    // html2canvas renderuje board-wrap::after box-shadow niespójnie (tylko góra/lewa)
    // — wyłączamy pseudo-element, ramkę rysujemy ręcznie na canvas w exportPNG
    suppressAfterStyle = document.createElement('style');
    suppressAfterStyle.textContent = '#board-wrap::after { display: none !important; }';
    document.head.appendChild(suppressAfterStyle);

    // Wyłącz box-shadow — rysujemy cienie ręcznie na canvas w exportPNG
    cardEls.forEach(el => { el.style.boxShadow = 'none'; });

    overlays.forEach(el => { el.style.display = 'none'; });
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    saveToHash(state);
    await exportPNG(boardWrap, contentW, contentH);
  } catch (e) {
    alert('Eksport PNG nieudany: ' + e.message);
  } finally {
    // Przywróć pozycje kart, pinezek i box-shadow
    cardEls.forEach((el, i) => { el.style.left = savedCards[i].left; el.style.top = savedCards[i].top; el.style.boxShadow = savedCardShadow[i]; });
    pinEls.forEach( (el, i) => { el.style.left = savedPins[i].left;  el.style.top = savedPins[i].top;  });
    // Przywróć transformy i nitki
    canvas.style.transform    = savedCanvasT;
    threadSvg.style.transform = savedSvgT;
    renderAllThreads(threadSvg, getVisibleThreads(), state.pins, onThreadClick);
    // Przywróć board-wrap
    boardWrap.style.position = savedBW.position;
    boardWrap.style.width    = savedBW.width;
    boardWrap.style.height   = savedBW.height;
    boardWrap.style.top      = savedBW.top;
    boardWrap.style.left     = savedBW.left;
    boardWrap.style.overflow = savedBW.overflow;
    // Przywróć board-wrap::after i nakładki
    if (suppressAfterStyle?.parentNode) document.head.removeChild(suppressAfterStyle);
    overlays.forEach((el, i) => { el.style.display = savedDisplay[i]; });
  }
}
export function doShareURL()  {
  saveToHash(state);
  const shareURL = window.location.href;
  // Wyczyść hash z paska adresu – link jest już w schowku, hash przy F5 nadpisywałby localStorage
  history.replaceState(null, '', location.pathname + location.search);
  navigator.clipboard?.writeText(shareURL)
    .then(() => showToast('📋 Link skopiowany do schowka!'))
    .catch(() => { showToast('🔗 Skopiuj link ręcznie'); prompt('Link do tablicy:', shareURL); });
}

function showToast(msg) {
  let t = document.getElementById('app-toast');
  if (!t) { t=document.createElement('div'); t.id='app-toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'app-toast show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Reset / Clear ─────────────────────────────────────────
export function resetToSample() {
  if (!confirm('Przywrócić przykładowe dane?')) return;
  pushHistory();
  state.cards=SAMPLE_DATA.cards.map(c=>({...c,data:{...c.data}}));
  state.pins=SAMPLE_DATA.pins.map(p=>({...p}));
  state.threads=SAMPLE_DATA.threads.map(t=>({...t}));
  state.nextId=300; state.groups=[];
  renderAll(); save(); scheduleMinimap();
}
export function clearBoard() {
  if (!confirm('Utworzyć nową tablicę? Niezapisane zmiany zostaną utracone.')) return;
  pushHistory();
  state.cards=[];state.pins=[];state.threads=[];state.groups=[];state.nextId=1;
  renderAll(); save(); scheduleMinimap();
}

// ── Zapis ─────────────────────────────────────────────────
function save() {
  saveState({ cards:state.cards, pins:state.pins, threads:state.threads, nextId:state.nextId, groups:state.groups });
}
