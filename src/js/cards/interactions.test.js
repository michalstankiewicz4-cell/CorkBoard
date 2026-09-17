import { describe, it, expect } from 'vitest';
import { ratioFromVerticalDrag, ratioFromHorizontalDrag, valueFromRatio } from './interactions.js';

// These used to be closures inside startScaleDrag/startSpectrumDrag in
// app.js — impossible to reach without simulating real mouse events on a
// live card. Pulled out as pure functions, they're just arithmetic.

describe('ratioFromVerticalDrag (Scale card: bottom = 0, top = 1)', () => {
  const rect = { top: 100, height: 100 };
  it('is 1 at the very top of the track', () => {
    expect(ratioFromVerticalDrag(100, rect)).toBe(1);
  });
  it('is 0 at the very bottom of the track', () => {
    expect(ratioFromVerticalDrag(200, rect)).toBe(0);
  });
  it('is 0.5 at the middle', () => {
    expect(ratioFromVerticalDrag(150, rect)).toBe(0.5);
  });
  it('clamps above the track to 1 and below to 0', () => {
    expect(ratioFromVerticalDrag(0, rect)).toBe(1);
    expect(ratioFromVerticalDrag(500, rect)).toBe(0);
  });
});

describe('ratioFromHorizontalDrag (Spectrum card: left = 0, right = 1)', () => {
  const rect = { left: 50, width: 200 };
  it('is 0 at the left edge', () => {
    expect(ratioFromHorizontalDrag(50, rect)).toBe(0);
  });
  it('is 1 at the right edge', () => {
    expect(ratioFromHorizontalDrag(250, rect)).toBe(1);
  });
  it('is 0.5 at the middle', () => {
    expect(ratioFromHorizontalDrag(150, rect)).toBe(0.5);
  });
  it('clamps outside the track', () => {
    expect(ratioFromHorizontalDrag(-100, rect)).toBe(0);
    expect(ratioFromHorizontalDrag(1000, rect)).toBe(1);
  });
});

describe('valueFromRatio', () => {
  it('scales a 0-1 ratio to a rounded 0-10 value by default', () => {
    expect(valueFromRatio(0)).toBe(0);
    expect(valueFromRatio(1)).toBe(10);
    expect(valueFromRatio(0.74)).toBe(7);
    expect(valueFromRatio(0.76)).toBe(8);
  });
  it('supports a custom step count', () => {
    expect(valueFromRatio(0.5, 4)).toBe(2);
  });
});
