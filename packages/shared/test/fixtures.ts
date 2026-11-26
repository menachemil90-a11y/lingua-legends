import { contentItemSchema, type ContentItem, type ContentItemInput } from '../src/content/schema';
import type { QuestionSource } from '../src/hosts/common';
import type { PublicPlayer, ServerMessage } from '../src/protocol';

export function mcItem(id: string, overrides: Partial<ContentItemInput> = {}): ContentItem {
  return contentItemSchema.parse({
    id,
    version: 1,
    level: 'A1',
    primarySkill: 'grammar',
    difficulty: 2,
    type: 'cloze',
    category: 'sentence-completion',
    prompt: 'She ___ to school every day.',
    options: [
      { id: 'a', text: 'goes' },
      { id: 'b', text: 'go', errorCategory: 'subject-verb-agreement', feedback: { en: 'With she, add -es.', he: 'עם she מוסיפים es.' } },
      { id: 'c', text: 'going' },
      { id: 'd', text: 'gone' },
    ],
    acceptedAnswers: ['a'],
    grading: { mode: 'option' },
    explanation: { en: 'Present Simple: he/she/it + verb-s.', he: 'בהווה פשוט: he/she/it + פועל עם s.' },
    tags: { vocabulary: [], grammar: ['present-simple-3rd'] },
    modes: ['word-battle', 'grammar-race'],
    reviewStatus: 'reviewed',
    ...overrides,
  });
}

export function sentenceItem(id: string): ContentItem {
  return contentItemSchema.parse({
    id,
    version: 1,
    level: 'A2',
    primarySkill: 'grammar',
    difficulty: 2,
    type: 'sentence-build',
    category: 'sentence-building',
    prompt: 'Build the sentence.',
    tiles: ['I', 'went', 'to', 'the', 'park', 'yesterday'],
    acceptedAnswers: ['I went to the park yesterday.', 'Yesterday I went to the park.'],
    grading: { mode: 'token-sequence' },
    explanation: { en: 'Time expressions go at the start or end.', he: 'ביטויי זמן באים בתחילת המשפט או בסופו.' },
    tags: { vocabulary: [], grammar: ['word-order-time'] },
    modes: ['sentence-master'],
    reviewStatus: 'reviewed',
  });
}

export function fixedSource(items: ContentItem[]): QuestionSource {
  return { publicItems: true, next: (i) => items[i % items.length]! };
}

export function players(): PublicPlayer[] {
  return [
    { playerId: 'p1', nickname: 'Ada', isBot: false, characterId: 'vexa', vehicleId: 'comet' },
    { playerId: 'p2', nickname: 'Ben', isBot: false, characterId: 'kael', vehicleId: 'viper' },
  ];
}

export class Recorder {
  all: { to: string | null; msg: ServerMessage }[] = [];
  emit = (to: string | null, msg: ServerMessage) => {
    this.all.push({ to, msg });
  };
  of<T extends ServerMessage['type']>(type: T, to?: string | null): Extract<ServerMessage, { type: T }>[] {
    return this.all
      .filter((e) => e.msg.type === type && (to === undefined || e.to === to || e.to === null))
      .map((e) => e.msg as Extract<ServerMessage, { type: T }>);
  }
  last<T extends ServerMessage['type']>(type: T, to?: string | null): Extract<ServerMessage, { type: T }> {
    const list = this.of(type, to);
    const m = list[list.length - 1];
    if (!m) throw new Error(`no ${type} message`);
    return m;
  }
}
