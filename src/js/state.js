// state.js – the single shared board state object.
//
// Exported by reference and mutated in place everywhere (assign to its
// properties, never reassign the `state` binding itself) so every module
// that imports it always sees the same live object.

export const state = {
  cards: [], pins: [], threads: [],
  nextId: 1, currentView: 'basic',
  selectedPinColor: 'red',
  selectedThreadColor: 'r', selectedThreadColor2: 'w',
  selectedThreadStriped: false, selectedThreadWidth: 1.8,
  selectedNoteColor: 'y',
  tool: 'select',
  filterCardId: null,
  groups: [],
};

// Replace the state's contents with `data` (keys not present in `data`
// keep their current value) without breaking the shared reference.
export function replaceState(data) {
  Object.assign(state, data);
}
