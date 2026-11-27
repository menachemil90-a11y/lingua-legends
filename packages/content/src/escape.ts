/**
 * Escape Room content: original rooms whose locks open only by reading and using English.
 * All puzzles are graded deterministically.
 */
import { normalizeText, type CefrLevel } from '@lingua/shared';

interface PuzzleBase {
  id: string;
  /** Hotspot in the room scene that opens this puzzle. */
  object: 'note' | 'clock' | 'bookshelf' | 'desk' | 'telescope' | 'logbook' | 'chest' | 'door-panel' | 'map' | 'radio';
  title: string;
  /** The English material to read (sign, note, document). */
  text?: string;
  question: string;
  explanation: { en: string; he: string };
  hint: { en: string; he: string };
  vocabulary: string[];
}

export type EscapePuzzle =
  | (PuzzleBase & { kind: 'choice'; options: string[]; answer: number })
  | (PuzzleBase & { kind: 'text'; accepted: string[] })
  | (PuzzleBase & { kind: 'order'; steps: string[] });

export interface EscapeRoom {
  id: string;
  title: string;
  titleHe: string;
  level: CefrLevel;
  theme: 'workshop' | 'observatory' | 'station';
  intro: string;
  introHe: string;
  /** Suggested time for the optional timed mode. */
  timedSeconds: number;
  puzzles: EscapePuzzle[];
  outro: string;
  outroHe: string;
}

export type EscapeAnswer = { kind: 'choice'; index: number } | { kind: 'text'; text: string } | { kind: 'order'; order: string[] };

export function checkEscapeAnswer(p: EscapePuzzle, a: EscapeAnswer): boolean {
  if (p.kind === 'choice' && a.kind === 'choice') return a.index === p.answer;
  if (p.kind === 'text' && a.kind === 'text') {
    const n = normalizeText(a.text).replace(/^(a|an|the)\s+/, '');
    return p.accepted.some((x) => normalizeText(x).replace(/^(a|an|the)\s+/, '') === n);
  }
  if (p.kind === 'order' && a.kind === 'order') return a.order.length === p.steps.length && a.order.every((s, i) => s === p.steps[i]);
  return false;
}

export const ESCAPE_ROOMS: EscapeRoom[] = [
  {
    id: 'escape-clockmaker',
    title: "The Clockmaker's Workshop",
    titleHe: 'סדנת השען',
    level: 'A2',
    theme: 'workshop',
    timedSeconds: 600,
    intro: 'The old clockmaker has locked you in his workshop by mistake. He left notes everywhere. Read them carefully to open the four locks on the door.',
    introHe: 'השען הזקן נעל אתכם בטעות בסדנה שלו. הוא השאיר פתקים בכל מקום. קראו אותם בעיון כדי לפתוח את ארבעת המנעולים בדלת.',
    outro: 'Click! The door swings open. On the other side, the clockmaker smiles: "You read like a real professional!"',
    outroHe: 'קליק! הדלת נפתחת. מהצד השני השען מחייך: "אתם קוראים כמו מקצוענים!"',
    puzzles: [
      {
        id: 'cm-notice',
        kind: 'choice',
        object: 'note',
        title: 'Notice on the wall',
        text: 'PLEASE DO NOT TOUCH THE BIG CLOCK. It is very old.\nBefore you leave, wind the SMALL clock two times. The key is under the blue box.',
        question: 'What should you do before you leave?',
        options: ['Wind the small clock twice', 'Wind the big clock twice', 'Open the blue box two times', 'Touch the big clock once'],
        answer: 0,
        explanation: { en: "The notice says: 'wind the SMALL clock two times'. 'Twice' means two times.", he: "בהודעה כתוב: לכוון את השעון הקטן פעמיים. twice פירושו פעמיים." },
        hint: { en: 'Look for the word SMALL.', he: 'חפשו את המילה SMALL.' },
        vocabulary: ['twice', 'wind'],
      },
      {
        id: 'cm-riddle',
        kind: 'text',
        object: 'clock',
        title: 'Riddle on the small clock',
        text: 'I have a face, but no eyes.\nI have two hands, but I cannot clap.\nI tell you something all day long, but I never speak.',
        question: 'What am I? (one word)',
        accepted: ['clock', 'a clock', 'watch', 'a watch'],
        explanation: { en: "A clock has a 'face' and 'hands', and it tells the time.", he: 'לשעון יש "פנים" ו"ידיים" (מחוגים), והוא מראה את השעה.' },
        hint: { en: 'You are standing next to one.', he: 'אתם עומדים ליד אחד כזה.' },
        vocabulary: ['clock', 'face', 'hands'],
      },
      {
        id: 'cm-steps',
        kind: 'order',
        object: 'desk',
        title: 'Repair instructions (torn into pieces)',
        question: 'Put the repair steps in the right order.',
        steps: [
          'First, open the back of the clock.',
          'Then, take out the old battery.',
          'Next, put in a new battery.',
          'Finally, close the back and check the time.',
        ],
        explanation: { en: "Sequence words show the order: first → then → next → finally.", he: 'מילות רצף מראות את הסדר: first ← then ← next ← finally.' },
        hint: { en: "Start with 'First' and end with 'Finally'.", he: 'התחילו ב-First וסיימו ב-Finally.' },
        vocabulary: ['first', 'then', 'next', 'finally'],
      },
      {
        id: 'cm-code',
        kind: 'text',
        object: 'chest',
        title: 'The letter lock on the chest',
        text: '1. The opposite of "take": G _ _ _\n2. Not late: E _ _ _ _\n3. You hear with them: E _ _ _\n4. Not wrong: R _ _ _ _\nThe first letters of the four answers open the lock.',
        question: 'Which 4-letter word opens the lock?',
        accepted: ['gear'],
        explanation: { en: 'give, early, ears, right → G-E-A-R. A gear is a wheel with teeth inside a clock.', he: 'give, early, ears, right ← G-E-A-R. gear הוא גלגל שיניים בתוך שעון.' },
        hint: { en: 'Answer 3 is a part of your body. Answer 4 is the opposite of "wrong".', he: 'תשובה 3 היא איבר בגוף. תשובה 4 היא ההפך של wrong.' },
        vocabulary: ['give', 'early', 'right', 'gear'],
      },
    ],
  },
  {
    id: 'escape-observatory',
    title: 'The Observatory at Midnight',
    titleHe: 'מצפה הכוכבים בחצות',
    level: 'B2',
    theme: 'observatory',
    timedSeconds: 720,
    intro: 'A storm has cut the power at the mountain observatory, and the electronic doors have sealed. The last astronomer on duty left a logbook and a few clues. Restore the backup system before sunrise.',
    introHe: 'סערה ניתקה את החשמל במצפה הכוכבים שעל ההר, והדלתות האלקטרוניות ננעלו. האסטרונומית האחרונה במשמרת השאירה יומן וכמה רמזים. הפעילו את מערכת הגיבוי לפני הזריחה.',
    outro: 'The backup generator hums to life and the doors slide open. Above you, the comet blazes across the sky — exactly where the logbook said it would be.',
    outroHe: 'הגנרטור מתעורר לחיים והדלתות נפתחות. מעליכם השביט חוצה את השמיים — בדיוק היכן שהיומן אמר.',
    puzzles: [
      {
        id: 'ob-logbook',
        kind: 'choice',
        object: 'logbook',
        title: "The astronomer's logbook",
        text: 'Monday: Clouds all night. Nothing to report.\nTuesday: Clear skies at first, but the telescope motor failed before midnight.\nWednesday: Motor repaired. Clear until 2 a.m. — finally saw the comet near the horizon!\nThursday: Heavy rain. Observatory closed.',
        question: 'On which night was the comet actually observed?',
        options: ['Wednesday', 'Tuesday', 'Monday', 'Thursday'],
        answer: 0,
        explanation: { en: "Only Wednesday's entry says 'finally saw the comet'. On Tuesday the skies were clear, but the motor failed.", he: 'רק ביום רביעי כתוב finally saw the comet. ביום שלישי השמיים היו בהירים, אבל המנוע התקלקל.' },
        hint: { en: "Clear skies alone weren't enough. What else was needed?", he: 'שמיים בהירים לבד לא הספיקו. מה עוד היה צריך?' },
        vocabulary: ['observe', 'horizon', 'repair'],
      },
      {
        id: 'ob-synonyms',
        kind: 'choice',
        object: 'telescope',
        title: 'Telescope calibration panel',
        text: "The panel reads: 'Select the setting whose label means the same as DIM.'",
        question: 'Which label should you select?',
        options: ['faint', 'vivid', 'dense', 'distant'],
        answer: 0,
        explanation: { en: "'Dim' and 'faint' both describe light that is weak and hard to see.", he: 'dim ו-faint מתארים שניהם אור חלש וקשה לראות.' },
        hint: { en: 'Think of a weak light far away.', he: 'חשבו על אור חלש רחוק.' },
        vocabulary: ['dim', 'faint', 'vivid'],
      },
      {
        id: 'ob-letter',
        kind: 'order',
        object: 'desk',
        title: 'Scattered pages of an email',
        question: 'Put the paragraphs of the email back in a logical order.',
        steps: [
          'Dear team, I am writing to report a problem with the backup generator.',
          'Although it started normally last week, it now shuts down after a few seconds.',
          'As a result, the doors may lock if the main power fails.',
          'Therefore, please check the fuel valve before the next storm. Best regards, Dr. Amir',
        ],
        explanation: { en: "Opening → contrast with 'Although' → consequence with 'As a result' → request with 'Therefore' → sign-off.", he: 'פתיחה ← ניגוד עם Although ← תוצאה עם As a result ← בקשה עם Therefore ← חתימה.' },
        hint: { en: 'Connectors like "As a result" and "Therefore" follow the problem they refer to.', he: 'מילות קישור כמו As a result ו-Therefore באות אחרי הבעיה שאליה הן מתייחסות.' },
        vocabulary: ['although', 'as a result', 'therefore'],
      },
      {
        id: 'ob-valve',
        kind: 'text',
        object: 'door-panel',
        title: 'Backup system password',
        text: "Maintenance note: 'The password is the verb that means \"to make something bad less severe\". Hint for new staff: engineers ___ risks; doctors ___ pain.'",
        question: 'Type the password (one verb).',
        accepted: ['mitigate', 'alleviate', 'lessen', 'reduce', 'ease'],
        explanation: { en: "'Mitigate' (or 'alleviate') means to make something less severe. 'Reduce' and 'lessen' are simpler synonyms.", he: 'mitigate (או alleviate) פירושו להקל, להפחית חומרה. reduce ו-lessen הן מילים נרדפות פשוטות יותר.' },
        hint: { en: "It starts with 'm' in formal English: m _ _ _ _ _ _ _.", he: 'באנגלית רשמית היא מתחילה ב-m: m _ _ _ _ _ _ _.' },
        vocabulary: ['mitigate', 'alleviate'],
      },
    ],
  },
  {
    id: 'escape-station',
    title: 'Last Train from Platform 9',
    titleHe: 'הרכבת האחרונה מרציף 9',
    level: 'B1',
    theme: 'station',
    timedSeconds: 600,
    intro: "You fell asleep in the station waiting room and the night guard locked the doors. The last train leaves soon. Use the station's signs and messages to get out in time.",
    introHe: 'נרדמתם בחדר ההמתנה של התחנה והשומר נעל את הדלתות. הרכבת האחרונה יוצאת בקרוב. השתמשו בשלטים ובהודעות של התחנה כדי לצאת בזמן.',
    outro: 'You run onto Platform 9 just as the doors are closing. The conductor waves you in — you made it!',
    outroHe: 'אתם רצים לרציף 9 בדיוק כשהדלתות נסגרות. הכרטיסן מסמן לכם להיכנס — הצלחתם!',
    puzzles: [
      {
        id: 'st-timetable',
        kind: 'choice',
        object: 'map',
        title: 'Timetable board',
        text: 'Trains to Northport:\n22:40 — Platform 4 — CANCELLED\n23:15 — Platform 9 — delayed by 10 minutes\n23:50 — Platform 2 — weekends only\nToday is Tuesday.',
        question: 'What time will the next train to Northport leave tonight?',
        options: ['23:25', '23:15', '22:40', '23:50'],
        answer: 0,
        explanation: { en: '22:40 is cancelled and 23:50 runs only at weekends. The 23:15 train is delayed by ten minutes, so it leaves at 23:25.', he: 'הרכבת של 22:40 בוטלה, ו-23:50 נוסעת רק בסופי שבוע. הרכבת של 23:15 מתעכבת בעשר דקות, ולכן יוצאת ב-23:25.' },
        hint: { en: "Read the words 'cancelled', 'delayed' and 'weekends only' carefully.", he: 'קראו בעיון את המילים cancelled, delayed ו-weekends only.' },
        vocabulary: ['cancelled', 'delayed', 'timetable'],
      },
      {
        id: 'st-radio',
        kind: 'text',
        object: 'radio',
        title: "The guard's radio message",
        text: "\"...if anyone is still inside, the emergency exit code is the past tense of 'leave', written backwards...\"",
        question: 'Type the code.',
        accepted: ['tfel'],
        explanation: { en: "The past tense of 'leave' is 'left'. Written backwards: T-F-E-L.", he: 'צורת העבר של leave היא left. הפוך: T-F-E-L.' },
        hint: { en: "'Leave' is an irregular verb: leave – ? – left.", he: 'leave הוא פועל לא סדיר: leave – ? – left.' },
        vocabulary: ['leave', 'left'],
      },
      {
        id: 'st-sign',
        kind: 'choice',
        object: 'note',
        title: 'Sign on the emergency door',
        text: 'EMERGENCY EXIT. Push the bar firmly. Do not use this door unless the main entrance is locked. An alarm will sound when the door is opened.',
        question: 'Which statement is true according to the sign?',
        options: ['You may use this door because the main entrance is locked.', 'The alarm sounds before you push the bar.', 'This door should be pulled gently.', 'Only staff may use this door.'],
        answer: 0,
        explanation: { en: "'Do not use this door unless the main entrance is locked' — the main entrance IS locked, so you may use it. 'Unless' = 'except if'.", he: 'Do not use this door unless the main entrance is locked — הכניסה הראשית נעולה, ולכן מותר להשתמש בדלת. unless = אלא אם כן.' },
        hint: { en: "What does 'unless' mean?", he: 'מה פירוש unless?' },
        vocabulary: ['unless', 'firmly', 'emergency'],
      },
    ],
  },
];
