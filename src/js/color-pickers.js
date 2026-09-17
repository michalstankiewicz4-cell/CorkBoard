// color-pickers.js – the floating swatch pickers opened from the Pin/Thread
// carousel tools.

import { state } from './state.js';
import { PIN_COLORS } from './cards.js';
import { t } from './i18n.js';
import { setTool } from './tools.js';

// ── Pin color picker ──────────────────────────────────────
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
  setTimeout(() => {
    pinDismiss = () => hidePinColorPicker();
    document.addEventListener('click', pinDismiss, { once: true });
  }, 0);
}

let pinDismiss = null;
export function hidePinColorPicker() {
  document.getElementById('pin-color-picker')?.remove();
  if (pinDismiss) { document.removeEventListener('click', pinDismiss); pinDismiss = null; }
}

// ── Thread color picker ───────────────────────────────────
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
  setTimeout(() => {
    threadDismiss = () => hideThreadColorPicker();
    document.addEventListener('click', threadDismiss, { once: true });
  }, 0);
}

let threadDismiss = null;
export function hideThreadColorPicker() {
  document.getElementById('thread-color-picker')?.remove();
  if (threadDismiss) { document.removeEventListener('click', threadDismiss); threadDismiss = null; }
}
