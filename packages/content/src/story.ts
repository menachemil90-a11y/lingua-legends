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
  {
    id: 'rl-hotel',
    title: 'Hotel check-in',
    titleHe: "צ'ק-אין במלון",
    level: 'A2',
    setting: 'Seaview Hotel reception, 9 p.m.',
    character: { name: 'Maya', role: 'Receptionist' },
    start: 'h1',
    nodes: [
      {
        id: 'h1',
        line: 'Good evening! Welcome to the Seaview Hotel. Do you have a reservation?',
        choices: [
          { text: 'Good evening. Yes, I booked a double room for three nights.', next: 'h2', quality: 'best', feedback: { en: 'Clear: booking, room type and length of stay.', he: 'ברור: הזמנה, סוג חדר ומשך השהייה.' } },
          { text: 'Yes. Room.', next: 'h2', quality: 'ok', feedback: { en: 'Understandable, but full sentences sound more polite.', he: 'מובן, אבל משפטים מלאים נשמעים מנומסים יותר.' } },
          { text: 'I am reserve a room.', next: 'h2', quality: 'poor', feedback: { en: "Say 'I have a reservation' or 'I reserved a room'.", he: 'אומרים I have a reservation או I reserved a room.' } },
        ],
      },
      {
        id: 'h2',
        line: 'Perfect, I found it. Breakfast is from seven to ten. Would you like a room with a sea view? It is twenty euros extra per night.',
        choices: [
          { text: 'No, thank you. The standard room is fine.', next: 'h3', quality: 'best', feedback: { en: "A polite way to refuse: 'No, thank you…'.", he: 'דרך מנומסת לסרב: No, thank you…' } },
          { text: 'Yes, please — that sounds lovely.', next: 'h3', quality: 'best', feedback: { en: 'Polite and natural acceptance.', he: 'הסכמה מנומסת וטבעית.' } },
          { text: 'Why I must pay more?', next: 'h3', quality: 'poor', feedback: { en: "Question order: 'Why do I have to pay more?' — but a sea view is an optional upgrade.", he: 'סדר מילים בשאלה: Why do I have to pay more? — וחוץ מזה זו תוספת אופציונלית.' } },
        ],
      },
      {
        id: 'h3',
        line: 'Here is your key card. Your room is on the fourth floor. Is there anything else I can help you with?',
        choices: [
          { text: 'Yes, could you tell me the Wi-Fi password, please?', next: 'hend', quality: 'best', feedback: { en: "'Could you…, please?' is a polite request.", he: 'Could you…, please? היא בקשה מנומסת.' } },
          { text: 'What time is breakfast again?', next: 'hend', quality: 'ok', feedback: { en: "Fine — but she already said 7–10. Listening carefully saves time!", he: 'בסדר — אבל היא כבר אמרה 7–10. הקשבה טובה חוסכת זמן!' } },
          { text: 'No.', next: 'hend', quality: 'poor', feedback: { en: "Add 'thank you': 'No, that's all, thank you.'", he: "הוסיפו תודה: No, that's all, thank you." } },
        ],
      },
      { id: 'hend', line: 'Enjoy your stay!', end: { en: 'You checked in smoothly and politely.', he: "השלמתם צ'ק-אין בצורה חלקה ומנומסת." } },
    ],
  },
  {
    id: 'rl-restaurant',
    title: 'Restaurant: a polite complaint',
    titleHe: 'מסעדה: תלונה מנומסת',
    level: 'B1',
    setting: 'A busy Italian restaurant',
    character: { name: 'Luca', role: 'Waiter' },
    start: 'r1',
    nodes: [
      {
        id: 'r1',
        line: 'How is everything with your meal?',
        choices: [
          { text: "It looks great, but I'm afraid my pasta is cold.", next: 'r2', quality: 'best', feedback: { en: "'I'm afraid…' softens a complaint politely.", he: "I'm afraid… מרכך תלונה בצורה מנומסת." } },
          { text: 'The pasta is cold.', next: 'r2', quality: 'ok', feedback: { en: 'Clear, but a softener sounds friendlier.', he: 'ברור, אבל ריכוך נשמע ידידותי יותר.' } },
          { text: 'This food is terrible!', next: 'r2', quality: 'poor', feedback: { en: 'Too aggressive — describe the problem calmly.', he: 'תוקפני מדי — תארו את הבעיה ברוגע.' } },
        ],
      },
      {
        id: 'r2',
        line: "I'm so sorry about that. Would you like me to heat it up, or would you prefer something else?",
        choices: [
          { text: "Could you bring a fresh one, please? I'd rather not wait too long.", next: 'r3', quality: 'best', feedback: { en: "'I'd rather…' expresses a preference politely.", he: "I'd rather… מביע העדפה בצורה מנומסת." } },
          { text: 'Heat it, please.', next: 'r3', quality: 'ok', feedback: { en: "Fine. 'Could you heat it up, please?' is more natural.", he: 'בסדר. Could you heat it up, please? טבעי יותר.' } },
          { text: 'I want my money back now.', next: 'r3', quality: 'poor', feedback: { en: 'The waiter offered a solution — respond to it first.', he: 'המלצר הציע פתרון — כדאי להגיב לו קודם.' } },
        ],
      },
      {
        id: 'r3',
        line: "Of course. It'll be about five minutes. Can I get you anything while you wait?",
        choices: [
          { text: "Just some water, thanks. And thank you for sorting this out so quickly.", next: 'rend', quality: 'best', feedback: { en: 'Thanking staff ends the complaint on a positive note.', he: 'תודה לצוות מסיימת את התלונה בטון חיובי.' } },
          { text: "No, it's fine.", next: 'rend', quality: 'ok', feedback: { en: 'Polite enough.', he: 'מנומס מספיק.' } },
        ],
      },
      { id: 'rend', line: 'Here is your fresh pasta. Enjoy!', end: { en: 'You solved a problem politely and got what you wanted.', he: 'פתרתם בעיה בנימוס וקיבלתם את מה שרציתם.' } },
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
  {
    id: 'case-silent-lab',
    title: 'The Silent Lab',
    titleHe: 'המעבדה השקטה',
    level: 'B2',
    briefing: "On Monday morning, the robotics club's competition robot would not start. Someone removed its control chip over the weekend. Study the evidence and identify who did it.",
    briefingHe: 'ביום שני בבוקר רובוט התחרות של מועדון הרובוטיקה לא הופעל. מישהו הוציא את שבב הבקרה שלו בסוף השבוע. עיינו בראיות וזהו מי עשה זאת.',
    suspects: [
      { id: 'yael', name: 'Yael', role: 'Club captain' },
      { id: 'ben', name: 'Ben', role: 'New club member' },
      { id: 'ms-katz', name: 'Ms. Katz', role: 'Science teacher' },
    ],
    evidence: [
      { id: 'sl-log', kind: 'document', title: 'Lab door access log', body: 'Saturday 10:02 — card: Y. Mizrahi (captain)\nSaturday 10:47 — card: Y. Mizrahi (captain)\nSunday — no entries' },
      { id: 'sl-yael', kind: 'statement', title: "Yael's statement", from: 'Yael', body: 'I came in on Saturday only to collect my laptop. I was in and out in less than five minutes, and the robot was working when I left.' },
      { id: 'sl-msg', kind: 'message', title: 'Message in the club group (Saturday 10:40)', from: 'Ben', body: "Yael, I left my water bottle in the lab yesterday — could you let me in for a sec? I'm outside the door." },
      { id: 'sl-katz', kind: 'statement', title: "Ms. Katz's statement", from: 'Ms. Katz', body: 'I was at a conference in Tel Aviv all weekend. I only have a key for the main building, not for the lab.' },
      { id: 'sl-receipt', kind: 'document', title: 'Online order (Sunday evening)', body: 'Customer: B. Levi — Item: "Control chip, model RX-7 (same as competition robots)" — Express delivery.' },
    ],
    questions: [
      { id: 'sq1', prompt: 'What does the access log show about Saturday?', options: ["Yael's card opened the door twice, 45 minutes apart.", 'Nobody entered the lab on Saturday.', 'Ms. Katz entered the lab on Saturday.'], answer: 0, explanation: { en: 'The log shows two entries with Yael\'s card at 10:02 and 10:47.', he: 'ביומן יש שתי כניסות עם הכרטיס של יעל, ב-10:02 וב-10:47.' }, evidenceIds: ['sl-log'] },
      { id: 'sq2', prompt: 'Which statement contradicts the access log?', options: ['"I was in and out in less than five minutes."', '"I only have a key for the main building."', '"I left my water bottle in the lab."'], answer: 0, explanation: { en: 'Yael says she stayed under five minutes, yet her card was used again 45 minutes later — the second entry needs an explanation.', he: 'יעל אומרת שהייתה פחות מחמש דקות, אבל הכרטיס שלה שימש שוב 45 דקות אחר כך — הכניסה השנייה דורשת הסבר.' }, evidenceIds: ['sl-yael', 'sl-log'] },
      { id: 'sq3', prompt: 'What is the most likely explanation of the second entry?', options: ['Yael let Ben into the lab after his message.', 'Ms. Katz borrowed Yael\'s card.', 'The log made a mistake.'], answer: 0, explanation: { en: "Ben asked to be let in at 10:40 while standing outside; the card was used at 10:47.", he: 'בן ביקש שיכניסו אותו ב-10:40 כשעמד בחוץ; הכרטיס שימש ב-10:47.' }, evidenceIds: ['sl-msg', 'sl-log'] },
      { id: 'sq4', prompt: 'Why is the Sunday order suspicious?', options: ['Ben bought an identical chip — possibly to replace the one he took or damaged.', 'Ms. Katz ordered it for the conference.', 'It proves Yael removed the chip.'], answer: 0, explanation: { en: "Buying the exact same model right after the incident suggests Ben was trying to put things right quietly.", he: 'רכישת אותו דגם בדיוק מיד אחרי המקרה מרמזת שבן ניסה לתקן את המצב בשקט.' }, evidenceIds: ['sl-receipt'] },
    ],
    culpritId: 'ben',
    solution: {
      en: 'Ben, curious about the robot, removed the chip to study it after Yael let him in for his bottle — and broke a pin. He ordered a replacement and hoped nobody would notice. Yael simplified her story because she was not supposed to let non-members in alone.',
      he: 'בן, שהסתקרן מהרובוט, הוציא את השבב כדי לחקור אותו אחרי שיעל הכניסה אותו לקחת את הבקבוק — ושבר פין. הוא הזמין שבב חלופי וקיווה שאיש לא ישים לב. יעל פישטה את הסיפור שלה כי לא הייתה אמורה להכניס חברים חדשים לבד.',
    },
  },
];
