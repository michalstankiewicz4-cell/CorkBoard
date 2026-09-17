// dom.js – shared DOM element references, looked up once.
// Every other module imports these instead of re-querying document.

export const boardWrap    = document.getElementById('board-wrap');
export const canvas       = document.getElementById('canvas');
export const threadSvg    = document.getElementById('thread-svg');
export const ctxMenu      = document.getElementById('ctx-menu');
export const modalOverlay = document.getElementById('modal-overlay');
export const modal        = document.getElementById('modal');
