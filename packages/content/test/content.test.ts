import { describe, expect, it } from 'vitest';
import { prepareRoundQuestion, gradeAnswer, seededRandom, tokenize } from '@lingua/shared';
import { CONTENT_ITEMS, RAW_ITEMS, RAW_PASSAGES, sentencePool, validateContent, wordBattlePool, grammarRacePool } from '../src/index';

describe('content bank', () => {
  it('passes structured validation with no errors', () => {
    const { issues } = validateContent(RAW_ITEMS, RAW_PASSAGES);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('every option item grades its own correct answer as correct and distractors as wrong', () => {
    for (const item of CONTENT_ITEMS.filter((i) => i.grading.mode === 'option')) {
      const rq = prepareRoundQuestion(item, 'r', seededRandom(1));
      for (const opt of rq.question.options!) {
        const res = gradeAnswer(rq, { kind: 'option', optionId: opt.id });
        expect(res.correct, `${item.id}/${opt.text}`).toBe(rq.key.correctOptionIds!.includes(opt.id));
      }
    }
  });

  it('every sentence puzzle accepts each listed answer', () => {
    for (const item of sentencePool()) {
      const rq = prepareRoundQuestion(item, 'r', seededRandom(2));
      for (const answer of item.acceptedAnswers) {
        const pool = rq.question.tiles!.slice();
        const ids = tokenize(answer).map((tok) => pool.splice(pool.findIndex((t) => tokenize(t.text)[0] === tok), 1)[0]!.id);
        expect(gradeAnswer(rq, { kind: 'tiles', tileIds: ids }).correct, `${item.id}: ${answer}`).toBe(true);
      }
    }
  });

  it('has enough items for every bracket in each game', () => {
    for (const levels of [['A1', 'A2'], ['B1', 'B2'], ['C1', 'C2']] as const) {
      expect(wordBattlePool(levels).length).toBeGreaterThanOrEqual(20);
      expect(grammarRacePool(levels).length).toBeGreaterThanOrEqual(12);
      expect(sentencePool(levels).length).toBeGreaterThanOrEqual(5);
    }
  });
});
