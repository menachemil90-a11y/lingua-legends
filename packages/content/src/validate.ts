/**
 * Structured content validation. Run with `pnpm content:validate` (also part of the test suite).
 * Checks schema, references, duplicates, sentence tiles, translations and minimum targets.
 */
import {
  CEFR_LEVELS,
  contentItemSchema,
  readingPassageSchema,
  tokenize,
  type CefrLevel,
  type ContentItem,
  type ContentItemInput,
  type ReadingPassageInput,
} from '@lingua/shared';
import { MOCK_EXAMS, OPEN_TASKS, BAGRUT_CURRICULUM } from './bagrut';
import { ADVENTURE_REGIONS, WORD_BATTLE_SETS } from './sets';
import { DETECTIVE_CASES, REAL_LIFE_SCENARIOS } from './story';
import { ESCAPE_ROOM_FOR_BRACKET, ESCAPE_ROOMS } from './escape';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  ref: string;
  message: string;
}

/** Prototype minimums from the product brief (not sufficient for release). */
export const CONTENT_TARGETS = {
  general: { A1: 20, A2: 20, B1: 20, B2: 20, C1: 15, C2: 10 } as Record<CefrLevel, number>,
  sentenceBuilding: 10,
  grammarRace: 10,
  wordBattleSets: 10,
};

const HEBREW = /[֐-׿]/;

export function validateContent(
  raw: ContentItemInput[],
  rawPassages: ReadingPassageInput[],
  opts: { references?: boolean; targets?: boolean } = {},
): {
  issues: ValidationIssue[];
  stats: Record<string, number>;
} {
  const issues: ValidationIssue[] = [];
  const items: ContentItem[] = [];
  for (const r of raw) {
    const res = contentItemSchema.safeParse(r);
    if (!res.success) {
      for (const iss of res.error.issues) issues.push({ severity: 'error', ref: String(r.id), message: iss.message });
    } else items.push(res.data);
  }
  const passages = rawPassages.flatMap((p) => {
    const res = readingPassageSchema.safeParse(p);
    if (!res.success) {
      issues.push({ severity: 'error', ref: String(p.id), message: res.error.issues.map((i) => i.message).join('; ') });
      return [];
    }
    return [res.data];
  });

  const ids = new Set<string>();
  for (const i of items) {
    if (ids.has(i.id)) issues.push({ severity: 'error', ref: i.id, message: 'duplicate id' });
    ids.add(i.id);
  }
  const passageIds = new Set(passages.map((p) => p.id));
  if (passageIds.size !== passages.length) issues.push({ severity: 'error', ref: 'passages', message: 'duplicate passage id' });

  // Duplicate questions: same prompt + context + correct answer.
  const seen = new Map<string, string>();
  for (const i of items) {
    const answer = i.grading.mode === 'option' ? i.options?.find((o) => o.id === i.acceptedAnswers[0])?.text : i.acceptedAnswers[0];
    const key = `${i.prompt}|${i.context ?? ''}|${answer}`.toLowerCase();
    const prev = seen.get(key);
    if (prev) issues.push({ severity: 'error', ref: i.id, message: `duplicate of ${prev}` });
    seen.set(key, i.id);
  }

  for (const i of items) {
    if (!HEBREW.test(i.explanation.he)) issues.push({ severity: 'error', ref: i.id, message: 'Hebrew explanation contains no Hebrew text' });
    if (i.explanation.en.length < 10) issues.push({ severity: 'warning', ref: i.id, message: 'English explanation is very short' });
    if (i.category === 'listening' && !i.listen) issues.push({ severity: 'error', ref: i.id, message: 'listening item without a script' });
    if (i.type === 'cloze' && i.prompt.split('___').length !== 2) issues.push({ severity: 'error', ref: i.id, message: 'cloze must contain exactly one gap' });
    if (i.passageId && !passageIds.has(i.passageId)) issues.push({ severity: 'error', ref: i.id, message: `unknown passage ${i.passageId}` });
    for (const o of i.options ?? []) {
      if (o.feedback && !HEBREW.test(o.feedback.he)) issues.push({ severity: 'error', ref: `${i.id}/${o.id}`, message: 'option feedback lacks Hebrew' });
      if (o.feedback && i.acceptedAnswers.includes(o.id)) issues.push({ severity: 'warning', ref: `${i.id}/${o.id}`, message: 'correct option has wrong-answer feedback' });
    }
    if (i.grading.mode === 'option' && i.acceptedAnswers.length !== 1) {
      issues.push({ severity: 'warning', ref: i.id, message: 'multiple correct options (ensure UI supports it)' });
    }
    if (i.type === 'sentence-build') {
      const tiles = i.tiles ?? [];
      for (const t of tiles) {
        if (tokenize(t).length !== 1) issues.push({ severity: 'error', ref: i.id, message: `tile "${t}" is not a single token` });
      }
      const tileBag = tiles.map((t) => tokenize(t)[0]).sort().join('|');
      for (const a of i.acceptedAnswers) {
        if (tokenize(a).sort().join('|') !== tileBag) issues.push({ severity: 'error', ref: i.id, message: `accepted answer "${a}" does not use exactly the tiles` });
      }
      for (const m of i.commonMistakes ?? []) {
        if (tokenize(m.sequence).sort().join('|') !== tileBag) issues.push({ severity: 'error', ref: i.id, message: `common mistake "${m.sequence}" does not use the tiles` });
        if (i.acceptedAnswers.some((a) => tokenize(a).join(' ') === tokenize(m.sequence).join(' '))) issues.push({ severity: 'error', ref: i.id, message: 'common mistake equals an accepted answer' });
      }
    }
  }

  const stats: Record<string, number> = { total: items.length, passages: passages.length };
  if (opts.references !== false) checkReferences(issues, ids, passageIds);
  if (opts.targets === false) return { issues, stats };

  // Minimum targets.
  const general = items.filter((i) => !i.id.startsWith('race-') && i.type !== 'sentence-build' && !i.passageId && !i.listen);
  for (const lvl of CEFR_LEVELS) {
    const n = general.filter((i) => i.level === lvl).length;
    stats[`general:${lvl}`] = n;
    if (n < CONTENT_TARGETS.general[lvl]) issues.push({ severity: 'error', ref: `level:${lvl}`, message: `only ${n} general items (target ${CONTENT_TARGETS.general[lvl]})` });
  }
  stats.sentenceBuilding = items.filter((i) => i.type === 'sentence-build').length;
  stats.grammarRace = items.filter((i) => i.id.startsWith('race-')).length;
  stats.wordBattleSets = WORD_BATTLE_SETS.length;
  stats.openTasks = OPEN_TASKS.length;
  stats.readingItems = items.filter((i) => !!i.passageId).length;
  stats.listeningItems = items.filter((i) => !!i.listen).length;
  if (stats.sentenceBuilding < CONTENT_TARGETS.sentenceBuilding) issues.push({ severity: 'error', ref: 'sentence', message: 'not enough sentence-building items' });
  if (stats.grammarRace < CONTENT_TARGETS.grammarRace) issues.push({ severity: 'error', ref: 'race', message: 'not enough race items' });
  if (stats.wordBattleSets < CONTENT_TARGETS.wordBattleSets) issues.push({ severity: 'error', ref: 'sets', message: 'not enough Word Battle sets' });
  return { issues, stats };
}

function checkReferences(issues: ValidationIssue[], ids: Set<string>, passageIds: Set<string>): void {
  // References from sets, adventure, Bagrut and story content.
  for (const s of WORD_BATTLE_SETS) {
    for (const id of s.itemIds) if (!ids.has(id)) issues.push({ severity: 'error', ref: s.id, message: `unknown item ${id}` });
    if (s.itemIds.length < 8) issues.push({ severity: 'warning', ref: s.id, message: 'set has fewer than 8 items' });
  }
  const setIds = new Set(WORD_BATTLE_SETS.map((s) => s.id));
  for (const r of ADVENTURE_REGIONS)
    for (const c of r.chapters) {
      if (c.setId && !setIds.has(c.setId)) issues.push({ severity: 'error', ref: c.id, message: `unknown set ${c.setId}` });
      if (c.passageId && !passageIds.has(c.passageId)) issues.push({ severity: 'error', ref: c.id, message: `unknown passage ${c.passageId}` });
    }
  const taskIds = new Set(OPEN_TASKS.map((t) => t.id));
  for (const t of OPEN_TASKS) if (t.passageId && !passageIds.has(t.passageId)) issues.push({ severity: 'error', ref: t.id, message: `unknown passage ${t.passageId}` });
  for (const comp of BAGRUT_CURRICULUM.components) {
    for (const tid of comp.taskIds) if (!taskIds.has(tid)) issues.push({ severity: 'error', ref: comp.id, message: `unknown task ${tid}` });
    for (const pid of comp.passageIds) if (!passageIds.has(pid)) issues.push({ severity: 'error', ref: comp.id, message: `unknown passage ${pid}` });
  }
  for (const m of MOCK_EXAMS) {
    for (const id of m.itemIds) if (!ids.has(id)) issues.push({ severity: 'error', ref: m.id, message: `unknown item ${id}` });
    for (const id of m.taskIds) if (!taskIds.has(id)) issues.push({ severity: 'error', ref: m.id, message: `unknown task ${id}` });
    for (const id of m.passageIds) if (!passageIds.has(id)) issues.push({ severity: 'error', ref: m.id, message: `unknown passage ${id}` });
  }
  const scenarioIds = new Set<string>();
  for (const s of REAL_LIFE_SCENARIOS) {
    if (scenarioIds.has(s.id)) issues.push({ severity: 'error', ref: s.id, message: 'duplicate scenario id' });
    scenarioIds.add(s.id);
    if (!HEBREW.test(s.titleHe)) issues.push({ severity: 'error', ref: s.id, message: 'missing Hebrew title' });
    const nodeIds = new Set(s.nodes.map((n) => n.id));
    if (nodeIds.size !== s.nodes.length) issues.push({ severity: 'error', ref: s.id, message: 'duplicate node ids' });
    if (!nodeIds.has(s.start)) issues.push({ severity: 'error', ref: s.id, message: 'missing start node' });
    for (const n of s.nodes) {
      if (!n.end && (!n.choices || n.choices.length < 2)) issues.push({ severity: 'error', ref: `${s.id}/${n.id}`, message: 'a non-final node needs at least 2 choices' });
      if (n.end && !HEBREW.test(n.end.he)) issues.push({ severity: 'error', ref: `${s.id}/${n.id}`, message: 'end summary lacks Hebrew' });
      if (n.choices && !n.choices.some((c) => c.quality === 'best')) issues.push({ severity: 'error', ref: `${s.id}/${n.id}`, message: 'every node needs at least one best choice' });
      for (const c of n.choices ?? []) {
        if (!nodeIds.has(c.next)) issues.push({ severity: 'error', ref: `${s.id}/${n.id}`, message: `unknown next ${c.next}` });
        if (!HEBREW.test(c.feedback.he)) issues.push({ severity: 'error', ref: `${s.id}/${n.id}`, message: 'choice feedback lacks Hebrew' });
      }
    }
    // Every path must reach an end node (no dead ends, no cycles without an exit).
    const canEnd = new Map<string, boolean>();
    const reaches = (id: string, seen: Set<string>): boolean => {
      if (canEnd.has(id)) return canEnd.get(id)!;
      const n = s.nodes.find((x) => x.id === id);
      if (!n || seen.has(id)) return false;
      seen.add(id);
      const ok = !!n.end || (n.choices ?? []).every((c) => reaches(c.next, seen));
      canEnd.set(id, ok);
      return ok;
    };
    if (nodeIds.has(s.start) && !reaches(s.start, new Set())) issues.push({ severity: 'error', ref: s.id, message: 'some path never reaches an end node' });
  }
  for (const [bracket, roomId] of Object.entries(ESCAPE_ROOM_FOR_BRACKET)) {
    if (!ESCAPE_ROOMS.some((r) => r.id === roomId)) issues.push({ severity: 'error', ref: `escape:${bracket}`, message: `co-op room ${roomId} does not exist` });
  }
  const puzzleIds = new Set<string>();
  for (const room of ESCAPE_ROOMS) {
    if (room.puzzles.length < 3) issues.push({ severity: 'error', ref: room.id, message: 'escape rooms need at least 3 puzzles' });
    if (!HEBREW.test(room.introHe) || !HEBREW.test(room.outroHe)) issues.push({ severity: 'error', ref: room.id, message: 'missing Hebrew intro/outro' });
    for (const p of room.puzzles) {
      if (puzzleIds.has(p.id)) issues.push({ severity: 'error', ref: p.id, message: 'duplicate puzzle id' });
      puzzleIds.add(p.id);
      if (!HEBREW.test(p.explanation.he) || !HEBREW.test(p.hint.he)) issues.push({ severity: 'error', ref: p.id, message: 'puzzle lacks Hebrew explanation/hint' });
      if (p.kind === 'choice' && (p.answer < 0 || p.answer >= p.options.length || new Set(p.options).size !== p.options.length)) issues.push({ severity: 'error', ref: p.id, message: 'invalid choice options/answer' });
      if (p.kind === 'text' && p.accepted.length === 0) issues.push({ severity: 'error', ref: p.id, message: 'text puzzle needs accepted answers' });
      if (p.kind === 'order' && (p.steps.length < 3 || new Set(p.steps).size !== p.steps.length)) issues.push({ severity: 'error', ref: p.id, message: 'order puzzle needs >= 3 unique steps' });
    }
  }
  for (const c of DETECTIVE_CASES) {
    const evIds = new Set(c.evidence.map((e) => e.id));
    if (!c.suspects.some((s) => s.id === c.culpritId)) issues.push({ severity: 'error', ref: c.id, message: 'culprit is not a suspect' });
    if (!HEBREW.test(c.briefingHe) || !HEBREW.test(c.solution.he) || !HEBREW.test(c.titleHe)) issues.push({ severity: 'error', ref: c.id, message: 'case lacks Hebrew title/briefing/solution' });
    if (c.questions.length < 3) issues.push({ severity: 'error', ref: c.id, message: 'a case needs at least 3 questions' });
    for (const qn of c.questions) {
      if (!HEBREW.test(qn.explanation.he)) issues.push({ severity: 'error', ref: `${c.id}/${qn.id}`, message: 'explanation lacks Hebrew' });
      if (new Set(qn.options).size !== qn.options.length) issues.push({ severity: 'error', ref: `${c.id}/${qn.id}`, message: 'duplicate options' });
    }
    for (const qn of c.questions) {
      if (qn.answer < 0 || qn.answer >= qn.options.length) issues.push({ severity: 'error', ref: `${c.id}/${qn.id}`, message: 'answer index out of range' });
      for (const e of qn.evidenceIds) if (!evIds.has(e)) issues.push({ severity: 'error', ref: `${c.id}/${qn.id}`, message: `unknown evidence ${e}` });
    }
  }

}
