import {
  contentItemSchema,
  readingPassageSchema,
  type CefrLevel,
  type ContentConsumer,
  type ContentItem,
  type ContentItemInput,
  type ReadingPassage,
} from '@lingua/shared';
import { A1_ITEMS, A2_ITEMS } from './items/foundation';
import { B1_ITEMS, B2_ITEMS } from './items/core';
import { C1_ITEMS, C2_ITEMS } from './items/advanced';
import { RACE_ITEMS } from './items/race';
import { SENTENCE_ITEMS } from './items/sentences';
import { PASSAGES, READING_ITEMS } from './reading';
import { BAGRUT_ITEMS, LITERARY_TEXTS } from './bagrut';
import { LISTENING_ITEMS } from './items/listening';
import { EXTRA_ITEMS } from './items/extra';

export * from './bagrut';
export * from './sets';
export * from './story';
export * from './escape';
export * from './debate';
export { validateContent, CONTENT_TARGETS, type ValidationIssue } from './validate';

export const RAW_ITEMS: ContentItemInput[] = [
  ...A1_ITEMS,
  ...A2_ITEMS,
  ...B1_ITEMS,
  ...B2_ITEMS,
  ...C1_ITEMS,
  ...C2_ITEMS,
  ...RACE_ITEMS,
  ...SENTENCE_ITEMS,
  ...READING_ITEMS,
  ...BAGRUT_ITEMS,
  ...LISTENING_ITEMS,
  ...EXTRA_ITEMS,
];

export const RAW_PASSAGES = [...PASSAGES, ...LITERARY_TEXTS];

/** Public (offline) content bank. Ranked answer keys live only on the server. */
export const CONTENT_ITEMS: ContentItem[] = RAW_ITEMS.map((i) => contentItemSchema.parse(i));
export const READING_PASSAGES: ReadingPassage[] = RAW_PASSAGES.map((p) => readingPassageSchema.parse(p));

const byId = new Map(CONTENT_ITEMS.map((i) => [i.id, i]));
const passageMap = new Map(READING_PASSAGES.map((p) => [p.id, p]));

export function itemById(id: string): ContentItem | undefined {
  return byId.get(id);
}

export function passageById(id: string): ReadingPassage | undefined {
  return passageMap.get(id);
}

export function itemsFor(mode: ContentConsumer, levels?: readonly CefrLevel[]): ContentItem[] {
  return CONTENT_ITEMS.filter((i) => i.modes.includes(mode) && (!levels || levels.includes(i.level)));
}

export function itemsForPassage(passageId: string): ContentItem[] {
  return CONTENT_ITEMS.filter((i) => i.passageId === passageId);
}

/** Items usable in Word Battle (option-graded, short enough for a round). */
export function wordBattlePool(levels?: readonly CefrLevel[]): ContentItem[] {
  return itemsFor('word-battle', levels).filter((i) => i.grading.mode === 'option' && !i.passageId && !i.listen);
}

export function grammarRacePool(levels?: readonly CefrLevel[]): ContentItem[] {
  return itemsFor('grammar-race', levels).filter((i) => i.grading.mode === 'option' && !i.context && !i.passageId);
}

export function sentencePool(levels?: readonly CefrLevel[]): ContentItem[] {
  return itemsFor('sentence-master', levels).filter((i) => i.type === 'sentence-build');
}

/** Authoring helpers (also used by the server-only ranked pool). */
export { q, sb } from './helpers';

export function listeningPool(levels?: readonly CefrLevel[]): ContentItem[] {
  return CONTENT_ITEMS.filter((i) => !!i.listen && (!levels || levels.includes(i.level)));
}
