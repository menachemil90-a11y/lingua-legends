import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import type { CefrLevel, GameModeId } from '@lingua/shared';
import { Button, Dialog, Loading, ToastHost, toast } from './design';
import { applyDocumentSettings, useT, type MessageKey } from './i18n';
import { useSettings } from './state/settings';
import { useNav, installHistoryBridge, type Screen } from './state/nav';
import { connection, useConnection } from './net/connection';
import { sfx } from './audio/sfx';
import { VisualCue } from './games/shared/components';
import { usePlayer } from './state/player';
import { Lobby } from './screens/Lobby';

/*
 * Every screen except the lobby is loaded on demand, so a phone downloads and parses only
 * what the first screen needs. The most likely next screens are prefetched when idle.
 */
const named = <P extends object = object>(loader: () => Promise<Record<string, unknown>>, key: string) => lazy(async () => ({ default: (await loader())[key] as ComponentType<P> }));
const loadPlay = () => import('./screens/Play');
const loadMatch = () => import('./games/MatchScreen');
const loadOnline = () => import('./screens/Online');
const loadLearning = () => import('./screens/Learning');
const loadWorld = () => import('./screens/World');
const loadBagrut = () => import('./screens/Bagrut');
const loadSocial = () => import('./screens/Social');
const Play = named<{ initialMode?: GameModeId }>(loadPlay, 'Play');
const MatchScreen = named<{ params: Extract<Screen, { id: 'match' }>['params'] }>(loadMatch, 'MatchScreen');
const Online = named<Omit<Extract<Screen, { id: 'online' }>, 'id'>>(loadOnline, 'Online');
const Profile = named(() => import('./screens/Profile'), 'Profile');
const Settings = named(() => import('./screens/Settings'), 'Settings');
const Friends = named(loadSocial, 'Friends');
const Leaderboard = named(loadSocial, 'Leaderboard');
const Customize = named(() => import('./screens/Customize'), 'Customize');
const Placement = named(loadLearning, 'Placement');
const Practice = named<{ focus?: 'review' | 'mix'; mistakes?: NonNullable<Extract<Screen, { id: 'practice' }>['mistakes']> }>(loadLearning, 'Practice');
const Reading = named<{ passageId: string; chapterId?: string }>(loadLearning, 'Reading');
const BagrutHub = named(loadBagrut, 'BagrutHub');
const BagrutMock = named<{ examId: string }>(loadBagrut, 'BagrutMock');
const BagrutTask = named<{ taskId: string }>(loadBagrut, 'BagrutTask');
const Adventure = named(loadWorld, 'Adventure');
const Detective = named<{ caseId?: string }>(loadWorld, 'Detective');
const ModeInfo = named<{ mode: GameModeId }>(loadWorld, 'ModeInfo');
const RealLife = named<{ scenarioId?: string }>(loadWorld, 'RealLife');
const EscapeRoomScreen = named<{ roomId?: string }>(() => import('./screens/EscapeRoom'), 'EscapeRoomScreen');
const ConquestScreen = named(() => import('./screens/Conquest'), 'ConquestScreen');
const DebateScreen = named<{ topicId?: string }>(() => import('./screens/Debate'), 'DebateScreen');
const TournamentScreen = named<{ tab?: 'cup' | 'friends'; code?: string }>(() => import('./screens/Tournament'), 'TournamentScreen');
const SentencePracticeScreen = named<{ startLevels?: CefrLevel[] }>(() => import('./games/sentenceMaster/SentencePracticeScreen'), 'SentencePracticeScreen');

function prefetchLikelyScreens(): void {
  const run = () => {
    void loadPlay();
    void loadMatch();
    void loadLearning();
    // Then warm the offline cache with everything else (the service worker caches each chunk),
    // unless the user asked the browser to save data.
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (saveData) return;
    setTimeout(() => {
      void Promise.allSettled([
        loadOnline(),
        loadWorld(),
        loadBagrut(),
        loadSocial(),
        import('./screens/Profile'),
        import('./screens/Settings'),
        import('./screens/Customize'),
        import('./screens/EscapeRoom'),
        import('./screens/Conquest'),
        import('./screens/Debate'),
        import('./screens/Tournament'),
        import('./games/sentenceMaster/SentencePracticeScreen'),
        import('./phaser/ArenaScene'),
        import('./phaser/RaceScene'),
      ]);
    }, 8000);
  };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void };
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 2500);
}

/**
 * Each route gets its own component instance, so moving between two screens of the same kind
 * (a scenario list → a scenario, one case → another) never carries stale state across.
 */
function Router() {
  const s = useNav((n) => n.current);
  return (
    <Suspense fallback={<Loading />}>
      <ScreenFor key={JSON.stringify(s)} s={s} />
    </Suspense>
  );
}

function ScreenFor({ s }: { s: Screen }) {
  switch (s.id) {
    case 'lobby':
      return <Lobby />;
    case 'play':
      return <Play {...(s.mode ? { initialMode: s.mode } : {})} />;
    case 'match':
      return <MatchScreen params={s.params} />;
    case 'sentence-practice':
      return <SentencePracticeScreen {...(s.levels ? { startLevels: s.levels } : {})} />;
    case 'online':
      return <Online mode={s.mode} flow={s.flow} bracket={s.bracket} {...(s.queue ? { queue: s.queue } : {})} {...(s.roomCode ? { roomCode: s.roomCode } : {})} />;
    case 'profile':
      return <Profile />;
    case 'leaderboard':
      return <Leaderboard />;
    case 'friends':
      return <Friends />;
    case 'settings':
      return <Settings />;
    case 'customize':
      return <Customize />;
    case 'placement':
      return <Placement />;
    case 'practice':
      return <Practice {...(s.focus ? { focus: s.focus } : {})} {...(s.mistakes ? { mistakes: s.mistakes } : {})} />;
    case 'reading':
      return <Reading passageId={s.passageId} {...(s.chapterId ? { chapterId: s.chapterId } : {})} />;
    case 'bagrut':
      return <BagrutHub />;
    case 'bagrut-task':
      return <BagrutTask taskId={s.taskId} />;
    case 'bagrut-mock':
      return <BagrutMock examId={s.examId} />;
    case 'adventure':
      return <Adventure />;
    case 'real-life':
      return <RealLife {...(s.scenarioId ? { scenarioId: s.scenarioId } : {})} />;
    case 'detective':
      return <Detective {...(s.caseId ? { caseId: s.caseId } : {})} />;
    case 'escape-room':
      return <EscapeRoomScreen {...(s.roomId ? { roomId: s.roomId } : {})} />;
    case 'conquest':
      return <ConquestScreen />;
    case 'tournament':
      return <TournamentScreen {...(s.tab ? { tab: s.tab } : {})} {...(s.code ? { code: s.code } : {})} />;
    case 'debate':
      return <DebateScreen {...(s.topicId ? { topicId: s.topicId } : {})} />;
    case 'mode-info':
      return <ModeInfo mode={s.mode} />;
  }
}

/** Routes MATCH_FOUND (queue, room, invite or rematch) to the match screen. */
/** Screens that present new achievements themselves (post-match summary, Bagrut task results). */
const SELF_PRESENTING: ReadonlySet<Screen['id']> = new Set(['match', 'bagrut', 'bagrut-task', 'bagrut-mock']);
/** Screens that already play a bigger sting when an achievement unlocks there. */
const SELF_SCORED: ReadonlySet<Screen['id']> = new Set(['match', 'tournament']);

/**
 * Achievements and Learning Journey milestones can unlock during solo practice (Escape Rooms,
 * Detective, Debate, reading…), where no post-match screen exists. Announce them once, gently.
 */
function AchievementWatcher() {
  const t = useT();
  useEffect(
    () =>
      usePlayer.subscribe((s, prev) => {
        if (s.achievements.length <= prev.achievements.length) return;
        const fresh = s.achievements.filter((a) => !prev.achievements.includes(a));
        if (fresh.length === 0) return;
        const screen = useNav.getState().current.id;
        if (!SELF_SCORED.has(screen)) setTimeout(() => sfx.play('milestone'), 350);
        if (!SELF_PRESENTING.has(screen)) toast(`${t('result.unlocked')}: ${fresh.map((a) => t(`achievement.${a}` as MessageKey)).join(' · ')}`, 'good');
      }),
    [t],
  );
  return null;
}

function OnlineMatchRouter() {
  useEffect(
    () =>
      connection.subscribe((msg) => {
        if (msg.type !== 'MATCH_FOUND') return;
        sfx.play('go');
        const nav = useNav.getState();
        const screen = { id: 'match' as const, params: { kind: 'online' as const, mode: msg.mode, matchId: msg.matchId, players: msg.players, queue: msg.queue } };
        if (nav.current.id === 'match' || nav.current.id === 'online') nav.replace(screen);
        else nav.go(screen);
      }),
    [],
  );
  return null;
}

function InviteDialog() {
  const t = useT();
  const invites = useConnection((s) => s.invites);
  const invite = invites[0];
  if (!invite) return null;
  const close = () => connection.dismissInvite(invite.inviteId);
  return (
    <Dialog
      open
      title={t('friends.invited', { name: invite.from.nickname, mode: t(`mode.${invite.mode}` as MessageKey) })}
      onClose={() => {
        connection.send({ type: 'INVITE_RESPOND', inviteId: invite.inviteId, accept: false });
        close();
      }}
      actions={
        <>
          <Button
            onClick={() => {
              connection.send({ type: 'INVITE_RESPOND', inviteId: invite.inviteId, accept: false });
              close();
            }}
          >
            {t('friends.decline')}
          </Button>
          <Button
            variant="primary"
            icon="sword"
            onClick={() => {
              connection.send({ type: 'INVITE_RESPOND', inviteId: invite.inviteId, accept: true });
              close();
            }}
          >
            {t('friends.accept')}
          </Button>
        </>
      }
    >
      <p className="small muted">{t('friends.safety')}</p>
    </Dialog>
  );
}

export function App() {
  const t = useT();
  const settings = useSettings();
  useEffect(() => {
    prefetchLikelyScreens();
  }, []);

  useEffect(() => {
    applyDocumentSettings();
  }, [settings.language, settings.immersion, settings.reducedMotion, settings.highContrast]);

  useEffect(() => {
    installHistoryBridge();
    const unlock = () => {
      sfx.unlock();
      sfx.setMusic('lobby');
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    // Invitation links: ?room=CODE
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room')?.toUpperCase();
    if (room && /^[A-Z0-9]{6}$/.test(room)) {
      history.replaceState(null, '', window.location.pathname);
      useNav.getState().go({ id: 'online', mode: 'word-battle', flow: 'room', bracket: 'core', roomCode: room });
    }
    // Tournament invitations: ?tournament=CODE
    const tcode = params.get('tournament')?.toUpperCase();
    if (tcode && /^[A-Z0-9]{6}$/.test(tcode)) {
      history.replaceState(null, '', window.location.pathname);
      useNav.getState().go({ id: 'tournament', tab: 'friends', code: tcode });
    }
    const offline = () => toast(t('offline.notice'));
    window.addEventListener('offline', offline);
    return () => window.removeEventListener('offline', offline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Router />
      <OnlineMatchRouter />
      <InviteDialog />
      <ToastHost />
      <AchievementWatcher />
      <VisualCue placement="screen" />
    </>
  );
}
