// context-menu.js – the right-click menu on cards and pins.

import { ctxMenu } from './dom.js';
import { t } from './i18n.js';
import { openEditModal } from './modal.js';
import { addPinToCard, deletePin } from './pin-actions.js';
import { deleteCard } from './card-actions.js';
import { filterByCard } from './board-render.js';
import { setTool } from './tools.js';

let contextTarget = null;

export function onContextMenu(e) {
  e.preventDefault();
  const pin  = e.target.closest('.pin');
  const card = e.target.closest('.card');
  if (!pin && !card) return;
  contextTarget = pin
    ? { type: 'pin',  id: pin.dataset.id }
    : { type: 'card', id: card.dataset.id };
  showCtxMenu(e.clientX, e.clientY);
}

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
export function hideCtxMenu() { ctxMenu.classList.remove('visible'); }
