import { describe, it, expect } from 'vitest';
import { CARD_TYPES, CARD_TYPE_ORDER } from './registry.js';
import { readFieldsForm } from './field-form.js';

describe('CARD_TYPE_ORDER', () => {
  it('lists every type exactly once, and every listed type exists in CARD_TYPES', () => {
    expect(new Set(CARD_TYPE_ORDER).size).toBe(CARD_TYPE_ORDER.length);
    CARD_TYPE_ORDER.forEach(type => expect(CARD_TYPES).toHaveProperty(type));
  });

  it('has no registry entries missing from the carousel order', () => {
    expect(new Set(CARD_TYPE_ORDER)).toEqual(new Set(Object.keys(CARD_TYPES)));
  });
});

describe('CARD_TYPES entries', () => {
  for (const [type, def] of Object.entries(CARD_TYPES)) {
    describe(type, () => {
      it('has an icon, labelKey, titleKey and defaultData', () => {
        expect(def.icon).toBeTruthy();
        expect(def.labelKey).toBeTruthy();
        expect(def.titleKey).toBeTruthy();
        expect(def.defaultData).toBeTypeOf('object');
      });

      it('has either a fields schema or a custom renderFields', () => {
        expect(Array.isArray(def.fields) || typeof def.renderFields === 'function').toBe(true);
      });

      if (def.fields) {
        // Every required field must name an alert key (readFieldsForm calls
        // t(field.requiredAlertKey) — an undefined key would render as the
        // literal string "undefined" in the alert shown to the user).
        it('gives every required field a requiredAlertKey', () => {
          def.fields.filter(f => f.required).forEach(f => {
            expect(f.requiredAlertKey, `field "${f.key}"`).toBeTruthy();
          });
        });

        // With every required field filled in (not necessarily defaultData,
        // which for most types is deliberately incomplete — the add-modal
        // opens right after creation specifically to collect it), the form
        // must read cleanly with no alert.
        it('passes validation once every required field has a value', () => {
          const origAlert = globalThis.alert;
          let alerted = false;
          globalThis.alert = () => { alerted = true; };
          try {
            const getValue = id => {
              const key = id.replace(/^mf-/, '');
              const field = def.fields.find(f => f.key === key);
              if (field?.kind === 'range') return String(field.rangeDefault ?? 5);
              const v = def.defaultData[key];
              return v ? String(v) : 'placeholder';
            };
            const data = readFieldsForm(def.fields, getValue);
            expect(alerted).toBe(false);
            expect(data).not.toBeNull();
          } finally {
            globalThis.alert = origAlert;
          }
        });
      }
    });
  }
});
