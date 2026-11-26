/**
 * Bagrut Academy — independent preparation material for Israeli 5-unit English.
 *
 * NOT an official Ministry of Education product. The exam structure below is a
 * configurable DRAFT. It has NOT yet been verified against the official 2025
 * specification booklet (the booklet could not be fetched from the development
 * environment). See docs/BAGRUT.md before claiming alignment with any exam year.
 */
import type { ContentItemInput, ReadingPassageInput } from '@lingua/shared';
import { q } from './helpers';

export const BAGRUT_OFFICIAL_REFERENCE =
  'https://meyda.education.gov.il/files/pop/0files/english/Chativa-Elyona/Bagrut/updates/5pointsbooklet2025.pdf';

export type BagrutComponentId = 'module-e' | 'module-f' | 'module-g' | 'cobe' | 'project';

export interface BagrutComponent {
  id: BagrutComponentId;
  name: string;
  nameHe: string;
  focus: string[];
  focusHe: string[];
  passageIds: string[];
  itemTags: string[];
  taskIds: string[];
}

export interface CurriculumConfig {
  id: string;
  label: string;
  /** Set to 'verified' only after a human checks it against the official booklet. */
  verification: 'unverified-draft' | 'verified';
  verifiedAgainst: string | null;
  components: BagrutComponent[];
}

export const BAGRUT_CURRICULUM: CurriculumConfig = {
  id: 'il-5-unit-draft-1',
  label: 'Israeli 5-unit English — preparation draft',
  verification: 'unverified-draft',
  verifiedAgainst: null,
  components: [
    {
      id: 'module-e',
      name: 'Module E',
      nameHe: 'מודול E',
      focus: ['Reading comprehension', 'Vocabulary in context', 'Text analysis', 'Unseen passages'],
      focusHe: ['הבנת הנקרא', 'אוצר מילים בהקשר', 'ניתוח טקסט', 'קטעים בלתי מוכרים'],
      passageIds: ['p-why-we-forget', 'p-library-open'],
      itemTags: ['module-e'],
      taskIds: ['e-open-library-1', 'e-open-library-2'],
    },
    {
      id: 'module-f',
      name: 'Module F — Literature',
      nameHe: 'מודול F — ספרות',
      focus: ['Literary analysis', 'Poems', 'Short stories', 'Themes and characters', 'Higher-order thinking'],
      focusHe: ['ניתוח ספרותי', 'שירה', 'סיפורים קצרים', 'נושאים ודמויות', 'חשיבה מסדר גבוה'],
      passageIds: ['lit-lanterns', 'lit-last-ferry'],
      itemTags: ['module-f'],
      taskIds: ['f-lanterns-hots', 'f-ferry-character', 'f-ferry-bridging'],
    },
    {
      id: 'module-g',
      name: 'Module G',
      nameHe: 'מודול G',
      focus: ['Advanced reading', 'Advanced vocabulary', 'Written production', 'Argumentative and opinion writing'],
      focusHe: ['קריאה מתקדמת', 'אוצר מילים מתקדם', 'הבעה בכתב', 'כתיבת טיעון ודעה'],
      passageIds: ['p-cost-of-convenience'],
      itemTags: ['module-g', 'module-g-writing'],
      taskIds: ['g-writing-convenience', 'g-writing-phones', 'g-paragraph-structure'],
    },
    {
      id: 'cobe',
      name: 'COBE — Oral English',
      nameHe: 'COBE — בחינה בעל פה',
      focus: ['Spontaneous speaking', 'Personal responses', 'Project presentation', 'Response to audiovisual material'],
      focusHe: ['דיבור ספונטני', 'תגובה אישית', 'הצגת פרויקט', 'תגובה לחומר אודיו-ויזואלי'],
      passageIds: [],
      itemTags: [],
      taskIds: ['cobe-personal-1', 'cobe-personal-2', 'cobe-spontaneous-1', 'cobe-spontaneous-2', 'cobe-project-1', 'cobe-av-1'],
    },
    {
      id: 'project',
      name: 'Project & Bridging Project',
      nameHe: 'פרויקט ופרויקט גישור',
      focus: ['Planning a project', 'Research skills', 'Presenting findings'],
      focusHe: ['תכנון פרויקט', 'מיומנויות מחקר', 'הצגת ממצאים'],
      passageIds: [],
      itemTags: [],
      taskIds: ['project-plan-1'],
    },
  ],
};

export type OpenTaskKind = 'open-question' | 'writing' | 'literary-analysis' | 'speaking' | 'planning';

export interface OpenTask {
  id: string;
  component: BagrutComponentId;
  kind: OpenTaskKind;
  level: 'B1' | 'B2' | 'C1';
  title: string;
  prompt: string;
  promptHe: string;
  passageId?: string;
  /** Example of a strong answer, for self-comparison. Not an official model answer. */
  modelAnswer?: string;
  /** Self-assessment checklist. Not a grade. */
  checklist: { en: string; he: string }[];
  wordRange?: [number, number];
  prepSeconds?: number;
  speakSeconds?: number;
  /** COBE audiovisual: a script read aloud with the browser's text-to-speech. */
  listeningScript?: string;
  guidingQuestions?: string[];
}

const WRITING_CHECKLIST = [
  { en: 'My opening states my position clearly.', he: 'הפתיחה מציגה את עמדתי בבירור.' },
  { en: 'Each body paragraph has one main idea and supporting examples.', he: 'בכל פסקת גוף יש רעיון מרכזי אחד ודוגמאות תומכות.' },
  { en: 'I responded to at least one counterargument.', he: 'התייחסתי לפחות לטיעון נגד אחד.' },
  { en: 'I used connectors (however, therefore, although, moreover).', he: 'השתמשתי במילות קישור (however, therefore, although, moreover).' },
  { en: 'My conclusion summarises without repeating word for word.', he: 'הסיכום מסכם בלי לחזור מילה במילה.' },
  { en: 'I checked verb tenses, subject–verb agreement and spelling.', he: 'בדקתי זמנים, התאמה בין נושא לנשוא ואיות.' },
];

const SPEAKING_CHECKLIST = [
  { en: 'I answered the question directly before adding details.', he: 'עניתי ישירות על השאלה לפני שהוספתי פרטים.' },
  { en: 'I gave a reason and a personal example.', he: 'נתתי סיבה ודוגמה אישית.' },
  { en: 'I kept talking for the full time without long pauses.', he: 'דיברתי לאורך כל הזמן בלי הפסקות ארוכות.' },
  { en: 'I used at least two linking phrases (first of all, on the other hand, in my opinion).', he: 'השתמשתי לפחות בשני ביטויי קישור.' },
];

export const LITERARY_TEXTS: ReadingPassageInput[] = [
  {
    id: 'lit-lanterns',
    version: 1,
    level: 'B2',
    title: 'Lanterns (an original poem)',
    genre: 'poem',
    source: 'original',
    reviewStatus: 'ai-drafted',
    bagrut: ['module-f'],
    glossary: [
      { term: 'flicker', he: 'להבהב' },
      { term: 'harbour', he: 'נמל' },
    ],
    paragraphs: [
      'My father hung a lantern by the door / each night he worked the late shift at the harbour, / "so you will know," he said, "that I am coming home."',
      'I was too young to understand that light / was not for me but for the dark road back — / a promise he made to himself, out loud.',
      'Now the harbour is a car park and a mall. / I keep a lamp beside my own front door. / My son asks why. I tell him: so you know.',
    ],
  },
  {
    id: 'lit-last-ferry',
    version: 1,
    level: 'B2',
    title: 'The Last Ferry (an original short story)',
    genre: 'story',
    source: 'original',
    reviewStatus: 'ai-drafted',
    bagrut: ['module-f'],
    glossary: [
      { term: 'ferry', he: 'מעבורת' },
      { term: 'deck', he: 'סיפון' },
    ],
    paragraphs: [
      'Noa had missed the last ferry twice that month, and both times she had blamed the buses. Tonight she ran the whole way from the bookshop, her bag hitting her back with every step, and arrived just as the ramp began to rise.',
      '"You\'re lucky," said the old sailor at the gate, lowering it again. He had worked on the ferry for thirty years and knew every regular passenger by face. "Most people only get lucky once."',
      'On the deck, Noa took out the book she had been too embarrassed to buy in daylight — a guide to applying for art school. Her parents wanted her to study law, like her sister. She had not told anyone, not even herself, that she had already filled in the form.',
      'Halfway across, the sailor sat down beside her. He glanced at the cover and said nothing for a long time. Then: "I wanted to be a painter, you know. I kept waiting for the right moment." He smiled at the black water. "The ferry doesn\'t wait. That\'s the only thing I\'ve learned."',
      'When they reached the other side, Noa did not go home. She walked to the post office, which was closed, and stood outside it with the envelope in her hand until the sun came up.',
    ],
  },
];

export const BAGRUT_ITEMS: ContentItemInput[] = [
  q({ id: 'bg-f-lanterns-symbol', level: 'B2', cat: 'reading-inference', skill: 'reading', also: ['inference'], d: 4, passageId: 'lit-lanterns', modes: ['bagrut', 'practice'], bagrut: ['module-f'], p: 'In the poem, what does the lantern most likely symbolise?', ans: 'A promise of return and the care a parent shows', wrong: ['The danger of working at night', 'The modernisation of the harbour', 'The father\'s fear of the dark'], en: "The father explains the light as a sign he is coming home; the speaker later repeats the gesture for his own son.", he: 'האב מסביר שהאור הוא סימן לכך שהוא חוזר הביתה; הדובר חוזר על המחווה עבור בנו.' }),
  q({ id: 'bg-f-lanterns-change', level: 'B2', cat: 'reading-inference', skill: 'inference', d: 4, passageId: 'lit-lanterns', modes: ['bagrut', 'practice'], bagrut: ['module-f'], p: "How has the speaker's understanding changed by the last stanza?", ans: 'He now understands the lantern from a parent\'s point of view.', wrong: ['He has forgotten why his father hung the lantern.', 'He thinks the lantern was unnecessary.', 'He wants to work at the harbour.'], en: "As a child he 'was too young to understand'; as a father he repeats the words 'so you know'.", he: 'כילד הוא "היה צעיר מכדי להבין"; כאב הוא חוזר על המילים so you know.' }),
  q({ id: 'bg-f-ferry-sailor', level: 'B2', cat: 'reading-inference', skill: 'inference', d: 4, passageId: 'lit-last-ferry', modes: ['bagrut', 'practice'], bagrut: ['module-f'], p: "What is the main purpose of the sailor's story about wanting to be a painter?", ans: 'To encourage Noa not to wait for the "right moment"', wrong: ['To explain why he works on the ferry', 'To criticise Noa for being late', 'To show that painting is a bad career'], en: "His regret ('I kept waiting for the right moment') and the line 'The ferry doesn't wait' connect directly to Noa's hidden decision.", he: 'החרטה שלו והמשפט The ferry doesn\'t wait מתחברים ישירות להחלטה הסודית של נועה.' }),
  q({ id: 'bg-f-ferry-ending', level: 'B2', cat: 'reading-inference', skill: 'inference', d: 5, passageId: 'lit-last-ferry', modes: ['bagrut', 'practice'], bagrut: ['module-f'], p: 'What does the ending suggest about Noa?', ans: 'She has decided to send her application.', wrong: ['She has decided to study law.', 'She is afraid to go home.', 'She wants to work on the ferry.'], en: 'Waiting outside the post office all night with the envelope shows determination to send it as soon as possible.', he: 'ההמתנה כל הלילה מחוץ לדואר עם המעטפה מראה נחישות לשלוח אותה מוקדם ככל האפשר.' }),
  q({ id: 'bg-g-vocab-wipes-out', level: 'C1', cat: 'contextual-vocabulary', skill: 'vocabulary', d: 4, passageId: 'p-cost-of-convenience', modes: ['bagrut', 'practice'], bagrut: ['module-g'], p: "In paragraph 2, 'wipes out their profit' means the commission ___.", ans: 'removes all of their profit', wrong: ['doubles their profit', 'hides their profit from taxes', 'cleans their accounts'], en: "'Wipe out' = destroy or remove completely.", he: 'wipe out = למחוק, לחסל לגמרי.', v: ['wipe out'] }),
];

export const OPEN_TASKS: OpenTask[] = [
  {
    id: 'e-open-library-1',
    component: 'module-e',
    kind: 'open-question',
    level: 'B2',
    passageId: 'p-library-open',
    title: 'Open question — reasons for support',
    prompt: 'According to paragraph 2, give TWO reasons why residents wanted to keep the library open. Answer in your own words.',
    promptHe: 'לפי פסקה 2, תנו שתי סיבות לכך שהתושבים רצו להשאיר את הספרייה פתוחה. ענו במילים שלכם.',
    modelAnswer: 'Children needed a quiet place to do their homework, and older residents used it as a place to meet friends. (Free Wi-Fi for teenagers is also correct.)',
    checklist: [
      { en: 'I gave two different reasons.', he: 'נתתי שתי סיבות שונות.' },
      { en: 'Both reasons come from paragraph 2.', he: 'שתי הסיבות לקוחות מפסקה 2.' },
      { en: 'I used my own words instead of copying whole sentences.', he: 'כתבתי במילים שלי ולא העתקתי משפטים שלמים.' },
    ],
  },
  {
    id: 'e-open-library-2',
    component: 'module-e',
    kind: 'open-question',
    level: 'B2',
    passageId: 'p-library-open',
    title: 'Open question — evaluate the solution',
    prompt: 'Do you think the compromise described in the article is a good long-term solution? Explain, using ONE detail from the text.',
    promptHe: 'האם לדעתכם הפשרה המתוארת במאמר היא פתרון טוב לטווח ארוך? הסבירו, והשתמשו בפרט אחד מהטקסט.',
    modelAnswer: 'Partly. The doubled visitor numbers show the library is valuable, but, as some council members say, volunteers may grow tired, so the town should find stable funding.',
    checklist: [
      { en: 'I gave a clear opinion.', he: 'הבעתי דעה ברורה.' },
      { en: 'I supported it with a detail from the text.', he: 'תמכתי בה בפרט מהטקסט.' },
    ],
  },
  {
    id: 'f-lanterns-hots',
    component: 'module-f',
    kind: 'literary-analysis',
    level: 'B2',
    passageId: 'lit-lanterns',
    title: 'HOTS — Explaining patterns',
    prompt: "The words 'so you know' appear in the first and last stanzas. Explain how this repetition connects the father, the speaker and the son. Refer to the text.",
    promptHe: 'המילים so you know מופיעות בבית הראשון ובבית האחרון. הסבירו כיצד החזרה מחברת בין האב, הדובר והבן. התייחסו לטקסט.',
    modelAnswer: "The repetition shows that the speaker has inherited his father's way of showing love. As a child he did not understand the lantern, but now he uses the same words with his own son, so the gesture is passed from one generation to the next even though the harbour itself has disappeared.",
    checklist: [
      { en: 'I named the thinking skill (e.g. explaining patterns / making connections).', he: 'ציינתי את מיומנות החשיבה (למשל זיהוי דפוסים / יצירת קשרים).' },
      { en: 'I referred to specific lines.', he: 'התייחסתי לשורות ספציפיות.' },
      { en: 'I explained the meaning, not only described what happens.', he: 'הסברתי את המשמעות ולא רק תיארתי מה קורה.' },
    ],
    wordRange: [60, 120],
  },
  {
    id: 'f-ferry-character',
    component: 'module-f',
    kind: 'literary-analysis',
    level: 'B2',
    passageId: 'lit-last-ferry',
    title: 'Character analysis — Noa',
    prompt: 'How does Noa change from the beginning of the story to the end? Support your answer with TWO details from the text.',
    promptHe: 'כיצד נועה משתנה מתחילת הסיפור ועד סופו? תמכו בתשובתכם בשני פרטים מהטקסט.',
    modelAnswer: "At the beginning Noa avoids responsibility: she blames the buses and is 'too embarrassed' to buy the guide in daylight. By the end she acts on her decision, waiting all night outside the post office with the envelope, which shows new courage.",
    checklist: [
      { en: 'I described Noa at the beginning AND at the end.', he: 'תיארתי את נועה בהתחלה וגם בסוף.' },
      { en: 'I used two details as evidence.', he: 'השתמשתי בשני פרטים כראיות.' },
    ],
    wordRange: [60, 120],
  },
  {
    id: 'f-ferry-bridging',
    component: 'module-f',
    kind: 'literary-analysis',
    level: 'C1',
    passageId: 'lit-last-ferry',
    title: 'Bridging text — connect to your world',
    prompt: "The sailor says, 'The ferry doesn't wait.' Connect this idea to a decision people your age often delay. Explain the connection and give your opinion.",
    promptHe: 'הימאי אומר: The ferry doesn\'t wait. קשרו את הרעיון להחלטה שבני גילכם נוטים לדחות. הסבירו את הקשר והביעו את דעתכם.',
    checklist: [
      { en: 'I explained what the sentence means in the story.', he: 'הסברתי מה המשפט אומר בסיפור.' },
      { en: 'I made a clear connection to real life.', he: 'יצרתי קשר ברור לחיים האמיתיים.' },
      { en: 'I gave and supported a personal opinion.', he: 'הבעתי דעה אישית ונימקתי אותה.' },
    ],
    wordRange: [80, 140],
  },
  {
    id: 'g-writing-convenience',
    component: 'module-g',
    kind: 'writing',
    level: 'C1',
    passageId: 'p-cost-of-convenience',
    title: 'Argumentative essay — Who pays for convenience?',
    prompt: 'Should delivery apps be required to pay their riders a guaranteed hourly wage, even if this makes deliveries more expensive? Write an argumentative essay. State your position, support it, and respond to one counterargument.',
    promptHe: 'האם יש לחייב אפליקציות משלוחים לשלם לשליחים שכר שעתי מובטח, גם אם המשלוחים יתייקרו? כתבו חיבור טיעוני. הציגו עמדה, נמקו אותה והתייחסו לטיעון נגד אחד.',
    checklist: WRITING_CHECKLIST,
    wordRange: [140, 220],
  },
  {
    id: 'g-writing-phones',
    component: 'module-g',
    kind: 'writing',
    level: 'B2',
    title: 'Opinion essay — Phones in class',
    prompt: 'Your school is considering a complete ban on phones during the school day. Write an opinion piece for the school newspaper explaining whether you support the ban.',
    promptHe: 'בית הספר שוקל איסור מוחלט על טלפונים במהלך יום הלימודים. כתבו מאמר דעה לעיתון בית הספר והסבירו אם אתם תומכים באיסור.',
    checklist: WRITING_CHECKLIST,
    wordRange: [120, 180],
  },
  {
    id: 'g-paragraph-structure',
    component: 'module-g',
    kind: 'writing',
    level: 'B2',
    title: 'Paragraph builder',
    prompt: "Write ONE body paragraph that supports this claim: 'Learning a second language makes people more open-minded.' Include a topic sentence, an explanation, an example and a concluding sentence.",
    promptHe: 'כתבו פסקת גוף אחת שתומכת בטענה: לימוד שפה שנייה הופך אנשים לפתוחים יותר. כללו משפט נושא, הסבר, דוגמה ומשפט מסכם.',
    modelAnswer: "Learning a second language encourages people to see the world from more than one point of view. When learners discover that some ideas cannot be translated directly, they realise that their own language is only one way of describing reality. For example, a Hebrew speaker learning English must notice that 'you' can be singular or plural, which makes them think about how relationships are expressed. In this way, language study trains people to question their assumptions.",
    checklist: [
      { en: 'Topic sentence', he: 'משפט נושא' },
      { en: 'Explanation', he: 'הסבר' },
      { en: 'Specific example', he: 'דוגמה ספציפית' },
      { en: 'Concluding sentence', he: 'משפט מסכם' },
    ],
    wordRange: [70, 120],
  },
  {
    id: 'cobe-personal-1',
    component: 'cobe',
    kind: 'speaking',
    level: 'B1',
    title: 'Personal response — A person who inspires you',
    prompt: 'Talk about a person who has inspired you. Who are they, what did they do, and how did they change the way you think or act?',
    promptHe: 'דברו על אדם שהעניק לכם השראה. מי הוא, מה עשה, ואיך שינה את הדרך שבה אתם חושבים או פועלים?',
    guidingQuestions: ['How do you know this person?', 'What is one specific moment you remember?', 'What have you done differently because of them?'],
    checklist: SPEAKING_CHECKLIST,
    prepSeconds: 30,
    speakSeconds: 90,
  },
  {
    id: 'cobe-personal-2',
    component: 'cobe',
    kind: 'speaking',
    level: 'B1',
    title: 'Personal response — A challenge you overcame',
    prompt: 'Describe a challenge you faced and how you dealt with it. What did you learn?',
    promptHe: 'תארו אתגר שעמדתם בפניו ואיך התמודדתם איתו. מה למדתם?',
    guidingQuestions: ['What made it difficult?', 'Who or what helped you?', 'Would you do anything differently now?'],
    checklist: SPEAKING_CHECKLIST,
    prepSeconds: 30,
    speakSeconds: 90,
  },
  {
    id: 'cobe-spontaneous-1',
    component: 'cobe',
    kind: 'speaking',
    level: 'B2',
    title: 'Spontaneous — Should homework be optional?',
    prompt: 'Some people say homework should be optional for high-school students. What do you think? Give reasons and examples.',
    promptHe: 'יש הטוענים שבתיכון שיעורי בית צריכים להיות רשות. מה דעתכם? תנו סיבות ודוגמאות.',
    checklist: SPEAKING_CHECKLIST,
    prepSeconds: 15,
    speakSeconds: 75,
  },
  {
    id: 'cobe-spontaneous-2',
    component: 'cobe',
    kind: 'speaking',
    level: 'B2',
    title: 'Spontaneous — Technology and friendship',
    prompt: 'Has technology made friendships stronger or weaker? Explain your view.',
    promptHe: 'האם הטכנולוגיה חיזקה או החלישה חברויות? הסבירו את עמדתכם.',
    checklist: SPEAKING_CHECKLIST,
    prepSeconds: 15,
    speakSeconds: 75,
  },
  {
    id: 'cobe-project-1',
    component: 'cobe',
    kind: 'speaking',
    level: 'B2',
    title: 'Project presentation practice',
    prompt: 'Present your English project as if to an examiner: the topic, why you chose it, how you researched it, what you found, and what you would improve.',
    promptHe: 'הציגו את פרויקט האנגלית שלכם כאילו לבוחן: הנושא, למה בחרתם בו, איך חקרתם, מה מצאתם ומה הייתם משפרים.',
    guidingQuestions: ['Why is this topic important to you?', 'Which source was most useful, and why?', 'What surprised you?', 'What was the hardest part?'],
    checklist: [
      ...SPEAKING_CHECKLIST,
      { en: 'I described my research process, not only the topic.', he: 'תיארתי את תהליך המחקר ולא רק את הנושא.' },
    ],
    prepSeconds: 60,
    speakSeconds: 150,
  },
  {
    id: 'cobe-av-1',
    component: 'cobe',
    kind: 'speaking',
    level: 'B2',
    title: 'Respond to audio — The four-day school week',
    prompt: "Listen to the short news report (it is read aloud by your device's text-to-speech voice). Then summarise the main point and give your opinion.",
    promptHe: 'האזינו לדיווח החדשותי הקצר (מוקרא על ידי קול הקראה של המכשיר). לאחר מכן סכמו את הנקודה המרכזית והביעו את דעתכם.',
    listeningScript:
      'A small town in the north is testing a four-day school week. Students study for longer each day from Sunday to Wednesday, and Thursday is used for sports clubs, volunteering and catching up on work. Teachers say attendance has improved, but some parents worry about finding childcare on the free day. The town will decide next summer whether to continue.',
    checklist: [
      { en: 'I summarised the main point in one or two sentences.', he: 'סיכמתי את הנקודה המרכזית במשפט או שניים.' },
      { en: 'I mentioned at least one advantage and one concern from the report.', he: 'הזכרתי לפחות יתרון אחד וחשש אחד מהדיווח.' },
      ...SPEAKING_CHECKLIST.slice(0, 2),
    ],
    prepSeconds: 30,
    speakSeconds: 90,
  },
  {
    id: 'project-plan-1',
    component: 'project',
    kind: 'planning',
    level: 'B1',
    title: 'Project planner',
    prompt: 'Plan your project: write a research question, three sources you could use, and the product you will create (presentation, video, poster, article).',
    promptHe: 'תכננו את הפרויקט: כתבו שאלת מחקר, שלושה מקורות אפשריים, ואת התוצר שתיצרו (מצגת, סרטון, פוסטר, כתבה).',
    checklist: [
      { en: 'My research question is open (not yes/no).', he: 'שאלת המחקר פתוחה (לא כן/לא).' },
      { en: 'My sources are reliable and varied.', he: 'המקורות אמינים ומגוונים.' },
      { en: 'I chose a realistic product and timeline.', he: 'בחרתי תוצר ולוח זמנים מציאותיים.' },
    ],
  },
];

export interface MockExam {
  id: string;
  component: BagrutComponentId;
  title: string;
  titleHe: string;
  minutes: number;
  passageIds: string[];
  itemIds: string[];
  taskIds: string[];
}

/** Original practice exams. Durations are configurable and not claimed to match the official exam. */
export const MOCK_EXAMS: MockExam[] = [
  {
    id: 'mock-e-1',
    component: 'module-e',
    title: 'Module E practice exam 1',
    titleHe: 'מבחן תרגול מודול E מספר 1',
    minutes: 40,
    passageIds: ['p-library-open'],
    itemIds: ['rd-lib-expected', 'rd-lib-signed', 'rd-lib-compromise', 'rd-lib-quote', 'rd-lib-doubt'],
    taskIds: ['e-open-library-1', 'e-open-library-2'],
  },
  {
    id: 'mock-g-1',
    component: 'module-g',
    title: 'Module G practice exam 1',
    titleHe: 'מבחן תרגול מודול G מספר 1',
    minutes: 60,
    passageIds: ['p-cost-of-convenience'],
    itemIds: ['rd-cc-elsewhere', 'rd-cc-defenders', 'rd-cc-position', 'rd-cc-tone', 'bg-g-vocab-wipes-out'],
    taskIds: ['g-writing-convenience'],
  },
];
