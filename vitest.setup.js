// vitest.setup.js – the app's source files are written for a browser and
// reference `window` for a couple of small globals (currently just
// i18n.js's `window.appLang`). Rather than pull in a full DOM emulation
// (jsdom) just for that, alias `window` to the Node global object so
// `window.appLang` reads as `undefined` and the existing `|| 'en'`
// fallback in i18n.js's t() kicks in — exactly how it behaves in a real
// browser before the app calls setLang().
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}
