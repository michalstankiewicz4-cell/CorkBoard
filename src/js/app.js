// app.js – composition root. Wires together the smaller modules below and
// re-exports the public surface index.html's onclick="App.xxx()" handlers
// and cards.js's inline handlers call.
//
// See src/js/cards/registry.js for where a card type's fields/carousel
// entry live, and the other src/js/*.js modules for everything that used
// to be inline here (state, viewport, history, card/pin/thread CRUD, the
// add/edit modal, color pickers, Import Notes/OCR, PNG export, print).

import { state, replaceState } from './state.js';
import { canvas } from './dom.js';
import { computeViewPositions } from './views.js';
import { loadState } from './storage.js';
import { SAMPLE_DATA } from './data/sample-board.js';
import { exportJSON, importJSON, importPNG, saveToHash, loadFromHash } from './export.js';
import { save } from './persist.js';
import { t } from './i18n.js';

import { renderAll, renderVisibleThreadsNow } from './board-render.js';
import { bindEvents } from './board-events.js';
import { pushHistory, undo, redo } from './history.js';
import { resetView, zoomIn, zoomOut, getPanZoom, scheduleMinimap, initViewport } from './viewport.js';
import { setTool, updateToolBtns, setPinColor, setThreadStriped, setThreadWidth, setNoteColor } from './tools.js';
import { addCard } from './card-actions.js';
import { showPinColorPicker, hidePinColorPicker, showThreadColorPicker, hideThreadColorPicker } from './color-pickers.js';
import { openAddModal, openAddModalForId, hideModal } from './modal.js';
import { toggleYesNo, startScaleDrag, startSpectrumDrag } from './cards/interactions.js';
import { doImportNotes } from './import-notes.js';
import { doExportPNG } from './png-export-dom.js';
import './print.js'; // side-effect only: registers beforeprint/afterprint

// ── Init ────────────────────────────────────────────────
export function init() {
  // Load order: hash → localStorage → sample data
  const fromHash = loadFromHash();
  const saved    = loadState();
  if (fromHash && fromHash.cards.length) {
    replaceState(fromHash);
    state.nextId = maxIdFromData(fromHash);
    history.replaceState(null, '', location.pathname + location.search);
  } else if (saved && saved.cards && saved.cards.length) {
    replaceState(saved);
    if (!state.groups) state.groups = [];
  } else {
    state.cards   = SAMPLE_DATA.cards.map(c => ({...c, data:{...c.data}}));
    state.pins    = SAMPLE_DATA.pins.map(p => ({...p}));
    state.threads = SAMPLE_DATA.threads.map(th => ({...th}));
    state.nextId  = 300;
  }

  initViewport();
  renderAll();
  bindEvents();
  updateViewBtns();
  updateToolBtns();
  scheduleMinimap();
}

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
    renderVisibleThreadsNow(tempPins);
    canvas.querySelectorAll('.card').forEach(el => el.classList.remove('view-transition'));
    scheduleMinimap();
  }, 540);
}

function updateViewBtns() {
  document.querySelectorAll('.view-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.view === state.currentView));
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
    replaceState({ cards: data.cards, pins: data.pins, threads: data.threads, nextId: maxIdFromData(data) });
    renderAll(); save(); scheduleMinimap();
  });
}

export function doImportPNG() {
  importPNG(data => {
    pushHistory();
    replaceState({ cards: data.cards, pins: data.pins, threads: data.threads, nextId: maxIdFromData(data) });
    renderAll(); save(); scheduleMinimap();
  });
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

// ── Public API (window.App = this module, see index.html) ────────────────
export {
  addCard, openAddModal, openAddModalForId, hideModal,
  toggleYesNo, startScaleDrag, startSpectrumDrag,
  showPinColorPicker, hidePinColorPicker, showThreadColorPicker, hideThreadColorPicker,
  setTool, setPinColor, setThreadStriped, setThreadWidth, setNoteColor,
  resetView, zoomIn, zoomOut, getPanZoom,
  undo, redo,
  doImportNotes, doExportPNG,
};
