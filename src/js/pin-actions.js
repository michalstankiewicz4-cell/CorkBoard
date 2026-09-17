// pin-actions.js – add/delete pins.

import { state } from './state.js';
import { canvas } from './dom.js';
import { pushHistory } from './history.js';
import { save } from './persist.js';
import { toCanvas } from './viewport.js';
import { makePinEl, renderVisibleThreadsNow } from './board-render.js';

export function addPinToCard(cardId) {
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

export function addPinAtPosition(x, y) {
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

export function deletePin(pinId, rerender = true) {
  if (rerender) pushHistory();
  state.threads = state.threads.filter(th => th.fromPin !== pinId && th.toPin !== pinId);
  state.pins    = state.pins.filter(p => p.id !== pinId);
  canvas.querySelector(`.pin[data-id="${pinId}"]`)?.remove();
  if (rerender) { renderVisibleThreadsNow(); save(); }
}
