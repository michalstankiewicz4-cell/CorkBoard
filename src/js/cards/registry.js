// cards/registry.js – the single source of truth for each card type's
// carousel entry (icon, label, default data) and add/edit-modal fields.
//
// This is intentionally decoupled from board rendering: how a card *looks*
// on the corkboard stays in cards.js's buildXxx() functions (already small,
// pure, per-type functions — nothing to fix there). This registry only
// owns "what fields does the add/edit modal show, and what's the default
// data when you drag this type onto the board" — the part that used to be
// hand-duplicated across index.html, app.js's buildModalHTML/readModalForm,
// and the `titles` map.
//
// Adding a new card type now means: add one entry here (+ its render
// function in cards.js, + i18n keys) — nothing else needs to change.

import { NOTE_COLORS, esc } from '../cards.js';
import { t } from '../i18n.js';

function buildNoteColorOptions(selected) {
  return Object.keys(NOTE_COLORS)
    .map(k => `<option value="${k}"${selected === k ? ' selected' : ''}>${t('color.' + k)}</option>`)
    .join('');
}

const NEWS_ACCENTS = ['#e63946', '#1565c0', '#2e7d32', '#9b59b6', '#f4511e', '#0097a7', '#c8971c'];
function buildNewsAccentOptions(selected) {
  return NEWS_ACCENTS
    .map(c => `<option value="${c}"${selected === c ? ' selected' : ''}>${c}</option>`)
    .join('');
}

// person + unknown share the exact same modal fields (only their render
// function, icon and default data differ) — same as the original
// `type==='person'||type==='unknown'` branch in app.js.
function personFields() {
  return [
    { key: 'name',       kind: 'text', labelKey: 'field.name',       required: true, requiredAlertKey: 'alert.enterName' },
    { key: 'role',       kind: 'text', labelKey: 'field.role' },
    { key: 'party',      kind: 'text', labelKey: 'field.party' },
    { key: 'partyColor', kind: 'text', labelKey: 'field.partyColor', displayFallback: '#666666', readFallback: '#666' },
    { key: 'emoji',      kind: 'text', labelKey: 'field.emoji',      displayFallback: '👤',       readFallback: '👤' },
    { key: 'photo',      kind: 'text', labelKey: 'field.photo' },
  ];
}

export const CARD_TYPES = {
  note: {
    icon: '📝', labelKey: 'ci.note', titleKey: 'modal.note',
    defaultData: { text: 'Notatka', color: 'y' },
    skipModalOnAdd: true, // sensible defaults – dragging one onto the board doesn't need the modal
    fields: [
      { key: 'text',  kind: 'textarea', labelKey: 'field.noteText' },
      { key: 'color', kind: 'select',   labelKey: 'field.noteColor', optionsBuilder: buildNoteColorOptions, selectFallback: 'y' },
    ],
  },
  yesno: {
    icon: '☑️', labelKey: 'ci.yesno', titleKey: 'modal.yesno',
    defaultData: { question: 'Pytanie?', answer: null },
    fields: [
      { key: 'question', kind: 'text', labelKey: 'field.question', requiredMark: true, required: true, requiredAlertKey: 'alert.enterQuestion' },
    ],
    // The answer is set by clicking the card itself (cards/interactions.js toggleYesNo),
    // not the modal — preserve it across an edit instead of letting it reset to null.
    postProcess: (data, existingData) => ({ ...data, answer: existingData?.answer ?? null }),
  },
  scale: {
    icon: '📊', labelKey: 'ci.scale', titleKey: 'modal.scale',
    defaultData: { question: 'Pytanie?', value: 5 },
    fields: [
      { key: 'question', kind: 'text',  labelKey: 'field.question',   requiredMark: true, required: true, requiredAlertKey: 'alert.enterQuestion' },
      { key: 'value',    kind: 'range', labelKey: 'field.scaleValue', min: 0, max: 10, step: 1, rangeDefault: 5 },
    ],
  },
  spectrum: {
    icon: '↔️', labelKey: 'ci.spectrum', titleKey: 'modal.spectrum',
    defaultData: { label: 'Kto / co?', value: 5 },
    fields: [
      { key: 'label', kind: 'text',  labelKey: 'field.label',         requiredMark: true, required: true, requiredAlertKey: 'alert.enterLabel' },
      { key: 'value', kind: 'range', labelKey: 'field.spectrumValue', min: 0, max: 10, step: 1, rangeDefault: 5 },
    ],
  },
  image: {
    icon: '🖼️', labelKey: 'ci.image', titleKey: 'modal.image',
    defaultData: { url: '', caption: '' },
    // File-upload + live URL preview is bespoke enough (a second input
    // writing into the same `url` field, plus a live <img> preview) that it
    // gets its own markup — but still reads back through the same generic
    // `fields` list below, so no readForm override is needed.
    renderFields: (d) => `
      <div class="modal-field"><label>${t('field.imageFile')}</label>
        <input type="file" id="mf-imgfile" accept="image/*" style="color:#c8a870" onchange="window._loadImgPreview(this)"/></div>
      <div class="modal-field"><label>${t('field.imageURL')}</label>
        <input id="mf-url" value="${esc(d?.url)}" placeholder="https://..." oninput="window._loadImgPreview(null,this.value)"/></div>
      <div id="mf-img-preview" style="text-align:center;margin:4px 0;min-height:40px">
        ${d?.url ? `<img src="${esc(d.url)}" style="max-width:220px;max-height:150px;border-radius:5px;object-fit:contain"/>` : ''}</div>
      <div class="modal-field"><label>${t('field.caption')}</label><input id="mf-caption" value="${esc(d?.caption)}"/></div>`,
    fields: [
      { key: 'url',     kind: 'text', required: true, requiredAlertKey: 'alert.noImage' },
      { key: 'caption', kind: 'text', labelKey: 'field.caption' },
    ],
  },
  date: {
    icon: '📅', labelKey: 'ci.date', titleKey: 'modal.date',
    defaultData: { label: 'Zdarzenie', date: '', color: 'y' },
    skipModalOnAdd: true,
    fields: [
      { key: 'label', kind: 'text',   labelKey: 'field.label' },
      { key: 'date',  kind: 'text',   labelKey: 'field.date', requiredMark: true, required: true, requiredAlertKey: 'alert.enterDate' },
      { key: 'color', kind: 'select', labelKey: 'field.noteColor', optionsBuilder: buildNoteColorOptions, selectFallback: 'y' },
    ],
  },
  video: {
    icon: '🎬', labelKey: 'ci.video', titleKey: 'modal.video',
    defaultData: { url: '', title: '' },
    fields: [
      { key: 'url',   kind: 'text', labelKey: 'field.ytLink', placeholder: 'https://youtu.be/...', required: true, requiredAlertKey: 'alert.enterYTLink' },
      { key: 'title', kind: 'text', labelKey: 'field.title' },
    ],
  },
  news: {
    icon: '📰', labelKey: 'ci.news', titleKey: 'modal.news',
    defaultData: { source: '', title: 'Nagłówek', body: 'Treść', url: '', accentColor: '#e63946' },
    fields: [
      { key: 'source',      kind: 'text',     labelKey: 'field.source' },
      { key: 'title',       kind: 'text',     labelKey: 'field.headline', required: true, requiredAlertKey: 'alert.enterHeadline' },
      { key: 'body',        kind: 'textarea', labelKey: 'field.content' },
      { key: 'url',         kind: 'text',     labelKey: 'field.linkURL' },
      { key: 'accentColor', kind: 'select',   labelKey: 'field.accentColor', optionsBuilder: buildNewsAccentOptions, selectFallback: 'y' },
    ],
  },
  quote: {
    icon: '💬', labelKey: 'ci.quote', titleKey: 'modal.quote',
    defaultData: { text: 'Cytat...', author: '', context: '' },
    fields: [
      { key: 'text',    kind: 'textarea', labelKey: 'field.quoteText', requiredMark: true, required: true, requiredAlertKey: 'alert.enterQuote' },
      { key: 'author',  kind: 'text',     labelKey: 'field.quoteAuthor' },
      { key: 'context', kind: 'text',     labelKey: 'field.quoteContext', placeholder: 'np. 10:59, wywiad studyjny' },
    ],
  },
  source: {
    icon: '🔗', labelKey: 'ci.source', titleKey: 'modal.source',
    defaultData: { url: '', label: '', note: '' },
    fields: [
      { key: 'url',   kind: 'text', labelKey: 'field.sourceURL', placeholder: 'https://...', requiredMark: true, required: true, requiredAlertKey: 'alert.enterSourceURL' },
      { key: 'label', kind: 'text', labelKey: 'field.sourceLabel' },
      { key: 'note',  kind: 'text', labelKey: 'field.sourceNote' },
    ],
  },
  legend: {
    icon: '🔑', labelKey: 'ci.legend', titleKey: 'modal.legend',
    defaultData: { title: 'Legenda', text: 'zielony: potwierdzone\nczerwony: obalone\nżółty: zastrzeżenie' },
    fields: [
      { key: 'title', kind: 'text',     labelKey: 'field.legendTitle', displayFallback: 'Legenda', readFallback: 'Legenda' },
      { key: 'text',  kind: 'textarea', labelKey: 'field.legendText',  placeholder: 'zielony: potwierdzone\nczerwony: obalone' },
    ],
  },
  person: {
    icon: '👤', labelKey: 'ci.person', titleKey: 'modal.person',
    defaultData: { name: 'Nowa osoba', role: '', party: '', partyColor: '#666', emoji: '👤', photo: '' },
    fields: personFields(),
  },
  unknown: {
    icon: '❓', labelKey: 'ci.unknown', titleKey: 'modal.unknown',
    defaultData: { name: 'Nieznana osoba', role: '', emoji: '❓' },
    fields: personFields(),
  },
  party: {
    icon: '🏛️', labelKey: 'ci.party', titleKey: 'modal.party',
    defaultData: { name: 'Nowa partia', logo: '🏛️', color: '#666', desc: '' },
    fields: [
      { key: 'name',  kind: 'text',     labelKey: 'field.partyName', required: true, requiredAlertKey: 'alert.enterPartyName' },
      { key: 'logo',  kind: 'text',     labelKey: 'field.logo',      displayFallback: '🏛️',     readFallback: '🏛️' },
      { key: 'color', kind: 'text',     labelKey: 'field.color',     displayFallback: '#666666', readFallback: '#666' },
      { key: 'desc',  kind: 'textarea', labelKey: 'field.desc' },
    ],
  },
  law: {
    icon: '⚖️', labelKey: 'ci.law', titleKey: 'modal.law',
    defaultData: { title: 'Nowa ustawa', date: '', desc: '' },
    fields: [
      { key: 'title', kind: 'text',     labelKey: 'field.actTitle', required: true, requiredAlertKey: 'alert.enterTitle' },
      { key: 'date',  kind: 'text',     labelKey: 'field.date' },
      { key: 'desc',  kind: 'textarea', labelKey: 'field.desc' },
    ],
  },
};

// Carousel display order (index.html renders bubbles in this order; the
// user's own drag-reordering, stored separately in localStorage, takes
// over from there — see applyCarouselState in index.html).
export const CARD_TYPE_ORDER = [
  'note', 'yesno', 'scale', 'spectrum', 'image', 'date', 'video',
  'news', 'quote', 'source', 'legend', 'person', 'unknown', 'party', 'law',
];
