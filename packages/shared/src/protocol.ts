/**
 * Client <-> server event contracts for authoritative multiplayer.
 *
 * Every client message is validated at runtime with these schemas. The client only
 * ever sends *intents* (answer choice, ability use); the server decides correctness,
 * damage, scores, winners, rating changes and rewards.
 */
import { z } from 'zod';
import { BRACKETS, CEFR_LEVELS, SKILLS } from './cefr';
import { ONLINE_MODE_IDS, QUEUE_MODE_IDS, ERROR_CATEGORIES, publicQuestionSchema, bilingualSchema } from './content/schema';
import { CONQUEST_MAP, FACTION_IDS, LOG_KINDS } from './rules/conquest';
import { QUICK_CHAT_IDS } from './catalog';
import { RANK_TIERS } from './ranking';

export const PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_BYTES = 4096;

const id = z.string().min(1).max(64);
/** Client-generated unique message id, used for idempotency and replay protection. */
const msgId = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

const base = { msgId };

export const modeSchema = z.enum(ONLINE_MODE_IDS);
export const queueModeSchema = z.enum(QUEUE_MODE_IDS);
export const bracketSchema = z.enum(BRACKETS);
export const queueKindSchema = z.enum(['ranked', 'casual']);
export type QueueKind = z.infer<typeof queueKindSchema>;
export const abilitySchema = z.enum(['shield', 'surge', 'focus']);
export type AbilityId = z.infer<typeof abilitySchema>;

export const answerPayloadSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('option'), optionId: z.string().min(1).max(8) }),
  z.object({ kind: z.literal('tiles'), tileIds: z.array(z.string().min(1).max(8)).min(1).max(40) }),
]);
export type AnswerPayload = z.infer<typeof answerPayloadSchema>;

const territoryId = z.enum(CONQUEST_MAP.map((t) => t.id) as [string, ...string[]]);
const troopCount = z.number().int().min(1).max(999);
/** English Conquest intents. The host validates legality against the authoritative state. */
export const conquestActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('recruit'), at: territoryId }),
  z.object({ type: z.literal('fortify'), at: territoryId }),
  z.object({ type: z.literal('attack'), from: territoryId, to: territoryId, troops: troopCount, useFocus: z.boolean() }),
  z.object({ type: z.literal('move'), from: territoryId, to: territoryId, troops: troopCount }),
  z.object({ type: z.literal('end') }),
]);

/** Co-op Escape Room intents (the server checks answers and keeps the shared state). */
export const escapeActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('answer'),
    puzzleId: id,
    answer: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('choice'), index: z.number().int().min(0).max(9) }),
      z.object({ kind: z.literal('text'), text: z.string().min(1).max(80) }),
      z.object({ kind: z.literal('order'), order: z.array(z.string().max(300)).min(1).max(12) }),
    ]),
  }),
  z.object({ type: z.literal('hint'), puzzleId: id }),
]);
export type EscapeAction = z.infer<typeof escapeActionSchema>;

const cosmeticsSchema = z.object({
  characterId: z.string().max(32).default('vexa'),
  vehicleId: z.string().max(32).default('comet'),
  titleId: z.string().max(48).optional(),
  frameId: z.string().max(48).optional(),
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('HELLO'),
    ...base,
    token: z.string().min(10).max(4000),
    protocol: z.literal(PROTOCOL_VERSION),
    cosmetics: cosmeticsSchema.optional(),
  }),
  z.object({ type: z.literal('QUEUE_JOIN'), ...base, mode: queueModeSchema, queue: queueKindSchema, bracket: bracketSchema }),
  z.object({ type: z.literal('QUEUE_LEAVE'), ...base }),
  z.object({ type: z.literal('ROOM_CREATE'), ...base, mode: modeSchema, bracket: bracketSchema }),
  z.object({ type: z.literal('ROOM_JOIN'), ...base, code: z.string().regex(/^[A-Z0-9]{6}$/) }),
  z.object({ type: z.literal('ROOM_LEAVE'), ...base }),
  /** Host starts a room early (Grammar Race rooms hold up to 4 racers). */
  z.object({ type: z.literal('ROOM_START'), ...base }),
  z.object({ type: z.literal('READY'), ...base, matchId: id }),
  z.object({ type: z.literal('ANSWER_SUBMIT'), ...base, matchId: id, roundId: id, answer: answerPayloadSchema }),
  z.object({ type: z.literal('ABILITY_USE'), ...base, matchId: id, ability: abilitySchema }),
  z.object({ type: z.literal('CONQUEST_ACTION'), ...base, matchId: id, action: conquestActionSchema }),
  z.object({ type: z.literal('ESCAPE_ACTION'), ...base, matchId: id, action: escapeActionSchema }),
  /** Friends' single-elimination tournaments (1v1 modes, 3–8 players, unranked). */
  z.object({ type: z.literal('TOURNAMENT_CREATE'), ...base, mode: queueModeSchema, bracket: bracketSchema }),
  z.object({ type: z.literal('TOURNAMENT_JOIN'), ...base, code: z.string().regex(/^[A-Z0-9]{6}$/) }),
  z.object({ type: z.literal('TOURNAMENT_START'), ...base }),
  z.object({ type: z.literal('TOURNAMENT_LEAVE'), ...base }),
  z.object({ type: z.literal('REMATCH_REQUEST'), ...base, matchId: id }),
  z.object({ type: z.literal('MATCH_LEAVE'), ...base, matchId: id }),
  z.object({ type: z.literal('QUICK_CHAT'), ...base, matchId: id, phraseId: z.enum(QUICK_CHAT_IDS) }),
  z.object({ type: z.literal('PING'), ...base, clientTime: z.number() }),
  z.object({ type: z.literal('FRIEND_REQUEST'), ...base, friendCode: z.string().regex(/^[A-Z0-9]{8}$/) }),
  z.object({ type: z.literal('FRIEND_RESPOND'), ...base, requestId: id, accept: z.boolean() }),
  z.object({ type: z.literal('FRIEND_REMOVE'), ...base, playerId: id }),
  z.object({ type: z.literal('FRIENDS_LIST'), ...base }),
  z.object({ type: z.literal('FRIEND_CHALLENGE'), ...base, playerId: id, mode: modeSchema, bracket: bracketSchema }),
  z.object({ type: z.literal('INVITE_RESPOND'), ...base, inviteId: id, accept: z.boolean() }),
  z.object({ type: z.literal('BLOCK'), ...base, playerId: id }),
  z.object({ type: z.literal('UNBLOCK'), ...base, playerId: id }),
  z.object({
    type: z.literal('REPORT'),
    ...base,
    playerId: id,
    reason: z.enum(['cheating', 'offensive-name', 'harassment', 'other']),
    matchId: id.optional(),
    details: z.string().max(500).optional(),
  }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type ClientMessageType = ClientMessage['type'];
/** Distributive Omit that keeps the discriminated union intact. */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type ClientIntent = DistributiveOmit<ClientMessage, 'msgId'>;

// ---------------------------------------------------------------------------
// Server -> client
// ---------------------------------------------------------------------------

export const publicPlayerSchema = z.object({
  playerId: id,
  nickname: z.string(),
  isBot: z.boolean(),
  botTier: z.string().optional(),
  characterId: z.string(),
  vehicleId: z.string(),
  titleId: z.string().optional(),
  frameId: z.string().optional(),
  rankTier: z.enum(RANK_TIERS).optional(),
  rankLabel: z.string().optional(),
});
export type PublicPlayer = z.infer<typeof publicPlayerSchema>;

const wordBattlePlayerState = z.object({
  playerId: id,
  hp: z.number(),
  maxHp: z.number(),
  combo: z.number(),
  abilityCharged: z.boolean(),
  shield: z.boolean(),
  surge: z.boolean(),
  answered: z.boolean(),
  connected: z.boolean(),
});
export type WordBattlePlayerState = z.infer<typeof wordBattlePlayerState>;

const racePlayerState = z.object({
  playerId: id,
  distance: z.number(),
  speed: z.number(),
  streak: z.number(),
  turbo: z.boolean(),
  stalled: z.boolean(),
  finishedAtMs: z.number().nullable(),
  connected: z.boolean(),
});
export type RacePlayerState = z.infer<typeof racePlayerState>;

const sentencePlayerState = z.object({
  playerId: id,
  score: z.number(),
  solved: z.number(),
  attemptsLeft: z.number(),
  done: z.boolean(),
  connected: z.boolean(),
});
export type SentencePlayerState = z.infer<typeof sentencePlayerState>;

const conquestPlayerSchema = z.object({
  id,
  name: z.string(),
  faction: z.enum(FACTION_IDS),
  isBot: z.boolean(),
  botTier: z.string().optional(),
  gold: z.number(),
  focus: z.number(),
  alive: z.boolean(),
  capital: z.string(),
  correctAnswers: z.number(),
  questionsAnswered: z.number(),
});
export const conquestStateSchema = z.object({
  round: z.number(),
  turn: z.number(),
  phase: z.enum(['question', 'actions', 'ended']),
  actionsLeft: z.number(),
  players: z.array(conquestPlayerSchema),
  territories: z.record(z.string(), z.object({ owner: z.string().nullable(), troops: z.number(), fort: z.boolean() })),
  /** The server sends only the most recent log entries. */
  log: z.array(z.object({ round: z.number(), playerId: z.string(), text: z.string(), kind: z.enum(LOG_KINDS) })),
  winnerId: z.string().nullable(),
  endReason: z.enum(['domination', 'elimination', 'rounds']).nullable(),
});

export const playerStatePayloadSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('word-battle'), players: z.array(wordBattlePlayerState) }),
  z.object({ mode: z.literal('grammar-race'), trackLength: z.number(), elapsedMs: z.number(), players: z.array(racePlayerState) }),
  z.object({ mode: z.literal('sentence-master'), players: z.array(sentencePlayerState) }),
  z.object({
    mode: z.literal('english-conquest'),
    state: conquestStateSchema,
    connected: z.array(id),
    /** Server time when the current phase (question or actions) times out. */
    phaseDeadline: z.number().nullable(),
  }),
  z.object({
    mode: z.literal('escape-room'),
    roomId: z.string(),
    solved: z.array(z.object({ puzzleId: z.string(), by: id, attempts: z.number(), hinted: z.boolean() })),
    attempts: z.record(z.string(), z.number()),
    hints: z.array(z.string()),
    connected: z.array(id),
    /** The most recent attempt, so every teammate sees what happened. */
    last: z.object({ puzzleId: z.string(), by: id, correct: z.boolean(), seq: z.number() }).nullable(),
    escaped: z.boolean(),
  }),
]);
export type PlayerStatePayload = z.infer<typeof playerStatePayloadSchema>;

export const learningInfoSchema = z.object({
  itemId: z.string(),
  level: z.enum(CEFR_LEVELS),
  primarySkill: z.enum(SKILLS),
  secondarySkills: z.array(z.enum(SKILLS)),
  vocabularyTags: z.array(z.string()),
  grammarTags: z.array(z.string()),
  category: z.string(),
  /** Whether the item comes from the public offline bank (true) or the server-only ranked pool. */
  publicItem: z.boolean(),
});
export type LearningInfo = z.infer<typeof learningInfoSchema>;

export const answerResultSchema = z.object({
  playerId: id,
  answered: z.boolean(),
  correct: z.boolean(),
  responseMs: z.number().nullable(),
  /** Only included in the message sent to that player. */
  answerText: z.string().optional(),
  errorCategory: z.enum(ERROR_CATEGORIES).optional(),
  feedback: bilingualSchema.optional(),
});
export type AnswerResultEntry = z.infer<typeof answerResultSchema>;

export const combatEventSchema = z.object({
  kind: z.enum(['attack', 'blocked', 'shield-up', 'surge-ready', 'heal', 'miss', 'charged']),
  from: id,
  to: id.optional(),
  amount: z.number().optional(),
  surge: z.boolean().optional(),
  speedBonus: z.number().optional(),
});
export type CombatEvent = z.infer<typeof combatEventSchema>;

export const playerMatchStatsSchema = z.object({
  playerId: id,
  answered: z.number(),
  correct: z.number(),
  incorrect: z.number(),
  avgResponseMs: z.number().nullable(),
  bestCombo: z.number(),
  damageDealt: z.number().optional(),
  distance: z.number().optional(),
  finishMs: z.number().nullable().optional(),
  position: z.number().optional(),
  score: z.number().optional(),
});
export type PlayerMatchStats = z.infer<typeof playerMatchStatsSchema>;

const rankInfoSchema = z.object({
  tier: z.enum(RANK_TIERS),
  division: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  progress: z.number(),
  nextAt: z.number().nullable(),
  label: z.string(),
});

export const ratingChangeSchema = z.object({
  before: z.number(),
  after: z.number(),
  delta: z.number(),
  rankBefore: rankInfoSchema,
  rankAfter: rankInfoSchema,
  placement: z.object({ played: z.number(), total: z.number() }).nullable(),
  promoted: z.boolean(),
  demoted: z.boolean(),
});

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('WELCOME'),
    playerId: id,
    nickname: z.string(),
    friendCode: z.string(),
    serverTime: z.number(),
    accountKind: z.enum(['guest', 'registered']),
  }),
  z.object({
    type: z.literal('QUEUE_STATE'),
    status: z.enum(['idle', 'searching']),
    mode: modeSchema.optional(),
    queue: queueKindSchema.optional(),
    bracket: bracketSchema.optional(),
    elapsedMs: z.number().optional(),
    searching: z.number().optional(),
  }),
  z.object({
    type: z.literal('ROOM_STATE'),
    code: z.string(),
    mode: modeSchema,
    bracket: bracketSchema,
    hostId: id,
    members: z.array(publicPlayerSchema),
    status: z.enum(['open', 'in-match', 'closed']),
    capacity: z.number(),
    expiresAt: z.number(),
  }),
  z.object({
    type: z.literal('MATCH_FOUND'),
    matchId: id,
    mode: modeSchema,
    queue: z.enum(['ranked', 'casual', 'private']),
    bracket: bracketSchema,
    players: z.array(publicPlayerSchema),
    readyDeadline: z.number(),
  }),
  z.object({ type: z.literal('READY_STATE'), matchId: id, ready: z.array(id) }),
  z.object({
    type: z.literal('MATCH_START'),
    matchId: id,
    mode: modeSchema,
    players: z.array(publicPlayerSchema),
    serverTime: z.number(),
    startsAt: z.number(),
    endsAt: z.number().nullable(),
    config: z.record(z.string(), z.number()),
  }),
  z.object({
    type: z.literal('ROUND_START'),
    matchId: id,
    roundId: id,
    index: z.number(),
    question: publicQuestionSchema,
    serverTime: z.number(),
    deadline: z.number(),
    finalRound: z.boolean(),
  }),
  z.object({
    type: z.literal('ANSWER_RESULT'),
    matchId: id,
    roundId: id,
    results: z.array(answerResultSchema),
    correctAnswer: z.string(),
    explanation: bilingualSchema,
    example: z.string().optional(),
    learning: learningInfoSchema,
    prompt: z.string(),
  }),
  z.object({ type: z.literal('ANSWER_LOCKED'), matchId: id, roundId: id, playerId: id }),
  /** Sentence Master: result of a non-final attempt (never reveals the answer). */
  z.object({
    type: z.literal('ATTEMPT_RESULT'),
    matchId: id,
    roundId: id,
    correct: z.boolean(),
    attemptsLeft: z.number(),
  }),
  z.object({ type: z.literal('COMBAT_EVENT'), matchId: id, roundId: id.optional(), events: z.array(combatEventSchema) }),
  z.object({ type: z.literal('PLAYER_STATE'), matchId: id, state: playerStatePayloadSchema }),
  z.object({
    type: z.literal('MATCH_END'),
    matchId: id,
    mode: modeSchema,
    reason: z.enum(['ko', 'timeout', 'finish', 'forfeit', 'rounds-complete', 'cancelled', 'double-ko']),
    winnerId: id.nullable(),
    outcomes: z.array(z.object({ playerId: id, result: z.enum(['win', 'loss', 'draw']) })),
    stats: z.array(playerMatchStatsSchema),
    ratingChange: ratingChangeSchema.nullable(),
    xpEarned: z.number(),
    shardsEarned: z.number().optional(),
    /** Achievements unlocked server-side by this match. */
    achievements: z.array(z.string()).optional(),
    ranked: z.boolean(),
  }),
  z.object({ type: z.literal('MATCH_CANCELLED'), matchId: id, reason: z.string() }),
  z.object({
    type: z.literal('TOURNAMENT_STATE'),
    code: z.string(),
    mode: queueModeSchema,
    bracket: bracketSchema,
    hostId: id,
    status: z.enum(['open', 'running', 'finished', 'closed']),
    players: z.array(publicPlayerSchema),
    /** Players who left; their remaining matches are walkovers. */
    left: z.array(id),
    rounds: z.array(
      z.array(z.object({ a: id.nullable(), b: id.nullable(), winnerId: id.nullable(), status: z.enum(['pending', 'live', 'done', 'bye']), matchId: id.optional() })),
    ),
    championId: id.nullable(),
    maxPlayers: z.number(),
    expiresAt: z.number(),
  }),
  z.object({ type: z.literal('REMATCH_STATE'), matchId: id, requestedBy: z.array(id), newMatchId: id.optional() }),
  z.object({ type: z.literal('QUICK_CHAT'), matchId: id, from: id, phraseId: z.enum(QUICK_CHAT_IDS) }),
  z.object({
    type: z.literal('FRIENDS_STATE'),
    friends: z.array(z.object({ playerId: id, nickname: z.string(), online: z.boolean() })),
    incoming: z.array(z.object({ requestId: id, playerId: id, nickname: z.string() })),
    outgoing: z.array(z.object({ requestId: id, playerId: id, nickname: z.string() })),
    blocked: z.array(z.object({ playerId: id, nickname: z.string() })),
  }),
  z.object({
    type: z.literal('INVITE'),
    inviteId: id,
    from: publicPlayerSchema,
    mode: modeSchema,
    bracket: bracketSchema,
    expiresAt: z.number(),
  }),
  z.object({ type: z.literal('PONG'), clientTime: z.number(), serverTime: z.number() }),
  z.object({ type: z.literal('NOTICE'), code: z.string(), message: z.string() }),
  z.object({ type: z.literal('ERROR'), code: z.string(), message: z.string(), ref: z.string().optional() }),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;
export type ServerMessageType = ServerMessage['type'];
export type ServerMessageOf<T extends ServerMessageType> = Extract<ServerMessage, { type: T }>;

export const ERROR_CODES = {
  BAD_MESSAGE: 'BAD_MESSAGE',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  RATE_LIMITED: 'RATE_LIMITED',
  DUPLICATE: 'DUPLICATE',
  NOT_IN_MATCH: 'NOT_IN_MATCH',
  INVALID_STATE: 'INVALID_STATE',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  FORBIDDEN: 'FORBIDDEN',
  STALE_ROUND: 'STALE_ROUND',
  SESSION_REPLACED: 'SESSION_REPLACED',
  NOT_FOUND: 'NOT_FOUND',
  RANKED_UNAVAILABLE: 'RANKED_UNAVAILABLE',
} as const;
