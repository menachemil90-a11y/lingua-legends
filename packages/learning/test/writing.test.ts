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

import { debateChecklist } from '../src';

describe('debate checklist', () => {
  it('marks each structural habit independently and never grades the position', () => {
    const opening = checkWriting('In my opinion, cities should close their centres to cars because the air is polluted. For example, asthma rates are high. Moreover, streets become safer.', { minWords: 20, maxWords: 80 });
    const rebuttal = checkWriting('Some people argue that shops will lose customers. However, studies show that pedestrians often spend more. Therefore the risk is small.', { minWords: 15, maxWords: 80, expectConcession: true });
    const closing = checkWriting('To sum up, a car-free centre is cleaner and safer, so the benefits clearly outweigh the costs.', { minWords: 10, maxWords: 60, expectSummary: true });
    const list = debateChecklist({ opening, rebuttal, closing });
    expect(list.map((i) => [i.id, i.met])).toEqual([
      ['stance', true],
      ['reasons', true],
      ['example', true],
      ['counter', true],
      ['connectors', true],
      ['length', true],
      ['summary', true],
      ['accuracy', true],
    ]);
    const weak = debateChecklist({ opening: checkWriting('cars bad', { minWords: 20, maxWords: 80 }), rebuttal: checkWriting('no', { minWords: 15, maxWords: 80, expectConcession: true }), closing: checkWriting('ok', { minWords: 10, maxWords: 60, expectSummary: true }) });
    expect(weak.filter((i) => i.met).map((i) => i.id)).toEqual([]);
  });
});
