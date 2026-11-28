import type { IconName } from './icons';

/**
 * Scene medallions for list cards, keyed by content id. Purely decorative: every card also shows
 * its title, level and description. Unknown ids fall back to the caller's default icon.
 */
export const SCENE_ICON: Record<string, IconName> = {
  // Real Life
  'rl-airport': 'plane',
  'rl-interview': 'cup',
  'rl-hotel': 'bed',
  'rl-restaurant': 'cutlery',
  'rl-shopping': 'bag',
  'rl-support-call': 'phone',
  'rl-university': 'cap',
  'rl-standup': 'laptop',
  // English Detective
  'case-missing-trophy': 'trophy',
  'case-silent-lab': 'flask',
  'case-wrong-cake': 'cake',
  'case-fake-review': 'star',
  // Debate Arena
  'debate-uniforms': 'shirt',
  'debate-online-learning': 'laptop',
  'debate-car-free': 'car',
  'debate-ai-homework': 'brain',
  'debate-weekend-homework': 'book',
  'debate-phones-school': 'phone',
  'debate-four-day-week': 'clock',
  'debate-zoos': 'paw',
  'debate-space': 'rocket',
  'debate-voting-age': 'ballot',
};
