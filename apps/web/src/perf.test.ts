import { describe, expect, it } from 'vitest';
import { isLiteDevice } from './perf';

describe('lite visual mode', () => {
  it('turns on for Save-Data, little memory or very few cores', () => {
    expect(isLiteDevice({ connection: { saveData: true }, hardwareConcurrency: 8, deviceMemory: 8 })).toBe(true);
    expect(isLiteDevice({ deviceMemory: 2, hardwareConcurrency: 8 })).toBe(true);
    expect(isLiteDevice({ hardwareConcurrency: 2 })).toBe(true);
  });
  it('stays off for ordinary phones and when the browser gives no hints', () => {
    expect(isLiteDevice({ deviceMemory: 4, hardwareConcurrency: 8 })).toBe(false);
    expect(isLiteDevice({ hardwareConcurrency: 4 })).toBe(false);
    expect(isLiteDevice({})).toBe(false);
  });
});
