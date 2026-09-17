import { describe, it, expect, vi } from 'vitest';
import { buildFieldsHTML, readFieldsForm, fieldInputId } from './field-form.js';

describe('fieldInputId', () => {
  it('prefixes the field key with mf-', () => {
    expect(fieldInputId('question')).toBe('mf-question');
  });
});

describe('buildFieldsHTML', () => {
  it('renders a text field with its current value', () => {
    const html = buildFieldsHTML(
      [{ key: 'name', kind: 'text', labelKey: 'field.name' }],
      { name: 'Jan Kowalski' },
    );
    expect(html).toContain('id="mf-name"');
    expect(html).toContain('value="Jan Kowalski"');
  });

  it('appends a literal " *" when requiredMark is set', () => {
    const html = buildFieldsHTML(
      [{ key: 'question', kind: 'text', labelKey: 'field.question', requiredMark: true }],
      {},
    );
    expect(html).toMatch(/<label>[^<]* \*<\/label>/);
  });

  it('uses displayFallback when the value is missing', () => {
    const html = buildFieldsHTML(
      [{ key: 'emoji', kind: 'text', labelKey: 'field.emoji', displayFallback: '👤' }],
      {},
    );
    expect(html).toContain('value="👤"');
  });

  it('renders a range field with its current value and output span', () => {
    const html = buildFieldsHTML(
      [{ key: 'value', kind: 'range', labelKey: 'field.scaleValue', min: 0, max: 10, step: 1, rangeDefault: 5 }],
      { value: 7 },
    );
    expect(html).toContain('type="range"');
    expect(html).toContain('value="7"');
    expect(html).toContain('id="mf-value-out">7<');
  });

  it('renders a select field via its optionsBuilder', () => {
    const optionsBuilder = vi.fn(() => '<option value="y">Yellow</option>');
    const html = buildFieldsHTML(
      [{ key: 'color', kind: 'select', labelKey: 'field.noteColor', optionsBuilder }],
      { color: 'y' },
    );
    expect(optionsBuilder).toHaveBeenCalledWith('y');
    expect(html).toContain('<select id="mf-color">');
  });
});

describe('readFieldsForm', () => {
  function fakeGetValue(values) {
    return id => values[id];
  }

  it('reads and trims text fields', () => {
    const fields = [{ key: 'name', kind: 'text', labelKey: 'field.name' }];
    const data = readFieldsForm(fields, fakeGetValue({ 'mf-name': '  Jan  ' }));
    expect(data).toEqual({ name: 'Jan' });
  });

  it('alerts and returns null when a required field is empty', () => {
    const origAlert = globalThis.alert;
    const alerted = [];
    globalThis.alert = msg => alerted.push(msg);
    try {
      const fields = [{ key: 'question', kind: 'text', required: true, requiredAlertKey: 'alert.enterQuestion' }];
      const data = readFieldsForm(fields, fakeGetValue({ 'mf-question': '' }));
      expect(data).toBeNull();
      expect(alerted).toEqual(['Enter a question']); // resolved via i18n.js's 'en' translations
    } finally {
      globalThis.alert = origAlert;
    }
  });

  it('applies readFallback when the field was left empty', () => {
    const fields = [{ key: 'color', kind: 'text', readFallback: '#666' }];
    const data = readFieldsForm(fields, fakeGetValue({ 'mf-color': '' }));
    expect(data).toEqual({ color: '#666' });
  });

  it('falls back to "y" for an empty select value', () => {
    const fields = [{ key: 'color', kind: 'select' }];
    const data = readFieldsForm(fields, fakeGetValue({ 'mf-color': '' }));
    expect(data).toEqual({ color: 'y' });
  });

  it('coerces range fields to numbers, defaulting when blank', () => {
    const fields = [{ key: 'value', kind: 'range', rangeDefault: 5 }];
    expect(readFieldsForm(fields, fakeGetValue({ 'mf-value': '8' }))).toEqual({ value: 8 });
    expect(readFieldsForm(fields, fakeGetValue({ 'mf-value': '' }))).toEqual({ value: 5 });
  });

  it('reads multiple fields in order, stopping at the first missing required one', () => {
    const origAlert = globalThis.alert;
    globalThis.alert = () => {};
    try {
      const fields = [
        { key: 'title', kind: 'text', required: true, requiredAlertKey: 'alert.enterTitle' },
        { key: 'body', kind: 'textarea' },
      ];
      const data = readFieldsForm(fields, fakeGetValue({ 'mf-title': 'Hello', 'mf-body': 'World' }));
      expect(data).toEqual({ title: 'Hello', body: 'World' });
    } finally {
      globalThis.alert = origAlert;
    }
  });
});
