// thread-actions.js – add/delete threads and the thread edit modal.

import { state } from './state.js';
import { modal, modalOverlay } from './dom.js';
import { esc } from './cards.js';
import { t } from './i18n.js';
import { pushHistory } from './history.js';
import { save } from './persist.js';
import { renderVisibleThreadsNow, setThreadClickHandler } from './board-render.js';

export function addThread(fromPinId, toPinId) {
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
  renderVisibleThreadsNow();
  save();
}

export function deleteThread(threadId) {
  pushHistory();
  state.threads = state.threads.filter(th => th.id !== threadId);
  renderVisibleThreadsNow();
  save();
}

function hideModal() { modalOverlay.classList.remove('visible'); }
window.hideModalUI = hideModal;
window.deleteThreadUI = (id) => { deleteThread(id); hideModal(); };

export function openThreadEditModal(threadId) {
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
    renderVisibleThreadsNow();
    hideModal(); save();
  };
}

export function onThreadClick(threadId) {
  if (state.tool !== 'delete') {
    openThreadEditModal(threadId);
  } else {
    deleteThread(threadId);
  }
}

// Registered here (rather than board-render.js importing this module
// directly) to avoid a circular import: board-render.js exposes
// getVisibleThreads()/renderVisibleThreadsNow() that this module calls,
// while board-render.js's own renderAll() needs a click handler to wire
// onto every rendered thread.
setThreadClickHandler(onThreadClick);
