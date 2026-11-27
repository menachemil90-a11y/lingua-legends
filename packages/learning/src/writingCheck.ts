/**
 * Deterministic writing checks for argumentative practice.
 *
 * These are transparent heuristics (connectors, structure markers, common learner
 * errors, sentence length). They are NOT an evaluation of quality and must never be
 * presented as a grade or used for proficiency estimates.
 */

export interface WritingFinding {
  id: string;
  kind: 'good' | 'tip' | 'error';
  en: string;
  he: string;
  matches?: string[];
}

export interface WritingReport {
  words: number;
  sentences: number;
  paragraphs: number;
  avgSentenceLength: number;
  connectorsUsed: string[];
  findings: WritingFinding[];
}

const CONNECTORS = ['however', 'therefore', 'moreover', 'furthermore', 'in addition', 'although', 'even though', 'while', 'whereas', 'on the other hand', 'as a result', 'consequently', 'because', 'since', 'for example', 'for instance', 'such as', 'in conclusion', 'to sum up', 'firstly', 'secondly', 'finally', 'nevertheless', 'despite', 'in contrast'];
const STANCE = ['i believe', 'in my opinion', 'i strongly', 'i think', 'from my point of view', 'i am convinced', 'i would argue'];
const REASON = ['because', 'since', 'as a result', 'therefore', 'due to', 'this means', 'which leads to'];
const EXAMPLE = ['for example', 'for instance', 'such as', 'to illustrate', 'a good example'];
const CONCEDE = ['although', 'while it is true', 'some people argue', 'some may say', 'admittedly', 'it is true that', 'opponents claim', 'critics argue', 'on the other hand'];
const REBUT = ['however', 'nevertheless', 'yet', 'but this ignores', 'this overlooks', 'even so', 'in reality'];
const HEDGE = ['may', 'might', 'could', 'likely', 'tend to', 'often', 'in many cases'];

const ERRORS: { id: string; re: RegExp; en: string; he: string }[] = [
  { id: 'more-better', re: /\bmore (better|worse|easier|bigger|faster)\b/gi, en: "Don't use 'more' with a comparative that already ends in -er: 'better', not 'more better'.", he: "לא משתמשים ב-more עם צורת השוואה שכבר מסתיימת ב-er: better ולא more better." },
  { id: 'uncountable-plural', re: /\b(informations|advices|furnitures|homeworks|knowledges|evidences|equipments)\b/gi, en: "These nouns are uncountable in English and have no plural -s (information, advice, homework, evidence).", he: 'שמות העצם האלה אינם ניתנים לספירה באנגלית ואין להם s של רבים (information, advice, homework).' },
  { id: 'peoples', re: /\bpeoples\b/gi, en: "'People' is already plural ('peoples' means nations).", he: "people כבר ברבים (peoples פירושו עמים)." },
  { id: 'he-dont', re: /\b(he|she|it) (don't|do not|have)\b/gi, en: "With he/she/it use 'doesn't' / 'has'.", he: "עם he/she/it משתמשים ב-doesn't וב-has." },
  { id: 'lowercase-i', re: /(^|[\s.!?])i(?=\s|')/g, en: "The pronoun 'I' is always a capital letter.", he: 'הכינוי I נכתב תמיד באות גדולה.' },
  { id: 'can-to', re: /\b(can|should|must|might|could|will) to\b/gi, en: "Modal verbs are followed by the base form without 'to' (should go, not should to go).", he: 'אחרי פעלים מודליים בא פועל בסיס בלי to (should go).' },
  { id: 'depend-of', re: /\bdepends? of\b/gi, en: "We say 'depend on', not 'depend of'.", he: 'אומרים depend on ולא depend of.' },
  { id: 'discuss-about', re: /\bdiscuss(es|ed)? about\b/gi, en: "'Discuss' takes a direct object: 'discuss the problem' (no 'about').", he: 'אחרי discuss בא מושא ישיר בלי about.' },
];

function countMarkers(text: string, list: string[]): string[] {
  const lower = ` ${text.toLowerCase().replace(/[^\p{L}\s']/gu, ' ').replace(/\s+/g, ' ')} `;
  return list.filter((m) => lower.includes(` ${m} `));
}

export function checkWriting(text: string, target: { minWords: number; maxWords: number; expectConcession?: boolean }): WritingReport {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const sentenceList = trimmed.split(/(?<=[.!?])\s+/).filter((s) => /\w/.test(s));
  const sentences = sentenceList.length;
  const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter((p) => p.trim()).length : 0;
  const avgSentenceLength = sentences ? Math.round(words / sentences) : 0;
  const connectorsUsed = countMarkers(trimmed, CONNECTORS);
  const findings: WritingFinding[] = [];

  if (words < target.minWords) findings.push({ id: 'length-short', kind: 'tip', en: `Aim for at least ${target.minWords} words (you have ${words}).`, he: `כדאי לכתוב לפחות ${target.minWords} מילים (כתבתם ${words}).` });
  else if (words > target.maxWords) findings.push({ id: 'length-long', kind: 'tip', en: `Try to stay under ${target.maxWords} words — be concise.`, he: `נסו לא לעבור ${target.maxWords} מילים — היו תמציתיים.` });
  else findings.push({ id: 'length-ok', kind: 'good', en: 'Good length for this task.', he: 'אורך מתאים למשימה.' });

  const stance = countMarkers(trimmed, STANCE);
  findings.push(
    stance.length
      ? { id: 'stance', kind: 'good', en: 'Your position is clearly signposted.', he: 'העמדה שלכם מסומנת בבירור.', matches: stance }
      : { id: 'stance', kind: 'tip', en: "State your position clearly, e.g. 'I believe that…' or 'In my opinion…'.", he: 'הציגו את עמדתכם בבירור, למשל: I believe that… או In my opinion…' },
  );
  const reasons = countMarkers(trimmed, REASON);
  findings.push(
    reasons.length
      ? { id: 'reason', kind: 'good', en: 'You give reasons for your claims.', he: 'אתם מנמקים את הטענות שלכם.', matches: reasons }
      : { id: 'reason', kind: 'tip', en: "Support your claim with a reason ('because…', 'as a result…').", he: 'תמכו בטענה בנימוק (because…, as a result…).' },
  );
  const examples = countMarkers(trimmed, EXAMPLE);
  findings.push(
    examples.length
      ? { id: 'example', kind: 'good', en: 'You support your argument with an example.', he: 'אתם מביאים דוגמה לתמיכה בטיעון.', matches: examples }
      : { id: 'example', kind: 'tip', en: "Add a concrete example ('For example, …').", he: 'הוסיפו דוגמה קונקרטית (For example, …).' },
  );
  if (target.expectConcession) {
    const concede = countMarkers(trimmed, CONCEDE);
    const rebut = countMarkers(trimmed, REBUT);
    findings.push(
      concede.length && rebut.length
        ? { id: 'counter', kind: 'good', en: 'You acknowledge the other side and respond to it.', he: 'אתם מתייחסים לצד השני ומשיבים לו.', matches: [...concede, ...rebut] }
        : { id: 'counter', kind: 'tip', en: "Acknowledge the opposing view ('Some people argue that…') and then answer it ('However, …').", he: 'התייחסו לעמדה המנוגדת (Some people argue that…) ואז השיבו לה (However, …).' },
    );
  }
  const hedges = countMarkers(trimmed, HEDGE);
  if (hedges.length) findings.push({ id: 'hedge', kind: 'good', en: 'You use cautious language where appropriate.', he: 'אתם משתמשים בלשון זהירה במקומות המתאימים.', matches: hedges });
  if (connectorsUsed.length < 2 && words > 40) findings.push({ id: 'connectors', kind: 'tip', en: 'Link your ideas with more connectors (however, therefore, moreover…).', he: 'קשרו בין הרעיונות בעזרת מילות קישור נוספות (however, therefore, moreover…).' });
  if (avgSentenceLength > 32) findings.push({ id: 'long-sentences', kind: 'tip', en: 'Some sentences are very long. Split them to improve clarity.', he: 'חלק מהמשפטים ארוכים מאוד. פצלו אותם כדי לשפר בהירות.' });

  for (const e of ERRORS) {
    const m = trimmed.match(e.re);
    if (m) findings.push({ id: e.id, kind: 'error', en: e.en, he: e.he, matches: [...new Set(m.map((x) => x.trim()))].slice(0, 4) });
  }
  const startsLower = sentenceList.filter((s) => /^[a-z]/.test(s.trim())).length;
  if (startsLower) findings.push({ id: 'capitals', kind: 'error', en: 'Start every sentence with a capital letter.', he: 'התחילו כל משפט באות גדולה.' });
  if (trimmed && !/[.!?]$/.test(trimmed)) findings.push({ id: 'final-punct', kind: 'error', en: 'End your text with a full stop.', he: 'סיימו את הטקסט בנקודה.' });

  return { words, sentences, paragraphs, avgSentenceLength, connectorsUsed, findings };
}
