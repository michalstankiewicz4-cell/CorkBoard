// persist.js – localStorage save, factored out of app.js so history.js
// (and anything else) can call it without importing app.js back (would
// create a circular import, since app.js re-exports history's undo/redo).

import { state } from './state.js';
import { saveState } from './storage.js';

export function save() {
  saveState({ cards: state.cards, pins: state.pins, threads: state.threads, nextId: state.nextId, groups: state.groups });
}
