// import-notes.js – "Import Notes" overlay: crop rectangles out of a
// photographed corkboard/whiteboard image, OCR them (optional), and drop
// the results onto the board as Image/Note cards.

import { esc } from './cards.js';
import { t } from './i18n.js';
import { addCard } from './card-actions.js';
import { pan, zoom, getViewportSize } from './viewport.js';

const IN = { img: null, scale: 1, selections: [], nextId: 1, drawing: null, mode: 'image' };
let tesseractPromise = null;

export function doImportNotes() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => openInOverlay(img);
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function openInOverlay(img) {
  IN.img = img; IN.selections = []; IN.nextId = 1; IN.drawing = null; IN.mode = 'image';
  const overlay = document.getElementById('in-overlay');
  overlay.style.display = 'flex';
  document.querySelectorAll('.in-mode-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === 'image'));
  requestAnimationFrame(() => {
    const wrap = document.getElementById('in-canvas-wrap');
    const maxW = wrap.clientWidth - 20;
    const maxH = wrap.clientHeight - 20;
    IN.scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const cv = document.getElementById('in-canvas');
    cv.width  = Math.round(img.width  * IN.scale);
    cv.height = Math.round(img.height * IN.scale);
    inRedraw();
    inUpdateList();
    cv.onmousedown  = inMouseDown;
    cv.onmousemove  = inMouseMove;
    cv.onmouseup    = inMouseUp;
    cv.onmouseleave = () => { IN.drawing = null; inRedraw(); };
  });
}

function inRedraw() {
  const cv = document.getElementById('in-canvas'); if (!cv || !IN.img) return;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(IN.img, 0, 0, cv.width, cv.height);
  IN.selections.forEach((s, i) => {
    const col = s.type === 'image' ? '#4fc3f7' : '#aed581';
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([]);
    ctx.strokeRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = col;
    ctx.fillRect(s.x, s.y - 18, 22, 18);
    ctx.fillStyle = '#000'; ctx.font = 'bold 13px sans-serif';
    ctx.fillText(i + 1, s.x + 5, s.y - 3);
  });
  if (IN.drawing) {
    const col = IN.mode === 'image' ? '#4fc3f7' : '#aed581';
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
    ctx.strokeRect(IN.drawing.x, IN.drawing.y, IN.drawing.w, IN.drawing.h);
    ctx.setLineDash([]);
  }
}

function inMouseDown(e) {
  const r = e.currentTarget.getBoundingClientRect();
  IN.drawing = { x: e.clientX - r.left, y: e.clientY - r.top, w: 0, h: 0 };
}
function inMouseMove(e) {
  if (!IN.drawing) return;
  const r = e.currentTarget.getBoundingClientRect();
  IN.drawing.w = (e.clientX - r.left) - IN.drawing.x;
  IN.drawing.h = (e.clientY - r.top)  - IN.drawing.y;
  inRedraw();
}
function inMouseUp() {
  if (!IN.drawing) return;
  const { x, y, w, h } = IN.drawing; IN.drawing = null;
  if (Math.abs(w) < 10 || Math.abs(h) < 10) { inRedraw(); return; }
  const nx = w < 0 ? x + w : x, ny = h < 0 ? y + h : y;
  const nw = Math.abs(w), nh = Math.abs(h);
  const crop = document.createElement('canvas');
  crop.width = nw; crop.height = nh;
  crop.getContext('2d').drawImage(IN.img, nx / IN.scale, ny / IN.scale, nw / IN.scale, nh / IN.scale, 0, 0, nw, nh);
  const sel = { id: IN.nextId++, x: nx, y: ny, w: nw, h: nh, type: IN.mode, dataUrl: crop.toDataURL(), ocrText: undefined };
  IN.selections.push(sel);
  inRedraw(); inUpdateList();
  if (sel.type === 'ocr') inRunOCR(sel);
}

function inUpdateList() {
  const list = document.getElementById('in-list'); if (!list) return;
  if (IN.selections.length === 0) {
    list.innerHTML = `<div class="in-empty">${t('in.noSel')}</div>`; return;
  }
  list.innerHTML = IN.selections.map((s, i) => `
    <div class="in-sel">
      <div class="in-sel-num">${i + 1}</div>
      <img class="in-sel-thumb" src="${s.dataUrl}" alt=""/>
      <div class="in-sel-row">
        <button class="in-tbtn${s.type==='image'?' active':''}" onclick="window._inType(${s.id},'image')">🖼</button>
        <button class="in-tbtn${s.type==='ocr'?' active':''}" onclick="window._inType(${s.id},'ocr')">🔤</button>
        <button class="in-del" onclick="window._inDel(${s.id})">✕</button>
      </div>
      ${s.type==='ocr' ? `<div class="in-ocr-text">${s.ocrText !== undefined ? esc(s.ocrText) : `<em>${t('in.recognizing')}</em>`}</div>` : ''}
    </div>`).join('');
}

async function inRunOCR(sel) {
  inUpdateList(); // show "Recognizing…" immediately (ocrText is undefined)
  try {
    if (!window.Tesseract) {
      if (!tesseractPromise) {
        tesseractPromise = new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
          s.onload = res; s.onerror = rej; document.head.appendChild(s);
        });
      }
      await tesseractPromise;
    }
    const { data: { text } } = await Tesseract.recognize(sel.dataUrl, 'eng+pol');
    sel.ocrText = text.trim();
  } catch (err) {
    console.warn('OCR error:', err);
    sel.ocrText = ''; // empty string = done (prevents infinite retry)
  }
  inUpdateList();
}

window._inType = (id, type) => {
  const sel = IN.selections.find(s => s.id === id); if (!sel) return;
  sel.type = type;
  if (type === 'ocr' && sel.ocrText === undefined) inRunOCR(sel);
  else inUpdateList();
  inRedraw();
};
window._inDel = (id) => {
  IN.selections = IN.selections.filter(s => s.id !== id);
  inRedraw(); inUpdateList();
};
window._inSetMode = (mode) => {
  IN.mode = mode;
  document.querySelectorAll('.in-mode-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode));
};
window._inClearAll = () => { IN.selections = []; IN.nextId = 1; inRedraw(); inUpdateList(); };
window._inClose = () => {
  document.getElementById('in-overlay').style.display = 'none';
  IN.img = null; IN.selections = [];
};
window._inAddToBoard = () => {
  if (IN.selections.length === 0) return;
  const hasPending = IN.selections.some(s => s.type === 'ocr' && s.ocrText === undefined);
  if (hasPending && !confirm(t('confirm.ocrPending'))) return;
  const CARD_W = 220, GAP = 16;
  const total = IN.selections.length;
  const { vpW, vpH } = getViewportSize();
  const startX = (-pan.x + vpW / 2) / zoom - (total * (CARD_W + GAP)) / 2;
  const startY = (-pan.y + vpH / 2) / zoom - 120;
  IN.selections.forEach((sel, i) => {
    const x = startX + i * (CARD_W + GAP);
    if (sel.type === 'image') addCard('image', { url: sel.dataUrl, caption: '' }, x, startY);
    else addCard('note', { text: sel.ocrText || '', color: 'y' }, x, startY);
  });
  document.getElementById('in-overlay').style.display = 'none';
  IN.img = null; IN.selections = [];
};
