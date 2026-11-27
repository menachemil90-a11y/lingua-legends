/**
 * Preview content for Real Life (text conversation simulator) and English Detective.
 * Fully deterministic: no AI, no speech recognition.
 */
import type { CefrLevel, ReviewStatus } from '@lingua/shared';

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
  /** Original, AI-drafted dialogue until a teacher reviews it. */
  reviewStatus: ReviewStatus;
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
    reviewStatus: 'ai-drafted',
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
    reviewStatus: 'ai-drafted',
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
    reviewStatus: 'ai-drafted',
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
    reviewStatus: 'ai-drafted',
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
  {
    id: 'rl-shopping',
    title: 'Returning a jacket',
    titleHe: 'החזרת מעיל בחנות',
    level: 'A2',
    reviewStatus: 'ai-drafted',
    setting: 'A clothes shop in the city centre, Saturday morning',
    character: { name: 'Maya', role: 'Sales assistant' },
    start: 's1',
    nodes: [
      {
        id: 's1',
        line: 'Hi there! Can I help you?',
        choices: [
          { text: "Hi. I'd like to return this jacket, please.", next: 's2', quality: 'best', feedback: { en: "'I'd like to…' is a polite way to ask for something.", he: "I'd like to… היא דרך מנומסת לבקש משהו." } },
          { text: 'Yes, this jacket is bad.', next: 's2', quality: 'ok', feedback: { en: 'Understandable, but say what you want to do: return or exchange it.', he: 'מובן, אבל כדאי לומר מה אתם רוצים: להחזיר או להחליף.' } },
          { text: 'I want return this.', next: 's2', quality: 'poor', feedback: { en: "After 'want' we need 'to': 'I want to return this.'", he: "אחרי want צריך to: I want to return this." } },
        ],
      },
      {
        id: 's2',
        line: "Of course. What's wrong with it?",
        choices: [
          { text: "It's too small for me. I need a bigger size.", next: 's3', quality: 'best', feedback: { en: "'Too + adjective' explains the problem clearly.", he: 'too + שם תואר מסביר את הבעיה בבירור.' } },
          { text: 'The size.', next: 's3', quality: 'ok', feedback: { en: 'Try a full sentence: what is the problem with the size?', he: 'נסו משפט שלם: מה הבעיה עם המידה?' } },
          { text: "It's more small than I thought.", next: 's3', quality: 'poor', feedback: { en: "Short adjectives take -er: 'smaller', not 'more small'.", he: 'שמות תואר קצרים מקבלים er: אומרים smaller ולא more small.' } },
        ],
      },
      {
        id: 's3',
        line: 'Do you have the receipt?',
        choices: [
          { text: 'Yes, here it is. I bought it last Friday.', next: 's4', quality: 'best', feedback: { en: "'Bought' is the past of 'buy', and 'last Friday' needs no preposition.", he: 'bought היא צורת העבר של buy, ואחרי last Friday לא צריך מילת יחס.' } },
          { text: 'Hmm… I think so. Let me check my bag.', next: 's4', quality: 'ok', feedback: { en: "Natural! 'Let me check' buys you a moment politely.", he: 'טבעי! Let me check נותן לכם רגע בנימוס.' } },
          { text: 'Yes, I buyed it Friday.', next: 's4', quality: 'poor', feedback: { en: "'Buy' is irregular: 'I bought it last Friday' (or 'on Friday').", he: "buy הוא פועל חריג: I bought it last Friday (או on Friday)." } },
        ],
      },
      {
        id: 's4',
        line: 'Would you like a refund, or would you like to exchange it for a larger size?',
        choices: [
          { text: "I'd like to exchange it for a medium, please.", next: 's5a', quality: 'best', feedback: { en: "'Exchange it for' + the new item — exactly right.", he: 'exchange it for + הפריט החדש — בדיוק נכון.' } },
          { text: 'Could I have a refund, please?', next: 's5b', quality: 'best', feedback: { en: "'Could I have…, please?' is polite and clear.", he: 'Could I have…, please? מנומס וברור.' } },
          { text: 'Give me the money.', next: 's5b', quality: 'poor', feedback: { en: "This sounds rude. Try: 'Could I have a refund, please?'", he: 'זה נשמע גס. נסו: Could I have a refund, please?' } },
        ],
      },
      {
        id: 's5a',
        line: "Here's a medium. The fitting rooms are on your left.",
        choices: [
          { text: "Thanks! I'll try it on.", next: 'send', quality: 'best', feedback: { en: "With a pronoun, the phrasal verb splits: 'try it on'.", he: 'עם כינוי גוף הפועל המורכב מתפצל: try it on.' } },
          { text: "Thanks, I'll try on it.", next: 'send', quality: 'poor', feedback: { en: "Put the pronoun in the middle: 'try it on', not 'try on it'.", he: 'הכינוי בא באמצע: try it on, ולא try on it.' } },
        ],
      },
      {
        id: 's5b',
        line: 'No problem. The money will be back on your card in three to five days.',
        choices: [
          { text: 'Great, thank you for your help.', next: 'send', quality: 'best', feedback: { en: "'Thank you for + noun' — a warm, polite ending.", he: 'Thank you for + שם עצם — סיום חם ומנומס.' } },
          { text: 'Three to five days? Is that normal?', next: 'send', quality: 'ok', feedback: { en: 'A fair question — checking information is a useful skill.', he: 'שאלה הוגנת — לבדוק מידע זו מיומנות שימושית.' } },
        ],
      },
      { id: 'send', line: 'You leave the shop with everything sorted.', end: { en: 'You returned an item politely in English.', he: 'החזרתם מוצר בחנות באנגלית ובנימוס.' } },
    ],
  },
  {
    id: 'rl-support-call',
    title: 'Phone call: the internet is down',
    titleHe: 'שיחת טלפון: האינטרנט לא עובד',
    level: 'B1',
    reviewStatus: 'ai-drafted',
    setting: 'A phone call to an internet provider’s support line',
    character: { name: 'Ravi', role: 'Customer support agent' },
    start: 'c1',
    nodes: [
      {
        id: 'c1',
        line: 'Thank you for calling customer support, this is Ravi. How can I help you today?',
        choices: [
          { text: "Hi Ravi. My internet hasn't been working since this morning.", next: 'c2', quality: 'best', feedback: { en: "Present perfect + 'since' for a problem that started in the past and continues now.", he: 'Present Perfect עם since לבעיה שהתחילה בעבר ונמשכת עכשיו.' } },
          { text: 'Hello, I have a problem with my internet.', next: 'c2', quality: 'ok', feedback: { en: 'Polite, but add details: what exactly is happening, and since when?', he: 'מנומס, אבל הוסיפו פרטים: מה בדיוק קורה ומאיזה זמן?' } },
          { text: "My internet doesn't work from this morning.", next: 'c2', quality: 'poor', feedback: { en: "Use 'hasn't been working since', not 'doesn't work from'.", he: "אומרים hasn't been working since, ולא doesn't work from." } },
        ],
      },
      {
        id: 'c2',
        line: "I'm sorry to hear that. Could you tell me what the lights on your router are doing?",
        choices: [
          { text: 'The power light is green, but the internet light is flashing red.', next: 'c3', quality: 'best', feedback: { en: "Precise details help support find the problem quickly. 'But' contrasts the two lights.", he: 'פרטים מדויקים עוזרים לתמיכה למצוא את הבעיה מהר. but מנגיד בין שתי הנורות.' } },
          { text: 'There are some lights. Red, I think.', next: 'c3', quality: 'ok', feedback: { en: 'Try to describe which light and what it is doing.', he: 'נסו לתאר איזו נורה ומה היא עושה.' } },
          { text: "I don't know what is a router.", next: 'c3', quality: 'poor', feedback: { en: "In an embedded question, the verb goes last: 'I don't know what a router is.'", he: "בשאלה משובצת הפועל בא בסוף: I don't know what a router is." } },
        ],
      },
      {
        id: 'c3',
        line: 'Okay. Have you tried restarting the router?',
        choices: [
          { text: "Yes, I've already restarted it twice, but nothing has changed.", next: 'c4', quality: 'best', feedback: { en: "'Already' fits naturally with the present perfect.", he: 'already מתאים באופן טבעי ל-Present Perfect.' } },
          { text: "No, I haven't. Should I do it now?", next: 'c3b', quality: 'best', feedback: { en: 'An honest answer and a helpful follow-up question.', he: 'תשובה כנה ושאלת המשך מועילה.' } },
          { text: 'Yes, I restarted it before two hours.', next: 'c4', quality: 'poor', feedback: { en: "In English the time comes first: 'two hours ago', not 'before two hours'.", he: "באנגלית אומרים two hours ago ולא before two hours (תרגום ישיר של 'לפני שעתיים')." } },
        ],
      },
      {
        id: 'c3b',
        line: "Yes, please. Unplug it, wait thirty seconds and plug it back in… Is it working now?",
        choices: [
          { text: "No, the light is still red, I'm afraid.", next: 'c4', quality: 'best', feedback: { en: "'I'm afraid' softens bad news politely.", he: "I'm afraid מרכך בנימוס חדשות לא טובות." } },
          { text: 'Still not.', next: 'c4', quality: 'ok', feedback: { en: 'Understandable, but a full sentence sounds friendlier on the phone.', he: 'מובן, אבל בטלפון משפט שלם נשמע ידידותי יותר.' } },
        ],
      },
      {
        id: 'c4',
        line: 'It looks like there is a problem with the line in your area. A technician can visit tomorrow between 9 and 12. Would that suit you?',
        choices: [
          { text: 'That works for me. Could you send me a text message to confirm?', next: 'cend', quality: 'best', feedback: { en: 'You accept clearly and ask for written confirmation — very practical.', he: 'אתם מסכימים בבירור ומבקשים אישור בכתב — מעשי מאוד.' } },
          { text: "I won't be at home tomorrow. Is Thursday possible?", next: 'cend', quality: 'best', feedback: { en: "'I won't be…' + an alternative is a polite way to say no.", he: "I won't be… + הצעה חלופית היא דרך מנומסת לסרב." } },
          { text: 'Why it takes so long?', next: 'cend', quality: 'poor', feedback: { en: "Questions need 'do/does': 'Why does it take so long?'", he: 'בשאלה צריך do/does: Why does it take so long?' } },
        ],
      },
      { id: 'cend', line: 'Ravi books the visit and sends a confirmation.', end: { en: 'You reported a problem and arranged a solution by phone.', he: 'דיווחתם על תקלה ותיאמתם פתרון בטלפון.' } },
    ],
  },
  {
    id: 'rl-university',
    title: 'Office hours: asking for an extension',
    titleHe: 'שעת קבלה: בקשת הארכה',
    level: 'B2',
    reviewStatus: 'ai-drafted',
    setting: "A lecturer's office at the university, Tuesday afternoon",
    character: { name: 'Dr. Amari', role: 'Lecturer' },
    start: 'u1',
    nodes: [
      {
        id: 'u1',
        line: 'Come in! You wanted to talk about the research essay?',
        choices: [
          { text: "Yes, thank you for seeing me. I'm having some difficulty meeting the deadline, and I wanted to ask about my options.", next: 'u2', quality: 'best', feedback: { en: "Thanks first, then a soft, indirect request ('I wanted to ask…').", he: 'קודם תודה, ואחר כך בקשה רכה ועקיפה (I wanted to ask…).' } },
          { text: 'Yes. I need more time.', next: 'u2', quality: 'ok', feedback: { en: 'Clear, but very direct for a lecturer. Soften it and give context.', he: 'ברור, אבל ישיר מדי מול מרצה. רככו והוסיפו הקשר.' } },
          { text: 'Yes, the deadline is impossible, everyone says so.', next: 'u2', quality: 'poor', feedback: { en: 'Blaming the deadline (or others) weakens your request. Focus on your situation.', he: 'האשמת הדדליין (או אחרים) מחלישה את הבקשה. התמקדו במצב שלכם.' } },
        ],
      },
      {
        id: 'u2',
        line: "I see. Can you tell me what's been happening?",
        choices: [
          { text: "I was ill for most of last week, and I have a doctor's note. I've finished the research, but I haven't written the discussion yet.", next: 'u3', quality: 'best', feedback: { en: 'A reason, evidence and your progress — and correct present perfect with "yet".', he: 'סיבה, הוכחה והתקדמות — ו-Present Perfect נכון עם yet.' } },
          { text: 'I had a lot of things to do.', next: 'u3', quality: 'ok', feedback: { en: 'Too vague to be convincing. What exactly happened?', he: 'כללי מדי כדי לשכנע. מה בדיוק קרה?' } },
          { text: "I didn't started yet.", next: 'u3', quality: 'poor', feedback: { en: "After 'didn't' use the base form — and with 'yet' we prefer: 'I haven't started yet.'", he: "אחרי didn't בא הפועל בצורת המקור, ועם yet עדיף: I haven't started yet." } },
        ],
      },
      {
        id: 'u3',
        line: "Thanks for being honest. How much extra time do you think you'd need?",
        choices: [
          { text: 'Would it be possible to submit it by next Wednesday? That would give me five more days.', next: 'u4', quality: 'best', feedback: { en: "'Would it be possible to…?' + a specific, reasonable date.", he: 'Would it be possible to…? + תאריך מוגדר וסביר.' } },
          { text: 'Maybe one more month?', next: 'u4', quality: 'ok', feedback: { en: 'A month is unrealistic for one essay. Propose a specific, modest date.', he: 'חודש זה לא מציאותי לעבודה אחת. הציעו תאריך מוגדר וצנוע.' } },
          { text: 'As much as you can give me.', next: 'u4', quality: 'poor', feedback: { en: 'This shows no plan. Lecturers respond better to a concrete proposal.', he: 'זה מראה שאין תוכנית. מרצים מגיבים טוב יותר להצעה קונקרטית.' } },
        ],
      },
      {
        id: 'u4',
        line: 'Wednesday is fine, as long as you send me your outline by Friday. Does that sound fair?',
        choices: [
          { text: "Absolutely. I'll email you the outline by Friday afternoon. Thank you for understanding.", next: 'uend', quality: 'best', feedback: { en: "A clear commitment with 'will' and a gracious thank-you.", he: 'התחייבות ברורה עם will ותודה אדיבה.' } },
          { text: "That's fair. Should I attach the doctor's note to the email?", next: 'uend', quality: 'best', feedback: { en: 'Agreeing and asking a practical follow-up question.', he: 'הסכמה ושאלת המשך מעשית.' } },
          { text: 'Okay, if I remember.', next: 'uend', quality: 'poor', feedback: { en: 'This sounds unreliable right after receiving help.', he: 'זה נשמע לא אמין, דווקא אחרי שקיבלתם עזרה.' } },
        ],
      },
      { id: 'uend', line: 'Dr. Amari notes the new deadline in her calendar.', end: { en: 'You negotiated an extension politely and professionally.', he: 'ניהלתם משא ומתן על הארכה בנימוס ובמקצועיות.' } },
    ],
  },
  {
    id: 'rl-standup',
    title: 'Tech workplace: the daily stand-up',
    titleHe: 'סביבת הייטק: ישיבת הבוקר',
    level: 'C1',
    reviewStatus: 'ai-drafted',
    setting: 'A software team’s morning stand-up meeting (video call)',
    character: { name: 'Tamar', role: 'Engineering lead' },
    start: 't1',
    nodes: [
      {
        id: 't1',
        line: "Morning, everyone. Let's go round: what did you work on yesterday, and is anything blocking you?",
        choices: [
          { text: "Yesterday I finished refactoring the login page. Today I'm writing the tests, and I'm blocked on access to the staging server.", next: 't2', quality: 'best', feedback: { en: 'Yesterday / today / blocker — the ideal stand-up structure, short and specific.', he: 'אתמול / היום / חסם — המבנה האידיאלי לסטנד-אפ, קצר וספציפי.' } },
          { text: 'I worked on some stuff. Everything is fine.', next: 't2', quality: 'ok', feedback: { en: 'Too vague for a stand-up: the team needs to know what changed.', he: 'כללי מדי לסטנד-אפ: הצוות צריך לדעת מה השתנה.' } },
          { text: 'Yesterday I have finished the refactor.', next: 't2', quality: 'poor', feedback: { en: "With a finished time like 'yesterday', use the past simple: 'Yesterday I finished…'", he: "עם זמן סגור כמו yesterday משתמשים ב-Past Simple: Yesterday I finished…" } },
        ],
      },
      {
        id: 't2',
        line: 'Thanks. About the staging access — who can help with that?',
        choices: [
          { text: 'I think Omer has admin rights. Omer, would you mind giving me access after the meeting?', next: 't3', quality: 'best', feedback: { en: "'Would you mind + -ing' is a polite, natural request at work.", he: 'Would you mind + ing היא בקשה מנומסת וטבעית בעבודה.' } },
          { text: 'Omer, give me access.', next: 't3', quality: 'ok', feedback: { en: 'Clear, but an imperative can sound bossy in front of the team.', he: 'ברור, אבל ציווי עלול להישמע שתלטני מול הצוות.' } },
          { text: 'Would you mind to give me access?', next: 't3', quality: 'poor', feedback: { en: "'Mind' is followed by -ing: 'Would you mind giving me access?'", he: 'אחרי mind בא ing: Would you mind giving me access?' } },
        ],
      },
      {
        id: 't3',
        line: 'Also, Omer commented on your pull request that the new function is too complex. How would you like to handle that?',
        choices: [
          { text: "That's a fair point. I'll split it into two smaller functions, although I'd like to keep the caching as it is, since it cuts load time by about 30%.", next: 't4', quality: 'best', feedback: { en: 'You concede, propose a fix and defend one decision with evidence — a mature response.', he: 'אתם מודים, מציעים תיקון ומגנים על החלטה אחת עם נתונים — תגובה בוגרת.' } },
          { text: "I'll change everything he said.", next: 't4', quality: 'ok', feedback: { en: 'Cooperative, but you can also explain your reasoning where you disagree.', he: 'משתף פעולה, אבל אפשר גם להסביר את השיקולים שלכם היכן שאתם לא מסכימים.' } },
          { text: "He's wrong. My code is fine.", next: 't4', quality: 'poor', feedback: { en: 'Sounds defensive. Acknowledge the feedback first, then give reasons.', he: 'נשמע מתגונן. קודם הכירו במשוב, ואז תנו נימוקים.' } },
        ],
      },
      {
        id: 't4',
        line: 'Sounds reasonable. Can you have the changes ready for review by tomorrow?',
        choices: [
          { text: "Provided I get access this morning, yes — I'll update the pull request by the end of the day.", next: 'tend', quality: 'best', feedback: { en: "'Provided (that)…' states a condition precisely; then a clear commitment.", he: 'Provided (that)… מציין תנאי במדויק, ואחריו התחייבות ברורה.' } },
          { text: "I'll try, but I can't promise anything.", next: 'tend', quality: 'ok', feedback: { en: 'Honest, but say what the outcome depends on and give a time.', he: 'כן, אבל אמרו במה זה תלוי ותנו זמן.' } },
          { text: 'If I will get access, I finish tomorrow.', next: 'tend', quality: 'poor', feedback: { en: "First conditional: 'If I get access, I'll finish tomorrow.'", he: "תנאי מסוג ראשון: If I get access, I'll finish tomorrow." } },
        ],
      },
      { id: 'tend', line: 'Tamar moves on to the next person. Omer sends you the access link.', end: { en: 'You gave a clear update, asked for help and handled feedback professionally.', he: 'נתתם עדכון ברור, ביקשתם עזרה והתמודדתם עם משוב במקצועיות.' } },
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
  {
    id: 'case-wrong-cake',
    title: 'The Wrong Cake',
    titleHe: 'העוגה הלא נכונה',
    level: 'A2',
    briefing: "On Friday, a birthday cake with the words 'Happy Birthday Noa' went to the wrong customer. Noa's party was at 5 pm and her cake was missing! Read the evidence and find out who made the mistake.",
    briefingHe: "ביום שישי עוגת יום הולדת עם הכיתוב 'Happy Birthday Noa' נמסרה ללקוח הלא נכון. המסיבה של נועה הייתה ב-5 והעוגה שלה נעלמה! קראו את הראיות וגלו מי טעה.",
    suspects: [
      { id: 'tom', name: 'Tom', role: 'New shop assistant' },
      { id: 'mrs-gold', name: 'Mrs. Gold', role: 'Bakery owner' },
      { id: 'dan', name: 'Dan', role: 'Delivery driver' },
    ],
    evidence: [
      { id: 'wc-order-214', kind: 'document', title: 'Order slip 214', body: 'Order 214 — Name: Noa Levi\nChocolate cake with the words "Happy Birthday Noa"\nPick-up: Friday, 4 pm' },
      { id: 'wc-order-241', kind: 'document', title: 'Order slip 241', body: 'Order 241 — Name: Noam Lev\nChocolate cake, no writing\nDelivery: Friday, 3 pm, to 12 Rose Street' },
      { id: 'wc-gold-msg', kind: 'message', title: "Mrs. Gold's message (Friday 1:00 pm)", from: 'Mrs. Gold', body: "Tom, I'm at the bank until 3. Please pack the delivery orders for Dan. Thanks!" },
      { id: 'wc-tom', kind: 'statement', title: "Tom's statement", from: 'Tom', body: 'I packed the cake for order 241 at 2:30. I was in a hurry, so I only looked at the number quickly.' },
      { id: 'wc-dan', kind: 'statement', title: "Dan's statement", from: 'Dan', body: 'I took the box that was ready at 2:45 and delivered it at 3:00. The customer said, "There is writing on my cake," but he kept it.' },
      { id: 'wc-notice', kind: 'notice', title: 'Notice in the kitchen', body: 'ALWAYS read the full name AND the order number before you pack a cake! — Mrs. Gold' },
    ],
    questions: [
      { id: 'wq1', prompt: 'Why is it easy to mix up the two orders?', options: ['Both cakes are for delivery.', 'The numbers and the names look very similar.', 'Both cakes have writing on them.'], answer: 1, explanation: { en: '214 and 241 have the same digits, and "Noa Levi" and "Noam Lev" look almost the same.', he: 'ל-214 ול-241 יש אותן ספרות, ו-Noa Levi ו-Noam Lev נראים כמעט אותו דבר.' }, evidenceIds: ['wc-order-214', 'wc-order-241'] },
      { id: 'wq2', prompt: 'Why did Mrs. Gold not pack the delivery orders herself?', options: ['She was at the party.', 'She was driving the van.', 'She was at the bank until 3 pm.'], answer: 2, explanation: { en: "Her message says: 'I'm at the bank until 3.'", he: "בהודעה שלה כתוב: 'I'm at the bank until 3' — היא הייתה בבנק עד 3." }, evidenceIds: ['wc-gold-msg'] },
      { id: 'wq3', prompt: 'Which cake did Dan deliver at 3:00?', options: ['The cake with "Happy Birthday Noa" on it.', 'A cake with no writing.', 'No cake at all.'], answer: 0, explanation: { en: 'The customer said there was writing on his cake — but order 241 had no writing.', he: 'הלקוח אמר שיש כיתוב על העוגה — אבל בהזמנה 241 לא היה כיתוב.' }, evidenceIds: ['wc-dan', 'wc-order-241'] },
      { id: 'wq4', prompt: 'Which rule from the notice did someone forget?', options: ['Deliver all cakes before 3 pm.', 'Read the full name and the order number before packing.', 'Never put writing on chocolate cakes.'], answer: 1, explanation: { en: "Tom says he 'only looked at the number quickly' — he did not read the full name.", he: "תום אומר שהוא 'רק הסתכל על המספר מהר' — הוא לא קרא את השם המלא." }, evidenceIds: ['wc-notice', 'wc-tom'] },
    ],
    culpritId: 'tom',
    solution: {
      en: "It was an honest mistake. Tom was in a hurry and packed order 214 instead of 241, because the numbers and names look alike. Dan delivered the box he was given. Mrs. Gold quickly baked a new cake, and Noa got it just in time for her party. Now Tom always reads the full name — out loud!",
      he: 'זו הייתה טעות תמימה. תום מיהר וארז את הזמנה 214 במקום 241, כי המספרים והשמות דומים. דן מסר את הקופסה שקיבל. גברת גולד אפתה במהירות עוגה חדשה, ונועה קיבלה אותה בדיוק בזמן למסיבה. מאז תום תמיד קורא את השם המלא — בקול!',
    },
  },
];
