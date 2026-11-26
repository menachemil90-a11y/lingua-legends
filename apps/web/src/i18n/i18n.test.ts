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
});
