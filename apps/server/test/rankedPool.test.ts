import { describe, expect, it } from 'vitest';
import { BRACKET_LEVELS, BRACKETS, gradeAnswer, prepareRoundQuestion, seededRandom, tokenize } from '@lingua/shared';
import { CONTENT_ITEMS } from '@lingua/content';
import { RANKED_ITEMS } from '../src/content/rankedPool';

describe('server-only ranked pool', () => {
  it('every option item grades its own key as correct and every distractor as wrong', () => {
    for (const item of RANKED_ITEMS.filter((i) => i.grading.mode === 'option')) {
      const rq = prepareRoundQuestion(item, 'r', seededRandom(3));
      for (const opt of rq.question.options!) {
        expect(gradeAnswer(rq, { kind: 'option', optionId: opt.id }).correct, `${item.id}/${opt.text}`).toBe(rq.key.correctOptionIds!.includes(opt.id));
      }
    }
  });

  it('every ranked sentence puzzle accepts each listed answer', () => {
    for (const item of RANKED_ITEMS.filter((i) => i.type === 'sentence-build')) {
      const rq = prepareRoundQuestion(item, 'r', seededRandom(4));
      for (const answer of item.acceptedAnswers) {
        const pool = rq.question.tiles!.slice();
        const ids = tokenize(answer).map((tok) => pool.splice(pool.findIndex((t) => tokenize(t.text)[0] === tok), 1)[0]!.id);
        expect(gradeAnswer(rq, { kind: 'tiles', tileIds: ids }).correct, `${item.id}: ${answer}`).toBe(true);
      }
    }
  });

  it('never repeats a public prompt, so answer keys cannot be looked up in the offline bank', () => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, ' ').trim();
    const publicPrompts = new Set(CONTENT_ITEMS.map((i) => `${norm(i.prompt)}|${norm(i.context ?? '')}`));
    for (const item of RANKED_ITEMS) {
      expect(item.id.startsWith('rk-'), item.id).toBe(true);
      expect(publicPrompts.has(`${norm(item.prompt)}|${norm(item.context ?? '')}`), item.id).toBe(false);
    }
    const publicIds = new Set(CONTENT_ITEMS.map((i) => i.id));
    expect(RANKED_ITEMS.filter((i) => publicIds.has(i.id))).toEqual([]);
  });

  it('has enough option items per bracket for a full ranked match', () => {
    for (const b of BRACKETS) {
      const n = RANKED_ITEMS.filter((i) => i.grading.mode === 'option' && BRACKET_LEVELS[b].includes(i.level)).length;
      expect(n, b).toBeGreaterThanOrEqual(30);
    }
  });
});
