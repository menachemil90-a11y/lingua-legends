/**
 * Preview content for Real Life (text conversation simulator) and English Detective.
 * Fully deterministic: no AI, no speech recognition.
 */
import type { CefrLevel } from '@lingua/shared';

export interface DialogueChoice {
  text: string;
  next: string;
  quality: 'best' | 'ok' | 'poor';
  feedback: { en: string; he: string };
}

export interface DialogueNode {
  id: string;
  line: string;
  choices?: DialogueChoice[];
  end?: { en: string; he: string };
}

export interface DialogueScenario {
  id: string;
  title: string;
  titleHe: string;
  level: CefrLevel;
  setting: string;
  character: { name: string; role: string };
  start: string;
  nodes: DialogueNode[];
}

export const REAL_LIFE_SCENARIOS: DialogueScenario[] = [
  {
    id: 'rl-airport',
    title: 'Airport check-in',
    titleHe: "צ'ק-אין בשדה התעופה",
    level: 'A2',
    setting: 'Terminal 3, check-in desk 12',
    character: { name: 'Dana', role: 'Check-in agent' },
    start: 'n1',
    nodes: [
      {
        id: 'n1',
        line: 'Good morning! Where are you flying to today?',
        choices: [
          { text: "Good morning. I'm flying to London.", next: 'n2', quality: 'best', feedback: { en: 'Polite greeting and a clear answer.', he: 'ברכה מנומסת ותשובה ברורה.' } },
          { text: 'London.', next: 'n2', quality: 'ok', feedback: { en: 'Correct, but a greeting sounds friendlier.', he: 'נכון, אבל ברכה נשמעת ידידותית יותר.' } },
          { text: 'I am fly London.', next: 'n2', quality: 'poor', feedback: { en: "Use 'I'm flying to London' (Present Progressive + 'to').", he: "אומרים I'm flying to London (הווה מתמשך + to)." } },
        ],
      },
      {
        id: 'n2',
        line: 'Great. Can I see your passport, please?',
        choices: [
          { text: 'Of course. Here you are.', next: 'n3', quality: 'best', feedback: { en: "'Here you are' is the natural phrase when handing something over.", he: 'Here you are הוא הביטוי הטבעי כשמוסרים משהו.' } },
          { text: 'Yes, take it.', next: 'n3', quality: 'ok', feedback: { en: "Understandable but a little abrupt. Try 'Here you are'.", he: 'מובן, אבל קצת חד. נסו Here you are.' } },
          { text: 'Why you need it?', next: 'n3', quality: 'poor', feedback: { en: "Questions need an auxiliary: 'Why do you need it?' — and passports are always required.", he: 'בשאלה צריך פועל עזר: Why do you need it?' } },
        ],
      },
      {
        id: 'n3',
        line: 'Thank you. Are you checking in any bags today?',
        choices: [
          { text: 'Yes, just this one suitcase.', next: 'n4', quality: 'best', feedback: { en: 'Clear and complete.', he: 'ברור ומלא.' } },
          { text: 'No, I only have hand luggage.', next: 'n5', quality: 'best', feedback: { en: "'Hand luggage' is the bag you take on the plane.", he: 'hand luggage הוא התיק שלוקחים למטוס.' } },
          { text: 'I have a bag on my hand.', next: 'n4', quality: 'poor', feedback: { en: "We say 'in my hand', and 'hand luggage' for cabin bags.", he: 'אומרים in my hand, ולתיק למטוס hand luggage.' } },
        ],
      },
      {
        id: 'n4',
        line: "Please put it on the scale. It's 21 kilos — that's one kilo over the limit.",
        choices: [
          { text: 'Oh, sorry. Can I take something out?', next: 'n5', quality: 'best', feedback: { en: 'A polite apology and a solution.', he: 'התנצלות מנומסת והצעת פתרון.' } },
          { text: 'Is there a fee for that?', next: 'n5', quality: 'ok', feedback: { en: 'A useful question. An apology first would sound even more polite.', he: 'שאלה שימושית. התנצלות לפני כן נשמעת מנומסת יותר.' } },
          { text: 'That is not my problem.', next: 'n5', quality: 'poor', feedback: { en: 'This sounds rude. Try asking what you can do.', he: 'זה נשמע גס. נסו לשאול מה אפשר לעשות.' } },
        ],
      },
      {
        id: 'n5',
        line: 'All done. Your gate is B7 and boarding starts at 10:40. Have a nice flight!',
        choices: [
          { text: 'Thank you very much. Have a good day!', next: 'end', quality: 'best', feedback: { en: 'A warm, natural ending.', he: 'סיום חם וטבעי.' } },
          { text: 'Sorry, what time does boarding start?', next: 'end', quality: 'ok', feedback: { en: 'Asking to repeat is a great skill!', he: 'לבקש חזרה זו מיומנות חשובה!' } },
        ],
      },
      { id: 'end', line: 'You head to gate B7. Check-in complete!', end: { en: 'You completed check-in in English.', he: "השלמתם צ'ק-אין באנגלית." } },
    ],
  },
  {
    id: 'rl-interview',
    title: 'Job interview: café supervisor',
    titleHe: 'ראיון עבודה: אחראי משמרת בבית קפה',
    level: 'B2',
    setting: 'A busy café, Tuesday afternoon',
    character: { name: 'Mr. Levi', role: 'Café manager' },
    start: 'i1',
    nodes: [
      {
        id: 'i1',
        line: 'Thanks for coming in. Could you tell me a little about yourself?',
        choices: [
          { text: "Of course. I've worked as a barista for two years, and I enjoy leading a team during busy shifts.", next: 'i2', quality: 'best', feedback: { en: 'Relevant experience plus a strength linked to the job.', he: 'ניסיון רלוונטי וחוזקה שקשורה לתפקיד.' } },
          { text: "I'm 19 and I like coffee.", next: 'i2', quality: 'ok', feedback: { en: 'True, but focus on experience and skills.', he: 'נכון, אבל כדאי להתמקד בניסיון ובכישורים.' } },
          { text: 'What do you want to know?', next: 'i2', quality: 'poor', feedback: { en: 'Answer the question; interviewers expect you to lead here.', he: 'ענו על השאלה; המראיין מצפה שתובילו כאן.' } },
        ],
      },
      {
        id: 'i2',
        line: 'Tell me about a time you dealt with an unhappy customer.',
        choices: [
          { text: 'Once a customer received the wrong order. I apologised, remade it immediately and offered a free pastry. He left a positive review.', next: 'i3', quality: 'best', feedback: { en: 'Situation, action, result — a clear structure.', he: 'מצב, פעולה, תוצאה — מבנה ברור.' } },
          { text: 'I always make customers happy.', next: 'i3', quality: 'ok', feedback: { en: 'Give a specific example to be convincing.', he: 'תנו דוגמה ספציפית כדי לשכנע.' } },
          { text: 'Customers are often wrong, so I ignore them.', next: 'i3', quality: 'poor', feedback: { en: 'This is a red flag for any service job.', he: 'זו נורה אדומה בכל עבודת שירות.' } },
        ],
      },
      {
        id: 'i3',
        line: 'Do you have any questions for me?',
        choices: [
          { text: 'Yes — what would a typical first month in this role look like?', next: 'iend', quality: 'best', feedback: { en: 'A thoughtful question shows genuine interest.', he: 'שאלה מחושבת מראה עניין אמיתי.' } },
          { text: 'How much is the salary?', next: 'iend', quality: 'ok', feedback: { en: 'A fair question, but usually better later in the process.', he: 'שאלה לגיטימית, אבל בדרך כלל עדיף מאוחר יותר.' } },
          { text: 'No.', next: 'iend', quality: 'poor', feedback: { en: 'Prepare at least one question in advance.', he: 'הכינו מראש לפחות שאלה אחת.' } },
        ],
      },
      { id: 'iend', line: "Thank you — we'll be in touch soon.", end: { en: 'Interview complete. Review your choices below.', he: 'הראיון הסתיים. עברו על הבחירות שלכם למטה.' } },
    ],
  },
];

export interface CaseEvidence {
  id: string;
  kind: 'message' | 'statement' | 'notice' | 'document';
  title: string;
  from?: string;
  body: string;
}

export interface CaseQuestion {
  id: string;
  prompt: string;
  options: string[];
  /** Index of the correct option. */
  answer: number;
  explanation: { en: string; he: string };
  evidenceIds: string[];
}

export interface DetectiveCase {
  id: string;
  title: string;
  titleHe: string;
  level: CefrLevel;
  briefing: string;
  briefingHe: string;
  suspects: { id: string; name: string; role: string }[];
  evidence: CaseEvidence[];
  questions: CaseQuestion[];
  culpritId: string;
  solution: { en: string; he: string };
}

export const DETECTIVE_CASES: DetectiveCase[] = [
  {
    id: 'case-missing-trophy',
    title: 'The Missing Trophy',
    titleHe: 'הגביע שנעלם',
    level: 'B1',
    briefing: "The school's chess trophy disappeared from the display case on Thursday afternoon. Read the evidence and find out who took it — and why.",
    briefingHe: 'גביע השחמט של בית הספר נעלם מארון התצוגה ביום חמישי אחר הצהריים. קראו את הראיות וגלו מי לקח אותו — ולמה.',
    suspects: [
      { id: 'omer', name: 'Omer', role: 'Chess club captain' },
      { id: 'shira', name: 'Shira', role: 'Student newspaper editor' },
      { id: 'mr-cohen', name: 'Mr. Cohen', role: 'Caretaker' },
    ],
    evidence: [
      { id: 'ev-notice', kind: 'notice', title: 'Notice on the display case', body: 'This case will be cleaned on Friday morning. Please do not touch the glass before then. — Maintenance' },
      { id: 'ev-omer', kind: 'statement', title: "Omer's statement", from: 'Omer', body: 'I left school at 2:30 on Thursday because I had a dentist appointment. The trophy was definitely there at lunchtime — I showed it to a new member.' },
      { id: 'ev-shira-msg', kind: 'message', title: 'Message on Shira\'s phone (Thursday 3:52 pm)', from: 'Shira → Maya', body: "Got the photo for Monday's front page!! Don't tell anyone yet. I'll put it back before anyone notices 😅" },
      { id: 'ev-cohen', kind: 'statement', title: "Mr. Cohen's statement", from: 'Mr. Cohen', body: 'I was fixing the heating in the gym from 1 pm until 5 pm. I never went near the display case on Thursday. I clean it on Fridays.' },
      { id: 'ev-log', kind: 'document', title: 'Photography room booking log', body: 'Thursday 3:30–4:00 pm — S. Ben-David (Newspaper) — "Studio lights for object photo".' },
    ],
    questions: [
      { id: 'cq1', prompt: 'Why is Omer unlikely to be the thief?', options: ['He was not at school when the trophy disappeared.', 'He does not like chess.', 'He cleans the display case.'], answer: 0, explanation: { en: 'He left at 2:30 for the dentist, and the trophy disappeared later in the afternoon.', he: 'הוא יצא ב-2:30 לרופא השיניים, והגביע נעלם מאוחר יותר.' }, evidenceIds: ['ev-omer'] },
      { id: 'cq2', prompt: "What does Shira mean by 'I'll put it back before anyone notices'?", options: ['She plans to return something she took.', 'She lost her phone.', 'She wants to win the trophy.'], answer: 0, explanation: { en: "'Put it back' means return something to its place.", he: 'put it back פירושו להחזיר משהו למקומו.' }, evidenceIds: ['ev-shira-msg'] },
      { id: 'cq3', prompt: 'Which piece of evidence supports Shira\'s message?', options: ['The photography room booking log', "Mr. Cohen's statement", 'The cleaning notice'], answer: 0, explanation: { en: "S. Ben-David booked studio lights for an 'object photo' at 3:30, just before her message.", he: 'ש. בן-דוד הזמינה תאורת סטודיו ל"צילום חפץ" ב-3:30, רגע לפני ההודעה.' }, evidenceIds: ['ev-log', 'ev-shira-msg'] },
    ],
    culpritId: 'shira',
    solution: {
      en: "Shira borrowed the trophy to photograph it for Monday's front page and planned to return it. Borrowing without permission is still not OK — but it wasn't a theft for profit.",
      he: 'שירה שאלה את הגביע כדי לצלם אותו לעמוד הראשון של יום שני ותכננה להחזיר אותו. לקחת בלי רשות זה עדיין לא בסדר — אבל זו לא הייתה גניבה.',
    },
  },
];
