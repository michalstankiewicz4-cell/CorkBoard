// export.js – eksport PNG, JSON; import JSON; URL hash

// ── JSON Export ──────────────────────────────────────────
export async function exportJSON(state) {
  const data     = JSON.stringify({ cards: state.cards, pins: state.pins, threads: state.threads }, null, 2);
  const filename = `tablica-${dateStamp()}.json`;

  // File System Access API — natywny dialog z pamięcią ostatniego folderu
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Plik JSON', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // użytkownik anulował
      console.warn('showSaveFilePicker nie powiodło się, używam blob-download:', e);
    }
  }

  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── JSON Import ──────────────────────────────────────────
export function importJSON(onLoad) {
  const input    = document.createElement('input');
  input.type     = 'file';
  input.accept   = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.cards && data.pins && data.threads) {
          onLoad(data);
        } else {
          alert('Nieprawidłowy format pliku.');
        }
      } catch {
        alert('Błąd parsowania JSON.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ── PNG Export – pełna tablica (wywoływana z app.js po przygotowaniu DOM) ──
export async function exportPNG(boardEl, contentW, contentH) {
  const SCALE = 1.5;
  if (!window.html2canvas) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    document.head.appendChild(script);
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = () => reject(new Error('Nie można załadować html2canvas'));
    });
  }

  const cap = await window.html2canvas(boardEl, {
    useCORS:      true,
    allowTaint:   true,
    backgroundColor: '#C9894E',
    scale:        SCALE,
    logging:      false,
    width:        contentW,
    height:       contentH,
    windowWidth:  contentW,
    windowHeight: contentH,
    x: 0, y: 0,
  });

  const ctx = cap.getContext('2d');
  // html2canvas zostawia ctx.scale(SCALE, SCALE) — resetujemy do współrzędnych pikselowych
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const W = cap.width, H = cap.height;

  // ── Ręczne cienie kart (html2canvas nie renderuje box-shadow niezawodnie) ──
  // Technika: shadow-only canvas → destination-out wymazuje obszar karty → drawImage na główny
  {
    const sc = document.createElement('canvas');
    sc.width = W; sc.height = H;
    const sx = sc.getContext('2d');

    function rPath(c, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      if (c.roundRect) { c.beginPath(); c.roundRect(x, y, w, h, r); return; }
      c.beginPath(); c.moveTo(x + r, y);
      c.arcTo(x + w, y,     x + w, y + h, r);
      c.arcTo(x + w, y + h, x,     y + h, r);
      c.arcTo(x,     y + h, x,     y,     r);
      c.arcTo(x,     y,     x + w, y,     r);
      c.closePath();
    }

    boardEl.querySelectorAll('.card').forEach(el => {
      const cx = parseFloat(el.style.left) * SCALE;
      const cy = parseFloat(el.style.top)  * SCALE;
      const cw = el.offsetWidth  * SCALE;
      const ch = el.offsetHeight * SCALE;
      if (!cw || !ch) return;
      const br = (parseFloat(getComputedStyle(el).borderRadius) || 3) * SCALE;
      const tf = el.style.transform || getComputedStyle(el).transform;
      const rm = tf.match(/rotate\(([-\d.]+)deg\)/);
      const ar = rm ? parseFloat(rm[1]) * Math.PI / 180 : 0;

      const shadow = (color, blur, ox, oy) => {
        sx.save();
        sx.translate(cx + cw / 2, cy + ch / 2);
        sx.rotate(ar);
        sx.shadowColor = color; sx.shadowBlur = blur * SCALE;
        sx.shadowOffsetX = ox * SCALE; sx.shadowOffsetY = oy * SCALE;
        sx.fillStyle = '#000';
        rPath(sx, -cw / 2, -ch / 2, cw, ch, br);
        sx.fill();
        sx.restore();
      };

      shadow('rgba(0,0,0,.38)', 18, 3, 6);
      shadow('rgba(0,0,0,.2)',   6, 1, 2);

      // Wymaż obszar karty — zostaje tylko aureola cienia
      sx.save();
      sx.globalCompositeOperation = 'destination-out';
      sx.translate(cx + cw / 2, cy + ch / 2);
      sx.rotate(ar);
      sx.fillStyle = '#000';
      rPath(sx, -cw / 2, -ch / 2, cw, ch, br);
      sx.fill();
      sx.restore();
    });

    ctx.drawImage(sc, 0, 0);
  }

  // Narysuj drewnianą ramkę gradientową (replika #board-frame::before z CSS)
  const F = Math.round(22 * SCALE); // szerokość ramki w pikselach canvas

  // Przystanki gradientu z #board-frame::before (pozycje CSS px → ułamek 0–1)
  const stops = [
    [0,      '#8B5225'],
    [2/22,   '#A0632E'],
    [4/22,   '#7D4E22'],
    [6/22,   '#C4884A'],
    [8/22,   '#9B6030'],
    [10/22,  '#B87840'],
    [12/22,  '#7D4E22'],
    [14/22,  '#8B5225'],
    [16/22,  '#6B3F1A'],
    [18/22,  '#5a3214'],
    [1,      'rgba(90,50,20,0)'],
  ];
  function makeGrad(x1, y1, x2, y2) {
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    stops.forEach(([t, c]) => g.addColorStop(t, c));
    return g;
  }

  // Lewa i prawa (pełna wysokość) — pod narożnikami
  ctx.fillStyle = makeGrad(0, 0, F, 0);
  ctx.fillRect(0, 0, F, H);
  ctx.fillStyle = makeGrad(W, 0, W - F, 0);
  ctx.fillRect(W - F, 0, F, H);

  // Góra i dół (pełna szerokość) — na wierzchu narożników jak w CSS
  ctx.fillStyle = makeGrad(0, 0, 0, F);
  ctx.fillRect(0, 0, W, F);
  ctx.fillStyle = makeGrad(0, H, 0, H - F);
  ctx.fillRect(0, H - F, W, F);

  const pageUrl = window.location.href;
  const pngBlob = await new Promise(res => cap.toBlob(res, 'image/png'));
  const src     = new Uint8Array(await pngBlob.arrayBuffer());
  const patched = pngInjectText(src, 'Source-URL', pageUrl);
  const dlUrl   = URL.createObjectURL(new Blob([patched], { type: 'image/png' }));
  const a       = document.createElement('a');
  a.href        = dlUrl;
  a.download    = `tablica-${dateStamp()}.png`;
  a.click();
  URL.revokeObjectURL(dlUrl);
}

// ── URL Hash ─────────────────────────────────────────────
export function saveToHash(state) {
  try {
    const compact = {
      c: state.cards.map(c => ({ i:c.id, t:c.type, x:Math.round(c.x), y:Math.round(c.y), a:c.angle?.toFixed(1), d:c.data })),
      p: state.pins.map(p => ({ i:p.id, x:Math.round(p.x), y:Math.round(p.y), c:p.color, ci:p.cardId })),
      th: state.threads.map(t => ({ i:t.id, f:t.fromPin, t2:t.toPin, c:t.color, s:t.striped, c2:t.stripeColor2, l:t.label, w:t.width })),
    };
    const json = JSON.stringify(compact);
    const bytes = new TextEncoder().encode(json);
    // Chunk aby uniknąć RangeError przy spread >65536 elementów
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    const encoded = btoa(binary);
    history.replaceState(null, '', '#' + encoded);
  } catch {
    // Zbyt duże – ignoruj
  }
}

export function loadFromHash() {
  try {
    const hash = window.location.hash.slice(1);
    if (!hash) return null;
    const bytes = atob(hash);
    const arr = new Uint8Array([...bytes].map(c => c.charCodeAt(0)));
    const raw = JSON.parse(new TextDecoder().decode(arr));
    return {
      cards:   raw.c.map(c => ({ id:c.i, type:c.t, x:c.x, y:c.y, angle:parseFloat(c.a||0), data:c.d })),
      pins:    raw.p.map(p => ({ id:p.i, x:p.x, y:p.y, color:p.c, cardId:p.ci })),
      threads: raw.th.map(t => ({ id:t.i, fromPin:t.f, toPin:t.t2, color:t.c, striped:t.s, stripeColor2:t.c2, label:t.l, width:t.w })),
    };
  } catch {
    return null;
  }
}

// ── PNG Metadata ─────────────────────────────────────────
function makeCrc32Table() {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
}
const _CRC = makeCrc32Table();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = _CRC[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngInjectText(src, keyword, text) {
  const enc  = new TextEncoder();
  const kw   = enc.encode(keyword);
  const tx   = enc.encode(text);
  const data = new Uint8Array(kw.length + 1 + tx.length);
  data.set(kw); data[kw.length] = 0; data.set(tx, kw.length + 1);
  const type   = enc.encode('tEXt');
  const crcBuf = new Uint8Array(4 + data.length);
  crcBuf.set(type); crcBuf.set(data, 4);
  const chunk = new Uint8Array(12 + data.length);
  new DataView(chunk.buffer).setUint32(0, data.length, false);
  chunk.set(type, 4); chunk.set(data, 8);
  new DataView(chunk.buffer).setUint32(8 + data.length, crc32(crcBuf), false);
  // Wstaw po IHDR (sygnatura 8 bajtów + chunk IHDR 25 bajtów = offset 33)
  const ins = 33;
  const out = new Uint8Array(src.length + chunk.length);
  out.set(src.subarray(0, ins)); out.set(chunk, ins); out.set(src.subarray(ins), ins + chunk.length);
  return out;
}

function pngReadTextChunks(src) {
  const result = {}, dec = new TextDecoder();
  let off = 8;
  const view = new DataView(src.buffer, src.byteOffset);
  while (off + 12 <= src.length) {
    const len  = view.getUint32(off, false);
    const type = String.fromCharCode(src[off+4], src[off+5], src[off+6], src[off+7]);
    if (type === 'IEND') break;
    if (type === 'tEXt') {
      const data = src.subarray(off + 8, off + 8 + len);
      const nul  = data.indexOf(0);
      if (nul !== -1) result[dec.decode(data.subarray(0, nul))] = dec.decode(data.subarray(nul + 1));
    }
    off += 12 + len;
  }
  return result;
}

export function importPNG(onLoad) {
  const input    = document.createElement('input');
  input.type     = 'file';
  input.accept   = '.png,image/png';
  input.onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    const bytes  = new Uint8Array(await file.arrayBuffer());
    const chunks = pngReadTextChunks(bytes);
    const srcUrl = chunks['Source-URL'];
    if (!srcUrl) { alert('Ten plik PNG nie zawiera danych tablicy.'); return; }
    const hashIdx = srcUrl.indexOf('#');
    if (hashIdx === -1) { alert('Brak danych stanu w metadanych PNG.'); return; }
    const hash = srcUrl.slice(hashIdx + 1);
    try {
      const bin = atob(hash);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const raw = JSON.parse(new TextDecoder().decode(arr));
      onLoad({
        cards:   raw.c.map(c => ({ id:c.i, type:c.t, x:c.x, y:c.y, angle:parseFloat(c.a||0), data:c.d })),
        pins:    raw.p.map(p => ({ id:p.i, x:p.x, y:p.y, color:p.c, cardId:p.ci })),
        threads: raw.th.map(t => ({ id:t.i, fromPin:t.f, toPin:t.t2, color:t.c, striped:t.s, stripeColor2:t.c2, label:t.l, width:t.w })),
      });
    } catch { alert('Błąd odczytu danych z PNG.'); }
  };
  input.click();
}

function dateStamp() {
  return new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
}
