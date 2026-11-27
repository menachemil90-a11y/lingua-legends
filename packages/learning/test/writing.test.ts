import { describe, expect, it } from 'vitest';
import { checkWriting } from '../src/writingCheck';

describe('writing checks (heuristic, not a grade)', () => {
  it('recognises stance, reasons, examples and concession', () => {
    const text = 'In my opinion, school uniforms should be optional because students express themselves through clothes. For example, many students choose colours that show their personality. Some people argue that uniforms reduce bullying. However, bullying often continues for other reasons.';
    const r = checkWriting(text, { minWords: 30, maxWords: 120, expectConcession: true });
    const ids = Object.fromEntries(r.findings.map((f) => [f.id, f.kind]));
    expect(ids).toMatchObject({ stance: 'good', reason: 'good', example: 'good', counter: 'good', 'length-ok': 'good' });
    expect(r.findings.some((f) => f.kind === 'error')).toBe(false);
  });

  it('flags common learner errors', () => {
    const r = checkWriting('i think phones is more better. He don\'t need informations', { minWords: 5, maxWords: 50 });
    const errors = r.findings.filter((f) => f.kind === 'error').map((f) => f.id);
    expect(errors).toEqual(expect.arrayContaining(['more-better', 'uncountable-plural', 'he-dont', 'lowercase-i', 'capitals', 'final-punct']));
  });
});
