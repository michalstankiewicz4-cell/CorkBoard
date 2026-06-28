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
      // fallback do blob-download
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
    backgroundColor: '#C9894E',
    scale:        SCALE,
    logging:      false,
    width:        contentW,
    height:       contentH,
    windowWidth:  contentW,
    windowHeight: contentH,
    x: 0, y: 0,
  });

  // Narysuj drewnianą ramkę gradientową (replika #board-frame::before z CSS)
  const ctx = cap.getContext('2d');
  // html2canvas zostawia ctx.scale(SCALE, SCALE) — resetujemy do współrzędnych pikselowych
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const F = Math.round(22 * SCALE); // szerokość ramki w pikselach canvas
  const W = cap.width, H = cap.height;

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

  const url = cap.toDataURL('image/png');
  const a   = document.createElement('a');
  a.href    = url;
  a.download = `tablica-${dateStamp()}.png`;
  a.click();
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

function dateStamp() {
  return new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
}
