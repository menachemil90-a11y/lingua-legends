import { describe, expect, it } from 'vitest';
import { en } from './en';
import { he } from './he';

describe('localization', () => {
  it('Hebrew covers every English key with non-empty text', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(he[key], key).toBeTruthy();
    }
  });
  it('keeps placeholders consistent between languages', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
      expect(vars(he[key]), key).toBe(vars(en[key]));
    }
  });
  it('isolates numeric ranges in Hebrew so they are not reversed (e.g. 60–140, not 140–60)', () => {
    for (const [key, value] of Object.entries(he)) {
      for (const m of value.matchAll(/[0-9}]\s*[–-]\s*[0-9{]/g)) {
        const before = value.slice(0, m.index);
        const isolated = before.lastIndexOf('\u2066') > before.lastIndexOf('\u2069') && value.indexOf('\u2069', m.index) > m.index;
        expect(isolated, `${key}: "${value}"`).toBe(true);
      }
    }
  });
});
