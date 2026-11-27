/** Debate Arena practice topics (original). Positions are never scored — only how they are argued. */
import type { CefrLevel } from '@lingua/shared';

export interface DebateTopic {
  id: string;
  level: CefrLevel;
  motion: string;
  motionHe: string;
  /** The opposing argument shown after the player's opening, for each side the player picks. */
  opposition: { for: string; against: string };
  phrases: string[];
  openingWords: [number, number];
  rebuttalWords: [number, number];
  /** The opponent's prepared closing remarks (shown before the player's closing). */
  closingOpp: { for: string; against: string };
  closingWords: [number, number];
  /** Topic vocabulary with Hebrew glosses. */
  vocabulary: { en: string; he: string }[];
  reviewStatus: 'ai-drafted' | 'reviewed';
}

export const DEBATE_TOPICS: DebateTopic[] = [
  {
    id: 'debate-uniforms',
    level: 'B1',
    motion: 'School uniforms should be compulsory.',
    motionHe: 'תלבושת אחידה צריכה להיות חובה בבתי ספר.',
    opposition: {
      for: 'Uniforms take away a simple way for teenagers to express who they are. Families also pay extra for clothes that students only wear at school.',
      against: 'Without uniforms, students compete over brands and expensive clothes. Uniforms make everyone equal and save time every morning.',
    },
    phrases: ['In my opinion, …', 'The main reason is that …', 'For example, …', 'Some people argue that …, however …', 'To sum up, …'],
    openingWords: [60, 140],
    rebuttalWords: [40, 110],
    closingOpp: {
      for: 'In the end, school is about learning, not about fashion rules. Students can be equal and respectful without everyone wearing the same clothes.',
      against: 'Freedom to choose clothes matters less than a calm, focused school where nobody is judged by what they can afford.',
    },
    closingWords: [30, 80],
    vocabulary: [
      { en: 'compulsory', he: 'חובה' },
      { en: 'express yourself', he: 'להביע את עצמך' },
      { en: 'peer pressure', he: 'לחץ חברתי' },
      { en: 'afford', he: 'להרשות לעצמך (כלכלית)' },
      { en: 'equality', he: 'שוויון' },
    ],
    reviewStatus: 'ai-drafted',
  },
  {
    id: 'debate-online-learning',
    level: 'B2',
    motion: 'Online learning is as effective as learning in a classroom.',
    motionHe: 'למידה מקוונת יעילה כמו למידה בכיתה.',
    opposition: {
      for: 'Many students lose concentration at home, and they miss the immediate feedback and social contact that a classroom provides.',
      against: 'Online courses let students learn at their own pace, replay difficult explanations and reach excellent teachers anywhere in the world.',
    },
    phrases: ['I would argue that …', 'This is mainly because …', 'Research suggests that …', 'While it is true that …, …', 'As a result, …'],
    openingWords: [80, 160],
    rebuttalWords: [60, 130],
    closingOpp: {
      for: 'A screen can deliver information, but a classroom builds habits, friendships and the discipline to learn together.',
      against: 'What matters is what students learn, not where they sit. With good design, online courses reach people a classroom never could.',
    },
    closingWords: [40, 90],
    vocabulary: [
      { en: 'effective', he: 'יעיל' },
      { en: 'at your own pace', he: 'בקצב שלך' },
      { en: 'immediate feedback', he: 'משוב מיידי' },
      { en: 'concentration', he: 'ריכוז' },
      { en: 'access', he: 'נגישות, גישה' },
    ],
    reviewStatus: 'ai-drafted',
  },
  {
    id: 'debate-car-free',
    level: 'B2',
    motion: 'City centres should be closed to private cars.',
    motionHe: 'יש לסגור את מרכזי הערים לרכבים פרטיים.',
    opposition: {
      for: 'Closing city centres hurts elderly and disabled people, delivery workers and small shops that depend on customers who drive.',
      against: 'Cars make city centres noisy, polluted and dangerous. Without them, streets could be used for people, trees and public transport.',
    },
    phrases: ['From my point of view, …', 'One major advantage is …', 'Consequently, …', 'Admittedly, …; nevertheless, …', 'In conclusion, …'],
    openingWords: [80, 160],
    rebuttalWords: [60, 130],
    closingOpp: {
      for: 'A city must work for everyone who lives and works in it. Banning cars solves one problem by creating several new ones.',
      against: 'Cities that removed cars became quieter, cleaner and busier with people. The question is not whether to change, but how quickly.',
    },
    closingWords: [40, 90],
    vocabulary: [
      { en: 'pedestrian', he: 'הולך רגל' },
      { en: 'pollution', he: 'זיהום' },
      { en: 'accessible', he: 'נגיש' },
      { en: 'public transport', he: 'תחבורה ציבורית' },
      { en: 'congestion', he: 'עומס תנועה' },
    ],
    reviewStatus: 'ai-drafted',
  },
  {
    id: 'debate-ai-homework',
    level: 'C1',
    motion: 'Students should be allowed to use AI tools for homework.',
    motionHe: 'יש להתיר לתלמידים להשתמש בכלי בינה מלאכותית בשיעורי בית.',
    opposition: {
      for: 'If AI writes the answer, students skip the thinking that homework is meant to train, and teachers can no longer see what a student actually understands.',
      against: 'AI tools will be part of every workplace. Banning them at school only teaches students to hide their use instead of learning to use them responsibly.',
    },
    phrases: ['It could be argued that …', 'A more convincing view is that …', 'This overlooks the fact that …', 'Critics claim …; yet …', 'On balance, …'],
    openingWords: [100, 200],
    rebuttalWords: [80, 160],
    closingOpp: {
      for: 'Homework exists to build thinking, and thinking cannot be outsourced. Allowing AI tools turns practice into copying.',
      against: 'The real skill of the future is judging and improving what AI produces. Schools should teach that skill openly, not pretend the tools do not exist.',
    },
    closingWords: [50, 110],
    vocabulary: [
      { en: 'outsource', he: 'להעביר לגורם חיצוני' },
      { en: 'responsibly', he: 'באחריות' },
      { en: 'transparency', he: 'שקיפות' },
      { en: 'critical thinking', he: 'חשיבה ביקורתית' },
      { en: 'plagiarism', he: 'גניבה ספרותית' },
    ],
    reviewStatus: 'ai-drafted',
  },
  {
    id: 'debate-weekend-homework',
    level: 'B1',
    motion: 'Teachers should not give homework at the weekend.',
    motionHe: 'מורים לא צריכים לתת שיעורי בית בסוף השבוע.',
    opposition: {
      for: 'A little weekend homework helps students remember what they learned during the week. Without it, many forget everything by Sunday.',
      against: 'Teenagers need real rest, time with family and time for hobbies. Weekend homework makes students tired and stressed before the week even starts.',
    },
    phrases: ['I strongly believe that …', 'Firstly, …', 'In addition, …', 'Some people say that …, but …', 'To sum up, …'],
    openingWords: [60, 130],
    rebuttalWords: [40, 100],
    closingOpp: {
      for: 'Short, useful tasks at the weekend keep learning alive. The answer is better homework, not no homework.',
      against: 'Rested students learn better on Sunday morning. Free weekends are an investment in learning, not a break from it.',
    },
    closingWords: [30, 80],
    vocabulary: [
      { en: 'rest', he: 'מנוחה' },
      { en: 'stressed', he: 'לחוץ' },
      { en: 'remember', he: 'לזכור' },
      { en: 'hobby', he: 'תחביב' },
      { en: 'balance', he: 'איזון' },
    ],
    reviewStatus: 'ai-drafted',
  },
  {
    id: 'debate-phones-school',
    level: 'B1',
    motion: 'Mobile phones should be banned during the whole school day.',
    motionHe: 'יש לאסור טלפונים ניידים במשך כל יום הלימודים.',
    opposition: {
      for: 'Phones are useful tools: students can check information, use dictionaries and contact their parents in an emergency.',
      against: 'Phones distract students in lessons and during breaks. Without them, students talk to each other and play together again.',
    },
    phrases: ['In my view, …', 'The most important reason is …', 'For instance, …', 'It is true that …; however, …', 'In conclusion, …'],
    openingWords: [60, 130],
    rebuttalWords: [40, 100],
    closingOpp: {
      for: 'Teaching students to use phones wisely is better than pretending phones do not exist.',
      against: 'A few hours without screens every day is a gift: more attention in class and more real conversations at break.',
    },
    closingWords: [30, 80],
    vocabulary: [
      { en: 'distract', he: 'להסיח את הדעת' },
      { en: 'emergency', he: 'מקרה חירום' },
      { en: 'ban', he: 'לאסור; איסור' },
      { en: 'break (between lessons)', he: 'הפסקה' },
      { en: 'screen time', he: 'זמן מסך' },
    ],
    reviewStatus: 'ai-drafted',
  },
  {
    id: 'debate-four-day-week',
    level: 'B2',
    motion: 'Schools should move to a four-day week with longer days.',
    motionHe: 'בתי הספר צריכים לעבור לשבוע של ארבעה ימים עם ימים ארוכים יותר.',
    opposition: {
      for: 'Longer school days exhaust younger students, and working parents would struggle to find childcare on the fifth day.',
      against: 'A four-day week gives students a full day for rest, projects or family, and schools save on transport and energy.',
    },
    phrases: ['I would argue that …', 'A key advantage is …', 'This would lead to …', 'Admittedly, …; even so, …', 'On balance, …'],
    openingWords: [80, 150],
    rebuttalWords: [60, 120],
    closingOpp: {
      for: 'The school week should fit children, not budgets. Five shorter days protect attention and family routines.',
      against: 'Countries that tried shorter weeks saw happier students and stable results. It is a reform worth testing.',
    },
    closingWords: [40, 90],
    vocabulary: [
      { en: 'exhausted', he: 'מותש' },
      { en: 'childcare', he: 'השגחה על ילדים' },
      { en: 'reform', he: 'רפורמה' },
      { en: 'routine', he: 'שגרה' },
      { en: 'trial period', he: 'תקופת ניסיון' },
    ],
    reviewStatus: 'ai-drafted',
  },
  {
    id: 'debate-zoos',
    level: 'B2',
    motion: 'Zoos do more harm than good.',
    motionHe: 'גני חיות גורמים יותר נזק מתועלת.',
    opposition: {
      for: 'Modern zoos protect endangered species, run breeding programmes and teach millions of children to care about wildlife.',
      against: 'Even the best enclosure is a tiny copy of the wild. Many animals show signs of stress, and money could protect natural habitats instead.',
    },
    phrases: ['From my perspective, …', 'There is strong evidence that …', 'Take, for example, …', 'Critics may say …; nevertheless, …', 'All things considered, …'],
    openingWords: [80, 150],
    rebuttalWords: [60, 120],
    closingOpp: {
      for: 'Without zoos, some species would already be extinct. Improving zoos is wiser than closing them.',
      against: 'Protecting wild places protects whole ecosystems, not just the few animals people pay to see.',
    },
    closingWords: [40, 90],
    vocabulary: [
      { en: 'endangered species', he: 'מין בסכנת הכחדה' },
      { en: 'habitat', he: 'בית גידול' },
      { en: 'enclosure', he: 'מתחם, מכלאה' },
      { en: 'conservation', he: 'שימור' },
      { en: 'captivity', he: 'שבי' },
    ],
    reviewStatus: 'ai-drafted',
  },
  {
    id: 'debate-space',
    level: 'C1',
    motion: 'Space exploration is worth its enormous cost.',
    motionHe: 'חקר החלל שווה את העלות העצומה שלו.',
    opposition: {
      for: 'Billions spent on rockets could fund hospitals, schools and climate solutions on Earth today, where the need is urgent and certain.',
      against: 'Space research has given us satellites, weather forecasts and medical technologies, and it inspires young people to study science.',
    },
    phrases: ['It is widely held that …', 'A compelling argument is that …', 'This is illustrated by …', 'While opponents contend that …, …', 'Ultimately, …'],
    openingWords: [100, 180],
    rebuttalWords: [80, 150],
    closingOpp: {
      for: 'Curiosity is valuable, but priorities matter. Until basic needs are met on Earth, space can wait.',
      against: 'Investing in the unknown has always paid back in unexpected ways. Cutting it would make our future poorer, not richer.',
    },
    closingWords: [50, 110],
    vocabulary: [
      { en: 'spin-off technology', he: 'טכנולוגיה נלווית שנולדה ממחקר' },
      { en: 'allocate (funds)', he: 'להקצות (כספים)' },
      { en: 'priority', he: 'עדיפות' },
      { en: 'long-term', he: 'ארוך טווח' },
      { en: 'inspire', he: 'לעורר השראה' },
    ],
    reviewStatus: 'ai-drafted',
  },
  {
    id: 'debate-voting-age',
    level: 'C2',
    motion: 'The voting age should be lowered to sixteen.',
    motionHe: 'יש להוריד את גיל ההצבעה לשש-עשרה.',
    opposition: {
      for: 'Most sixteen-year-olds have little experience of taxes, work or independent life, and they may be more easily swayed by their surroundings.',
      against: 'Sixteen-year-olds can work, pay taxes and will live longest with today\'s decisions; denying them a vote is hard to justify.',
    },
    phrases: ['It is my contention that …', 'The crux of the matter is …', 'A case in point is …', 'Granted, …; yet this hardly justifies …', 'In the final analysis, …'],
    openingWords: [120, 200],
    rebuttalWords: [90, 160],
    closingOpp: {
      for: 'Voting is a serious responsibility. Civic education first, and the vote at eighteen, protects both young people and democracy.',
      against: 'Democracy grows stronger when more of those affected have a voice. Early voting builds lifelong participation.',
    },
    closingWords: [60, 120],
    vocabulary: [
      { en: 'enfranchise', he: 'להעניק זכות בחירה' },
      { en: 'civic education', he: 'חינוך אזרחי' },
      { en: 'swayed', he: 'מושפע, מוסט' },
      { en: 'participation', he: 'השתתפות' },
      { en: 'justify', he: 'להצדיק' },
    ],
    reviewStatus: 'ai-drafted',
  },
];
