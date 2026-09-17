// cards/field-form.js – generic add/edit-modal field rendering and reading,
// driven by a card type's `fields` schema (see cards/registry.js).
//
// Both functions are plain data-in/data-out: buildFieldsHTML never touches
// the DOM, and readFieldsForm only touches it through the injectable
// `getValue` hook (defaulted to a real document.getElementById lookup) —
// so both can be unit-tested without a live document.

import { esc } from '../cards.js';
import { t } from '../i18n.js';

export function fieldInputId(key) { return 'mf-' + key; }

function fieldLabelHTML(field) {
  const label = t(field.labelKey);
  return field.requiredMark ? `${label} *` : label;
}

export function buildFieldsHTML(fields, data) {
  return fields.map(field => buildOneFieldHTML(field, data)).join('');
}

function buildOneFieldHTML(field, data) {
  const id  = fieldInputId(field.key);
  const val = data ? data[field.key] : undefined;
  const placeholderAttr = field.placeholder ? ` placeholder="${field.placeholder}"` : '';

  if (field.kind === 'range') {
    const cur   = Math.max(field.min, Math.min(field.max, Math.round(val ?? field.rangeDefault)));
    const outId = id + '-out';
    return `<div class="modal-field"><label>${fieldLabelHTML(field)}: <span id="${outId}">${cur}</span>/${field.max}</label>
      <input type="range" id="${id}" min="${field.min}" max="${field.max}" step="${field.step}" value="${cur}"
        oninput="document.getElementById('${outId}').textContent=this.value"/></div>`;
  }
  if (field.kind === 'textarea') {
    return `<div class="modal-field"><label>${fieldLabelHTML(field)}</label><textarea id="${id}"${placeholderAttr}>${esc(val)}</textarea></div>`;
  }
  if (field.kind === 'select') {
    return `<div class="modal-field"><label>${fieldLabelHTML(field)}</label><select id="${id}">${field.optionsBuilder(val)}</select></div>`;
  }
  // 'text' (default)
  return `<div class="modal-field"><label>${fieldLabelHTML(field)}</label><input id="${id}" value="${esc(val, field.displayFallback)}"${placeholderAttr}/></div>`;
}

function defaultGetValue(id) {
  return document.getElementById(id)?.value ?? '';
}

// Returns the read form data, or null (after showing an alert) if a
// required field was left empty.
export function readFieldsForm(fields, getValue = defaultGetValue) {
  const data = {};
  for (const field of fields) {
    let value = getValue(fieldInputId(field.key));
    if (field.kind === 'select') {
      value = value || field.selectFallback || 'y';
    } else if (field.kind === 'range') {
      value = value !== null && value !== undefined && value !== '' ? +value : field.rangeDefault;
    } else {
      value = (value ?? '').toString().trim();
      if (field.required && !value) {
        alert(t(field.requiredAlertKey));
        return null;
      }
      if (!value && field.readFallback !== undefined) value = field.readFallback;
    }
    data[field.key] = value;
  }
  return data;
}
