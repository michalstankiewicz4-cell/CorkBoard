// modal.js – the generic add/edit modal for every card type, driven by
// cards/registry.js + cards/field-form.js instead of a hand-written
// if/else chain per type.

import { state } from './state.js';
import { modal, modalOverlay, canvas } from './dom.js';
import { updateCardElement, esc } from './cards.js';
import { save } from './persist.js';
import { addCard } from './card-actions.js';
import { t } from './i18n.js';
import { CARD_TYPES } from './cards/registry.js';
import { buildFieldsHTML, readFieldsForm } from './cards/field-form.js';

let modalType = null, editingId = null;

// Open the add-modal for a card just dropped/clicked from the carousel,
// unless that type opts out (note/date have sensible defaults already).
export function openAddModalForId(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  if (CARD_TYPES[card.type]?.skipModalOnAdd) return;
  openEditModal(cardId);
}

export function openAddModal(type) { modalType = type; editingId = null; renderModal(type, null); }

export function openEditModal(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  modalType = card.type; editingId = cardId; renderModal(card.type, card.data);
}

function renderModal(type, d) {
  modal.innerHTML = buildModalHTML(type, d);
  modalOverlay.classList.add('visible');
  modal.querySelector('.modal-btn.primary').onclick = submitModal;
  modal.querySelector('.modal-btn.cancel').onclick  = hideModal;
  modal.querySelector('input, textarea')?.focus();
}

export function hideModal() { modalOverlay.classList.remove('visible'); }

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
  const def = CARD_TYPES[type];
  if (!def) return '';
  const fieldsHTML = def.renderFields ? def.renderFields(d) : buildFieldsHTML(def.fields, d);
  return `<h3>${t(def.titleKey)}</h3>${fieldsHTML}
    <div class="modal-btns">
      <button class="modal-btn cancel">${t('btn.cancel')}</button>
      <button class="modal-btn primary">${t('btn.save')}</button>
    </div>`;
}

function readModalForm(type) {
  const def = CARD_TYPES[type];
  if (!def) return null;
  const data = readFieldsForm(def.fields);
  if (!data) return null;
  if (def.postProcess) {
    const existingData = editingId ? state.cards.find(c => c.id === editingId)?.data : null;
    return def.postProcess(data, existingData);
  }
  return data;
}

// ── Image file preview helper (called from the image type's custom
// renderFields onchange/oninput handlers) ──────────────────────────────
window._loadImgPreview = function (input, directUrl) {
  const prev  = document.getElementById('mf-img-preview');
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
