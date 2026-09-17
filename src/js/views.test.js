import { describe, it, expect } from 'vitest';
import { parsePolishDate } from './views.js';

describe('parsePolishDate', () => {
  it('parses "day month year" in Polish', () => {
    const d = parsePolishDate('27 grudnia 2002');
    expect(d.getFullYear()).toBe(2002);
    expect(d.getMonth()).toBe(11); // December = index 11
    expect(d.getDate()).toBe(27);
  });

  it('falls back to native Date parsing for ISO strings', () => {
    const d = parsePolishDate('2002-12-27');
    expect(d.getFullYear()).toBe(2002);
  });

  it('returns null for unparseable input', () => {
    expect(parsePolishDate('nie wiadomo kiedy')).toBeNull();
  });
});
