// board-render.js – full-board (re)rendering and connection-filter visibility.

import { state } from './state.js';
import { canvas, threadSvg } from './dom.js';
import { createCardElement, renderPinSvg } from './cards.js';
import { renderAllThreads, buildPinMap } from './threads.js';

// Set once from app.js during init (avoids a circular import with
// thread-actions.js, which both needs getVisibleThreads() from here and
// provides the click handler renderAll() below wires up to every thread).
let threadClickHandler = null;
export function setThreadClickHandler(fn) { threadClickHandler = fn; }

export function renderAll() {
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
  renderAllThreads(threadSvg, visThreads, state.pins, threadClickHandler);
}

export function makePinEl(pin) {
  const el = document.createElement('div');
  el.className = 'pin';
  el.dataset.id = pin.id;
  el.style.left = pin.x + 'px';
  el.style.top  = pin.y + 'px';
  el.innerHTML  = renderPinSvg(pin.color);
  return el;
}

// Visibility filtering
export function getVisibleThreads() {
  const connected = state.filterCardId ? getConnectedCards(state.filterCardId) : null;
  if (connected && state.filterCardId) connected.add(state.filterCardId);
  return getVisibleThreadsWithMap(connected, buildPinMap(state.pins));
}

export function getVisibleThreadsWithMap(connectedSet, pinMap) {
  if (!connectedSet) return state.threads;
  return state.threads.filter(th => {
    const a = pinMap[th.fromPin]?.cardId;
    const b = pinMap[th.toPin]?.cardId;
    return connectedSet.has(a) || connectedSet.has(b);
  });
}

export function getConnectedCards(cardId, depth = 3) {
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

// Re-render just the SVG thread layer, batched onto one animation frame.
let rafThreadId = null;
export function scheduleThreadRender() {
  if (rafThreadId) return;
  rafThreadId = requestAnimationFrame(() => {
    rafThreadId = null;
    renderAllThreads(threadSvg, getVisibleThreads(), state.pins, threadClickHandler);
  });
}

export function renderVisibleThreadsNow(pins = state.pins) {
  renderAllThreads(threadSvg, getVisibleThreads(), pins, threadClickHandler);
}

// ── Connection filter ("show only cards connected to this one") ──────────
export function filterByCard(cardId) {
  state.filterCardId = state.filterCardId === cardId ? null : cardId;
  renderAll();
}

export function clearFilter() {
  if (!state.filterCardId) return;
  state.filterCardId = null;
  renderAll();
}
