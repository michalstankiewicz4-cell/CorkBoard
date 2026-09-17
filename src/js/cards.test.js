import { describe, it, expect } from 'vitest';
import { esc, domainOf, legendLineHTML } from './cards.js';

describe('esc', () => {
  it('escapes HTML special characters', () => {
    expect(esc('<b>&"x"</b>')).toBe('&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;');
  });
  it('falls back for null/undefined', () => {
    expect(esc(null, 'fallback')).toBe('fallback');
    expect(esc(undefined)).toBe('');
  });
});

describe('domainOf', () => {
  it('extracts the hostname without www.', () => {
    expect(domainOf('https://www.forsal.pl/artykul/123')).toBe('forsal.pl');
  });
  it('keeps subdomains other than www', () => {
    expect(domainOf('https://pl.wikipedia.org/wiki/X')).toBe('pl.wikipedia.org');
  });
  it('returns empty string for an invalid URL', () => {
    expect(domainOf('not a url')).toBe('');
    expect(domainOf('')).toBe('');
  });
});

describe('legendLineHTML (legend card color-line parsing)', () => {
  it('renders a colored dot for a recognized color word', () => {
    const html = legendLineHTML('zielony: potwierdzone');
    expect(html).toContain('cl-dot');
    expect(html).toContain('#2ecc71');
    expect(html).toContain('potwierdzone');
  });
  it('recognizes English color names too', () => {
    expect(legendLineHTML('red: obalone')).toContain('#e74c3c');
  });
  it('falls back to a plain row for an unrecognized prefix', () => {
    const html = legendLineHTML('LEGENDA TESTOWA');
    expect(html).toContain('cl-plain');
    expect(html).not.toContain('cl-dot');
  });
  it('returns empty string for a blank line', () => {
    expect(legendLineHTML('   ')).toBe('');
  });
});
