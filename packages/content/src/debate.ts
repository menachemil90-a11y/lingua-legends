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
  },
];
