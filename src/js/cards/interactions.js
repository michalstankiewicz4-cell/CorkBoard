// cards/interactions.js – the on-card controls that aren't the add/edit
// modal: the Yes/No checkbox and the Scale/Spectrum drag-to-set tracks.
//
// The drag math is split into pure, unit-testable functions
// (ratioFromVerticalDrag / ratioFromHorizontalDrag / valueFromRatio) that
// take a clientX/Y and a DOMRect and return a plain number — no DOM access,
// no closures over card/board state.

import { state } from '../state.js';
import { updateCardElement } from '../cards.js';
import { save } from '../persist.js';

export function ratioFromVerticalDrag(clientY, rect) {
  return Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
}

export function ratioFromHorizontalDrag(clientX, rect) {
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
}

export function valueFromRatio(ratio, steps = 10) {
  return Math.round(ratio * steps);
}

// Toggle a yes/no card's answer (called from the checkbox onclick in cards.js)
export function toggleYesNo(el) {
  const cardEl = el.closest('.card');
  if (!cardEl) return;
  const card = state.cards.find(c => c.id === cardEl.dataset.id);
  if (!card) return;
  const val = el.dataset.yn;
  card.data.answer = card.data.answer === val ? null : val;
  updateCardElement(cardEl, card);
  save();
}

function startTrackDrag(e, trackEl, trackSelector, getRatio, getClientCoord) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const cardEl = trackEl.closest('.card');
  if (!cardEl) return;
  const card = state.cards.find(c => c.id === cardEl.dataset.id);
  if (!card) return;

  const update = ev => {
    // Re-query each time: updateCardElement replaces the card's innerHTML,
    // so any earlier reference to the track node goes stale after the first tick.
    const track = cardEl.querySelector(trackSelector);
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const val = valueFromRatio(getRatio(getClientCoord(ev), rect));
    if (card.data.value !== val) {
      card.data.value = val;
      updateCardElement(cardEl, card);
    }
  };
  update(e);

  const onMove = ev => update(ev);
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    save();
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

// Drag/click a scale card's vertical track to set its 0-10 value
// (called from the track's onmousedown in cards.js)
export function startScaleDrag(e, trackEl) {
  startTrackDrag(e, trackEl, '.cs-track', ratioFromVerticalDrag, ev => ev.clientY);
}

// Drag/click a spectrum card's horizontal track to set its 0-10 value
// (called from the track's onmousedown in cards.js)
export function startSpectrumDrag(e, trackEl) {
  startTrackDrag(e, trackEl, '.csp-track', ratioFromHorizontalDrag, ev => ev.clientX);
}
