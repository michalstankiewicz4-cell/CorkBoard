// tools.js – current tool selection (select/pin/thread/delete) and its UI sync.

import { state } from './state.js';
import { canvas } from './dom.js';

const CURSORS = { select: 'default', pin: 'cell', thread: 'crosshair', delete: 'not-allowed' };

export function setTool(tool) {
  state.tool = tool;
  canvas.style.cursor = CURSORS[tool] || 'default';
  updateToolBtns();
}

export function updateToolBtns() {
  document.querySelectorAll('.ci-tool[data-tool]').forEach(b =>
    b.classList.toggle('active-tool', b.dataset.tool === state.tool));
}

export function setPinColor(c)      { state.selectedPinColor = c; }
export function setThreadStriped(v) { state.selectedThreadStriped = v; }
export function setThreadWidth(v)   { state.selectedThreadWidth = parseFloat(v); }
export function setNoteColor(c)     { state.selectedNoteColor = c; }
