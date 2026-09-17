// history.js – undo/redo stack of full board snapshots.

import { state } from './state.js';
import { save } from './persist.js';
import { renderAll } from './board-render.js';
import { scheduleMinimap } from './viewport.js';

const MAX_HISTORY = 50;
const undoStack = [];
const redoStack = [];

function snapState() {
  return JSON.parse(JSON.stringify({
    cards: state.cards, pins: state.pins, threads: state.threads,
    groups: state.groups, nextId: state.nextId,
  }));
}

export function pushHistory() {
  undoStack.push(snapState());
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
}

function applySnap(snap) {
  state.cards   = snap.cards;
  state.pins    = snap.pins;
  state.threads = snap.threads;
  state.groups  = snap.groups;
  state.nextId  = snap.nextId;
  renderAll(); save(); scheduleMinimap();
}

export function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapState());
  applySnap(undoStack.pop());
}

export function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapState());
  applySnap(redoStack.pop());
}
