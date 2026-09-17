// card-actions.js – create/delete/select cards, and keep a card's pins in sync
// with its position while it's being dragged.

import { state } from './state.js';
import { canvas } from './dom.js';
import { createCardElement } from './cards.js';
import { pushHistory } from './history.js';
import { save } from './persist.js';
import { scheduleMinimap } from './viewport.js';
import { renderVisibleThreadsNow } from './board-render.js';

let selectedCardId = null;
export function getSelectedCardId() { return selectedCardId; }

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

export function deleteCard(id) {
  pushHistory();
  // Inlined equivalent of pin-actions.js's deletePin(pid, false) for each of
  // this card's pins (no history/save/re-render per pin — deleteCard does
  // that once at the end) — kept inline rather than imported to avoid a
  // card-actions.js ↔ pin-actions.js circular import.
  state.pins.filter(p => p.cardId === id).forEach(p => {
    state.threads = state.threads.filter(th => th.fromPin !== p.id && th.toPin !== p.id);
    canvas.querySelector(`.pin[data-id="${p.id}"]`)?.remove();
  });
  state.pins  = state.pins.filter(p => p.cardId !== id);
  state.cards = state.cards.filter(c => c.id !== id);
  canvas.querySelector(`.card[data-id="${id}"]`)?.remove();
  if (selectedCardId === id) selectedCardId = null;
  if (state.filterCardId === id) state.filterCardId = null;
  renderVisibleThreadsNow();
  save(); scheduleMinimap();
}

export function selectCard(id) {
  if (selectedCardId) canvas.querySelector(`.card[data-id="${selectedCardId}"]`)?.classList.remove('selected');
  selectedCardId = id;
  canvas.querySelector(`.card[data-id="${id}"]`)?.classList.add('selected');
}

export function syncPinsOfCard(cardId, cardData, cardW) {
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
