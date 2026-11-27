import { useEffect } from 'react';
import { Button, Dialog, ToastHost, toast } from './design';
import { applyDocumentSettings, useT, type MessageKey } from './i18n';
import { useSettings } from './state/settings';
import { useNav, installHistoryBridge } from './state/nav';
import { connection, useConnection } from './net/connection';
import { sfx } from './audio/sfx';
import { Lobby } from './screens/Lobby';
import { Play } from './screens/Play';
import { Online } from './screens/Online';
import { Profile } from './screens/Profile';
import { Settings } from './screens/Settings';
import { Friends, Leaderboard } from './screens/Social';
import { Customize } from './screens/Customize';
import { Placement, Practice, Reading } from './screens/Learning';
import { BagrutHub, BagrutMock, BagrutTask } from './screens/Bagrut';
import { Adventure, Detective, ModeInfo, RealLife } from './screens/World';
import { MatchScreen } from './games/MatchScreen';
import { EscapeRoomScreen } from './screens/EscapeRoom';
import { ConquestScreen } from './screens/Conquest';
import { DebateScreen } from './screens/Debate';
import { SentencePracticeScreen } from './games/sentenceMaster/SentencePracticeScreen';

function Router() {
  const s = useNav((n) => n.current);
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
      return <Practice {...(s.focus ? { focus: s.focus } : {})} />;
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
    case 'debate':
      return <DebateScreen {...(s.topicId ? { topicId: s.topicId } : {})} />;
    case 'mode-info':
      return <ModeInfo mode={s.mode} />;
  }
}

/** Routes MATCH_FOUND (queue, room, invite or rematch) to the match screen. */
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
    </>
  );
}
