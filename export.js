// export.js – eksport PNG, JSON; import JSON; URL hash

// ── JSON Export ──────────────────────────────────────────
export function exportJSON(state) {
  const data = JSON.stringify({ cards: state.cards, pins: state.pins, threads: state.threads }, null, 2);
  const blob  = new Blob([data], { type: 'application/json' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href      = url;
  a.download  = `tablica-${dateStamp()}.json`;
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

// ── PNG Export – pełna tablica (cała zawartość + ramka) ──
export async function exportPNG(boardEl, threadSvgEl, canvasEl, state) {
  if (!window.html2canvas) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    document.head.appendChild(script);
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = () => reject(new Error('Nie można załadować html2canvas'));
    });
  }

  // Oblicz granice zawartości na podstawie pozycji kart
  const MARGIN = 80, CARD_W = 210, CARD_H = 270;
  let minX = 0, minY = 0, maxX = 800, maxY = 600;
  if (state.cards.length > 0) {
    minX = Math.min(...state.cards.map(c => c.x)) - MARGIN;
    minY = Math.min(...state.cards.map(c => c.y)) - MARGIN;
    maxX = Math.max(...state.cards.map(c => c.x + CARD_W)) + MARGIN;
    maxY = Math.max(...state.cards.map(c => c.y + CARD_H)) + MARGIN;
  }
  const contentW = Math.max(maxX - minX, 400);
  const contentH = Math.max(maxY - minY, 300);

  // Zachowaj obecne style
  const saved = {
    canvasT:      canvasEl.style.transform,
    svgT:         threadSvgEl.style.transform,
    boardPos:     boardEl.style.position,
    boardW:       boardEl.style.width,
    boardH:       boardEl.style.height,
    boardTop:     boardEl.style.top,
    boardLeft:    boardEl.style.left,
    boardOverflow:boardEl.style.overflow,
  };

  // Elementy nakładkowe (fixed) – ukryj podczas zrzutu
  const overlayIds = ['board-frame', 'minimap', 'left-panel', 'carousel-wrap', 'help-panel', 'back-to-cards'];
  const overlays = overlayIds.map(id => document.getElementById(id)).filter(Boolean);
  const savedDisplay = overlays.map(el => el.style.display);

  try {
    // Ustaw transform tak, żeby cała zawartość była widoczna od (0,0) przy zoom=1
    const t = `translate(${-minX}px,${-minY}px) scale(1)`;
    canvasEl.style.transform    = t;
    threadSvgEl.style.transform = t;

    // Zmień board-wrap z fixed na absolute o rozmiarze całej zawartości
    boardEl.style.position = 'absolute';
    boardEl.style.width    = contentW + 'px';
    boardEl.style.height   = contentH + 'px';
    boardEl.style.top      = '0';
    boardEl.style.left     = '0';
    boardEl.style.overflow = 'hidden';

    overlays.forEach(el => { el.style.display = 'none'; });

    // Poczekaj na renderowanie
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const cap = await window.html2canvas(boardEl, {
      useCORS:      true,
      backgroundColor: '#C9894E',
      scale:        1.5,
      logging:      false,
      width:        contentW,
      height:       contentH,
      windowWidth:  contentW,
      windowHeight: contentH,
      x: 0, y: 0,
    });

    const url = cap.toDataURL('image/png');
    const a   = document.createElement('a');
    a.href    = url;
    a.download = `tablica-${dateStamp()}.png`;
    a.click();
  } catch (e) {
    alert('Eksport PNG nieudany: ' + e.message);
  } finally {
    canvasEl.style.transform    = saved.canvasT;
    threadSvgEl.style.transform = saved.svgT;
    boardEl.style.position      = saved.boardPos;
    boardEl.style.width         = saved.boardW;
    boardEl.style.height        = saved.boardH;
    boardEl.style.top           = saved.boardTop;
    boardEl.style.left          = saved.boardLeft;
    boardEl.style.overflow      = saved.boardOverflow;
    overlays.forEach((el, i) => { el.style.display = savedDisplay[i]; });
  }
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
