/** Original reading passages (written for Lingua Legends) and their comprehension items. */
import type { ContentItemInput, ReadingPassageInput } from '@lingua/shared';
import { q } from './helpers';

const READ = ['practice', 'bagrut', 'adventure', 'english-detective'] as const;

export const PASSAGES: ReadingPassageInput[] = [
  {
    id: 'p-night-market',
    version: 1,
    level: 'A2',
    title: 'The Night Market',
    genre: 'story',
    source: 'original',
    reviewStatus: 'ai-drafted',
    paragraphs: [
      'Every Thursday evening, the empty car park behind Lior\'s building turns into a night market. By seven o\'clock, there are thirty stalls with lights, music and the smell of fresh bread.',
      'Lior\'s grandmother sells honey cakes at the market. She bakes them in the afternoon, so the kitchen is always warm and sweet on Thursdays. Lior helps her carry the boxes, and she pays him with the last cake of the night.',
      'Last week it rained hard, and only five sellers came. Lior thought his grandmother would stay at home, but she put a plastic sheet over her table and sold every cake. "People still want something sweet when the weather is bad," she said, smiling.',
    ],
    glossary: [
      { term: 'stall', he: 'דוכן' },
      { term: 'car park', he: 'חניון' },
    ],
    bagrut: [],
  },
  {
    id: 'p-why-we-forget',
    version: 1,
    level: 'B1',
    title: 'Why We Forget — and How to Remember',
    genre: 'article',
    source: 'original',
    reviewStatus: 'ai-drafted',
    paragraphs: [
      'Most of us have had this experience: you learn twenty new words on Sunday, feel confident on Monday, and by Friday you can remember only five. This is not a sign that you are a bad student. Forgetting is a normal part of how memory works.',
      'Researchers have found that we forget new information quickly at first and then more slowly. However, each time we successfully recall something, the memory becomes stronger and lasts longer. This is why reviewing a word a few days after you learn it is more useful than reading it ten times on the same evening.',
      'Another helpful method is to test yourself instead of simply rereading. When you try to remember an answer before you look at it, your brain works harder, and that effort helps the information stay. Mixing different topics in one session can also help, even though it may feel more difficult at the time.',
    ],
    glossary: [
      { term: 'recall', he: 'לשלוף מהזיכרון, להיזכר' },
      { term: 'effort', he: 'מאמץ' },
    ],
    bagrut: ['module-e'],
  },
  {
    id: 'p-library-open',
    version: 1,
    level: 'B2',
    title: 'The Library That Refused to Close',
    genre: 'report',
    source: 'original',
    reviewStatus: 'ai-drafted',
    paragraphs: [
      'When the town council of Givat Ashkelon announced in 2023 that its small public library would close to save money, few people expected a protest. The building was old, the shelves were half empty, and the number of visitors had been falling for a decade.',
      'Yet within a week, more than four hundred residents had signed a petition. Many of them were not regular readers. Parents explained that the library was the only quiet place where their children could do homework. Elderly residents said it was where they met friends. A group of teenagers pointed out that it offered the only free Wi-Fi in the neighbourhood.',
      'Faced with this response, the council agreed to a compromise: the library would stay open, but volunteers would run it three days a week. Two years later, visitor numbers have doubled. The head volunteer, a retired teacher, says the lesson is simple: "A library is not only about books. It is about having a place that belongs to everyone."',
      'Not everyone is convinced. Some council members argue that relying on volunteers is not a long-term solution, and that the library may face the same problem again when the volunteers grow tired.',
    ],
    glossary: [
      { term: 'council', he: 'מועצה' },
      { term: 'petition', he: 'עצומה' },
      { term: 'compromise', he: 'פשרה' },
    ],
    bagrut: ['module-e'],
  },
  {
    id: 'p-cost-of-convenience',
    version: 1,
    level: 'C1',
    title: 'The Hidden Cost of Convenience',
    genre: 'opinion',
    source: 'original',
    reviewStatus: 'ai-drafted',
    paragraphs: [
      'Few inventions of the past two decades have been embraced as enthusiastically as the delivery app. With a few taps, dinner, groceries or a new phone charger appear at the door, often within the hour. It is easy to see why: convenience saves time, and time is the one resource nobody can buy more of.',
      'Yet convenience is rarely free; its costs are simply moved elsewhere. The rider cycling through traffic in the rain is typically paid per delivery rather than per hour, which means that a slow evening may earn him less than the minimum wage. Meanwhile, the small restaurant whose food he carries may pay a commission of up to a third of the order value — a sum that, for many, wipes out their profit entirely.',
      'Defenders of the apps argue that they have created flexible work for thousands and opened new markets for businesses that could never have afforded their own delivery staff. These points deserve to be taken seriously. Flexibility matters, particularly to students and parents who cannot commit to fixed hours.',
      'The question, then, is not whether the apps should exist, but who should carry the costs of the convenience they provide. At present, the answer seems to be: everyone except the customer. A modest delivery fee that reflected the true cost might be less convenient, but it would be considerably more honest.',
    ],
    glossary: [
      { term: 'commission', he: 'עמלה' },
      { term: 'embrace', he: 'לאמץ בהתלהבות' },
    ],
    bagrut: ['module-g'],
  },
];

export const READING_ITEMS: ContentItemInput[] = [
  // The Night Market (A2)
  q({ id: 'rd-nm-when', level: 'A2', cat: 'reading-inference', skill: 'reading', d: 1, passageId: 'p-night-market', modes: [...READ], p: 'When does the night market take place?', ans: 'Every Thursday evening', wrong: ['Every weekend', 'Only when it rains', 'Every morning'], en: "Paragraph 1: 'Every Thursday evening...'", he: 'פסקה 1: Every Thursday evening.' }),
  q({ id: 'rd-nm-pay', level: 'A2', cat: 'reading-inference', skill: 'reading', d: 2, passageId: 'p-night-market', modes: [...READ], p: 'How does Lior get paid for his help?', ans: 'He gets the last cake of the night.', wrong: ['He gets money from the sellers.', 'He gets free bread.', "He doesn't get anything."], en: "Paragraph 2: 'she pays him with the last cake of the night.'", he: 'פסקה 2: היא "משלמת" לו בעוגה האחרונה של הערב.' }),
  q({ id: 'rd-nm-surprise', level: 'A2', cat: 'reading-inference', skill: 'inference', d: 3, passageId: 'p-night-market', modes: [...READ], p: 'Why was Lior surprised last week?', ans: 'His grandmother went to the market in the rain and sold everything.', wrong: ['The market had thirty new stalls.', 'His grandmother stopped baking cakes.', 'Nobody wanted to buy honey cakes.'], en: 'Lior thought she would stay at home because of the rain, but she went and sold every cake.', he: 'ליאור חשב שהיא תישאר בבית בגלל הגשם, אבל היא יצאה ומכרה את כל העוגות.' }),
  // Why We Forget (B1)
  q({ id: 'rd-wf-main', level: 'B1', cat: 'reading-inference', skill: 'reading', d: 2, passageId: 'p-why-we-forget', modes: [...READ], bagrut: ['module-e'], p: 'What is the main idea of the article?', ans: 'Forgetting is normal, and some study methods help us remember longer.', wrong: ['Good students never forget new words.', 'Learning twenty words a week is too many.', 'Rereading is the best way to study.'], en: 'The article explains that forgetting is normal (paragraph 1) and then describes methods that help (paragraphs 2–3).', he: 'המאמר מסביר ששכחה היא דבר נורמלי (פסקה 1) ומתאר שיטות שעוזרות לזכור (פסקאות 2–3).' }),
  q({ id: 'rd-wf-review', level: 'B1', cat: 'reading-inference', skill: 'reading', d: 3, passageId: 'p-why-we-forget', modes: [...READ], bagrut: ['module-e'], p: 'According to paragraph 2, why is reviewing a word a few days later useful?', ans: 'Each successful recall makes the memory stronger.', wrong: ['Our brain rests during those days.', 'We forget slowly at first.', 'Reading ten times is not allowed.'], en: "'Each time we successfully recall something, the memory becomes stronger and lasts longer.'", he: 'בכל פעם שאנחנו נזכרים בהצלחה, הזיכרון מתחזק ונשמר זמן רב יותר.' }),
  q({ id: 'rd-wf-mixing', level: 'B1', cat: 'reading-inference', skill: 'inference', d: 4, passageId: 'p-why-we-forget', modes: [...READ], bagrut: ['module-e'], p: "What does the writer suggest about mixing topics 'even though it may feel more difficult'?", ans: 'A method can be effective even if it does not feel easy.', wrong: ['Difficult methods should be avoided.', 'Mixing topics only works for good students.', 'Students should study one topic at a time.'], en: "The phrase 'even though' shows a contrast: it feels harder, but it can still help.", he: 'הביטוי even though מבטא ניגוד: זה מרגיש קשה יותר, אבל זה עדיין עוזר.' }),
  // The Library (B2, Module E style)
  q({ id: 'rd-lib-expected', level: 'B2', cat: 'reading-inference', skill: 'inference', d: 3, passageId: 'p-library-open', modes: [...READ], bagrut: ['module-e'], p: 'Why did few people expect a protest?', ans: 'The library seemed unpopular and in poor condition.', wrong: ['The council had already found a solution.', 'Most residents did not know about the library.', 'Protests are not allowed in the town.'], en: 'Paragraph 1 describes an old building, half-empty shelves and falling visitor numbers.', he: 'פסקה 1 מתארת בניין ישן, מדפים חצי ריקים ומספר מבקרים יורד.' }),
  q({ id: 'rd-lib-signed', level: 'B2', cat: 'reading-inference', skill: 'reading', d: 3, passageId: 'p-library-open', modes: [...READ], bagrut: ['module-e'], p: "What point does paragraph 2 make about the people who signed the petition?", ans: 'They valued the library for reasons other than borrowing books.', wrong: ['They were all regular readers.', 'They wanted the council to build a new library.', 'They were mostly teachers.'], en: 'Homework space, meeting friends and free Wi-Fi are all reasons not connected to books.', he: 'מקום להכנת שיעורים, מפגש עם חברים ו-Wi-Fi חינם — כולן סיבות שאינן קשורות לספרים.' }),
  q({ id: 'rd-lib-compromise', level: 'B2', cat: 'contextual-vocabulary', skill: 'vocabulary', also: ['reading'], d: 3, passageId: 'p-library-open', modes: [...READ], bagrut: ['module-e'], p: "In paragraph 3, the word 'compromise' refers to ___.", ans: 'an arrangement where each side gets part of what it wants', wrong: ['a complete victory for the residents', 'a decision to close the library', 'a payment to the volunteers'], en: 'The library stays open (residents) but is run by volunteers (saving the council money).', he: 'הספרייה נשארת פתוחה (התושבים) אבל מופעלת על ידי מתנדבים (חיסכון למועצה).', v: ['compromise'] }),
  q({ id: 'rd-lib-quote', level: 'B2', cat: 'reading-inference', skill: 'inference', d: 4, passageId: 'p-library-open', modes: [...READ], bagrut: ['module-e'], p: "What does the head volunteer mean by 'a place that belongs to everyone'?", ans: 'A free public space that serves the whole community', wrong: ['A building that residents own legally', 'A library with books in every language', 'A place where only volunteers can work'], en: 'The examples in paragraph 2 show the library as a shared community space.', he: 'הדוגמאות בפסקה 2 מציגות את הספרייה כמרחב קהילתי משותף.' }),
  q({ id: 'rd-lib-doubt', level: 'B2', cat: 'reading-inference', skill: 'inference', d: 4, passageId: 'p-library-open', modes: [...READ], bagrut: ['module-e'], p: 'Why does the writer include the final paragraph?', ans: 'To show that the solution may not last', wrong: ['To prove that the volunteers are tired', 'To explain why visitors doubled', 'To criticise the residents'], en: "The last paragraph presents a different view: relying on volunteers may not be a long-term solution.", he: 'הפסקה האחרונה מציגה עמדה אחרת: ההסתמכות על מתנדבים אולי אינה פתרון לטווח ארוך.' }),
  // The Hidden Cost of Convenience (C1, Module G style)
  q({ id: 'rd-cc-elsewhere', level: 'C1', cat: 'reading-inference', skill: 'inference', d: 3, passageId: 'p-cost-of-convenience', modes: [...READ], bagrut: ['module-g'], p: "What does the writer mean by 'its costs are simply moved elsewhere'?", ans: 'Other people pay the price of the convenience.', wrong: ['Delivery apps are cheaper in other countries.', 'Customers pay more than they realise.', 'The apps will soon disappear.'], en: 'Paragraph 2 shows riders and restaurants carrying the costs.', he: 'פסקה 2 מראה שהשליחים והמסעדות נושאים בעלויות.' }),
  q({ id: 'rd-cc-defenders', level: 'C1', cat: 'reading-inference', skill: 'reading', also: ['inference'], d: 4, passageId: 'p-cost-of-convenience', modes: [...READ], bagrut: ['module-g'], p: "How does the writer treat the defenders' arguments in paragraph 3?", ans: 'Acknowledges them as valid before continuing the argument', wrong: ['Rejects them as completely false', 'Ignores them entirely', 'Accepts them as the final conclusion'], en: "'These points deserve to be taken seriously' — the writer concedes before returning to the main claim.", he: 'These points deserve to be taken seriously — הכותב מודה בטיעוני הנגד לפני שהוא חוזר לטענתו.' }),
  q({ id: 'rd-cc-position', level: 'C1', cat: 'reading-inference', skill: 'reading', also: ['inference'], d: 4, passageId: 'p-cost-of-convenience', modes: [...READ], bagrut: ['module-g'], p: "Which statement best summarises the writer's position?", ans: 'Delivery should cost customers more, to reflect its real cost.', wrong: ['Delivery apps should be banned.', 'Riders should work fixed hours.', 'Restaurants should stop using delivery apps.'], en: "The conclusion: 'A modest delivery fee that reflected the true cost... would be considerably more honest.'", he: 'המסקנה: דמי משלוח שמשקפים את העלות האמיתית יהיו הוגנים יותר.' }),
  q({ id: 'rd-cc-tone', level: 'C1', cat: 'reading-inference', skill: 'inference', d: 5, passageId: 'p-cost-of-convenience', modes: [...READ], bagrut: ['module-g'], p: "The phrase 'everyone except the customer' is used to ___.", ans: 'highlight an unfair distribution of costs', wrong: ['praise customers for their choices', 'show that customers pay too much', 'suggest that the apps are dishonest'], en: 'It emphasises, with some irony, that the people who benefit most pay the least.', he: 'הביטוי מדגיש, באירוניה מסוימת, שמי שנהנה הכי הרבה משלם הכי מעט.' }),
];
