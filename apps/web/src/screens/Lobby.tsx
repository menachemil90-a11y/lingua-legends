import { useEffect, useState } from 'react';
import { bracketForLevel, CEFR_LEVELS, MODES, type OnlineModeId } from '@lingua/shared';
import { dueReviews, overallEstimate, recommendedLevel } from '@lingua/learning';
import { Hero, Logo, RankEmblem } from '../art/Art';
import { Icon, type IconName } from '../art/icons';
import { Button, Chip, Currency, Dialog, ProgressBar, Segmented, toast } from '../design';
import { useT, type MessageKey } from '../i18n';
import { playerLevel, usePlayer, weeklyMomentum } from '../state/player';
import { useNav } from '../state/nav';
import { useSettings } from '../state/settings';
import { useConnection } from '../net/connection';
import { fetchMyRatings, type RemoteRating } from '../net/api';
import { suggestBotTier } from '@lingua/shared';

const MODE_ICON: Record<string, IconName> = {
  'word-battle': 'sword',
  'grammar-race': 'car',
  'sentence-master': 'puzzle',
  'real-life': 'chat',
  'english-detective': 'search',
  'escape-room': 'door',
  'english-conquest': 'castle',
  'debate-arena': 'scroll',
};

export function quickPlayParams(mode: OnlineModeId) {
  const p = usePlayer.getState();
  const lvl = recommendedLevel(p.learner, mode === 'grammar-race' ? 'grammar' : 'vocabulary');
  const bracket = bracketForLevel(lvl);
  const levels = bracket === 'foundation' ? (['A1', 'A2'] as const) : bracket === 'core' ? (['B1', 'B2'] as const) : (['C1', 'C2'] as const);
  const recent = p.matches.slice(0, 5);
  const acc = recent.length ? recent.reduce((a, m) => a + m.accuracy, 0) / recent.length : null;
  return { kind: 'local' as const, mode, levels: [...levels], botTier: suggestBotTier(acc), ...(mode === 'grammar-race' ? { racers: 4 } : {}) };
}

export function Lobby() {
  const t = useT();
  const go = useNav((s) => s.go);
  const p = usePlayer();
  const lvl = playerLevel(p.xp);
  const connStatus = useConnection((s) => s.status);
  const tour = useConnection((s) => s.tournament);
  const myId = useConnection((s) => s.playerId);
  const inTour = !!tour && (tour.status === 'open' || tour.status === 'running') && tour.players.some((x) => x.playerId === myId) && !tour.left.includes(myId ?? '');
  const [ratings, setRatings] = useState<RemoteRating[] | null>(null);
  const [modeOpen, setModeOpen] = useState(false);
  const est = overallEstimate(p.learner);
  const due = dueReviews(p.learner, Date.now()).length;
  const momentum = weeklyMomentum(p.activeDays);
  const selected = MODES.find((m) => m.id === p.selectedMode) ?? MODES[0]!;
  const lang = useSettings((s) => s.language);

  useEffect(() => {
    if (connStatus !== 'connected') return;
    fetchMyRatings()
      .then(setRatings)
      .catch(() => setRatings(null));
  }, [connStatus]);

  const best = ratings?.filter((r) => r.games > 0).sort((a, b) => b.rating - a.rating)[0];

  const play = () => {
    if (selected.status === 'playable' && selected.online) {
      go({ id: 'match', params: quickPlayParams(selected.id as OnlineModeId) });
    } else if (selected.id === 'real-life') go({ id: 'real-life' });
    else if (selected.id === 'english-detective') go({ id: 'detective' });
    else if (selected.id === 'escape-room') go({ id: 'escape-room' });
    else if (selected.id === 'english-conquest') go({ id: 'conquest' });
    else if (selected.id === 'debate-arena') go({ id: 'debate' });
    else go({ id: 'mode-info', mode: selected.id });
  };

  const tiles: { key: string; icon: IconName; title: string; sub: string; glow: string; onClick: () => void; art?: React.ReactNode }[] = [
    { key: 'ranked', icon: 'trophy', title: t('lobby.ranked'), sub: t('lobby.rankedSub'), glow: 'rgba(245,196,81,.28)', onClick: () => go({ id: 'play', mode: selected.id }), art: <RankEmblem tier={(best?.tier as 'gold') ?? 'gold'} division={best?.division ?? 2} size={96} /> },
    { key: 'casual', icon: 'globe', title: t('lobby.casual'), sub: t('lobby.casualSub'), glow: 'rgba(56,225,255,.25)', onClick: () => go({ id: 'play', mode: selected.id }) },
    { key: 'practice', icon: 'target', title: t('lobby.practice'), sub: due > 0 ? t('lobby.reviewsDue', { n: due }) : t('lobby.practiceSub'), glow: 'rgba(54,224,176,.22)', onClick: () => go({ id: 'practice' }) },
    { key: 'friends', icon: 'users', title: t('lobby.friends'), sub: t('lobby.friendsSub'), glow: 'rgba(178,107,255,.28)', onClick: () => go({ id: 'friends' }) },
    { key: 'adventure', icon: 'map', title: t('lobby.adventure'), sub: t('lobby.adventureSub'), glow: 'rgba(255,138,61,.25)', onClick: () => go({ id: 'adventure' }) },
    { key: 'bagrut', icon: 'book', title: t('lobby.bagrut'), sub: t('lobby.bagrutSub'), glow: 'rgba(127,243,255,.22)', onClick: () => go({ id: 'bagrut' }) },
  ];

  return (
    <div className="lobby">
      <div className="lobby-bg" aria-hidden="true">
        <div className="lobby-bg__nebula" />
        <div className="lobby-bg__stars" />
        <svg className="lobby-bg__islands" viewBox="0 0 1600 600" preserveAspectRatio="xMidYMax slice">
          <defs>
            <linearGradient id="isl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1b3a7a" />
              <stop offset="1" stopColor="#060d24" />
            </linearGradient>
          </defs>
          <path d="M80 330 C140 300 260 300 320 330 L260 420 L200 470 L150 410 Z" fill="url(#isl)" opacity=".55" />
          <path d="M1230 260 C1300 230 1440 236 1500 268 L1440 352 L1380 400 L1320 340 Z" fill="url(#isl)" opacity=".5" />
          <path d="M1060 380 C1100 364 1170 366 1200 382 L1160 430 L1120 452 Z" fill="url(#isl)" opacity=".4" />
          <path d="M0 600 L0 520 C200 480 400 500 600 470 C800 440 1000 470 1200 455 C1400 440 1500 470 1600 460 L1600 600 Z" fill="#050b20" />
        </svg>
        <div className="lobby-bg__motes">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} style={{ ['--i' as string]: i }} />
          ))}
        </div>
      </div>

      <header className="lobby__top">
        <button type="button" className="profile-chip" onClick={() => go({ id: 'profile' })} aria-label={t('nav.profile')}>
          <span className={`avatar-frame avatar-frame--${p.loadout.frameId}`}>
            <Hero id={p.loadout.characterId} className="avatar-frame__hero" />
          </span>
          <span className="profile-chip__info">
            <span className="profile-chip__name">{p.nickname}</span>
            <span className="profile-chip__level">
              <span className="lvl-badge num">{lvl.level}</span>
              <ProgressBar value={lvl.progress} tone="gold" label={t('profile.level')} height={8} />
            </span>
          </span>
        </button>
        <div className="lobby__top-right">
          <Currency amount={p.shards} />
          <span className={`net-dot net-dot--${connStatus}`} title={connStatus === 'connected' ? t('common.online') : t('common.offline')} />
          <Button variant="ghost" size="sm" icon="trophy" aria-label={t('nav.leaderboard')} onClick={() => go({ id: 'leaderboard' })} />
          <Button variant="ghost" size="sm" icon="sparkle" aria-label={t('nav.customize')} onClick={() => go({ id: 'customize' })} />
          <Button variant="ghost" size="sm" icon="gear" aria-label={t('nav.settings')} onClick={() => go({ id: 'settings' })} />
        </div>
      </header>

      <main className="lobby__main">
        <aside className="lobby__col lobby__col--start">
          {tiles.slice(0, 3).map((tile) => (
            <button key={tile.key} type="button" className="tile lobby-tile" style={{ ['--tile-glow' as string]: tile.glow }} onClick={tile.onClick}>
              <span className="lobby-tile__icon">
                <Icon name={tile.icon} />
              </span>
              <span className="tile__title">{tile.title}</span>
              <span className="tile__sub">{tile.sub}</span>
            </button>
          ))}
        </aside>

        <section className="lobby__center">
          <div className="lobby__logo">
            <Logo />
          </div>
          <div className="lobby__stage">
            <div className="pedestal" aria-hidden="true">
              <span className="pedestal__ring" />
              <span className="pedestal__ring pedestal__ring--2" />
              <span className="pedestal__beam" />
            </div>
            <Hero id={p.loadout.characterId} animated className="lobby__hero" label={p.loadout.characterId} />
          </div>
          {inTour && (
            <button type="button" className="info-pill info-pill--gold" onClick={() => go({ id: 'tournament', tab: 'friends' })} data-testid="return-tournament">
              <Icon name="trophy" />
              <span>
                <span className="tiny muted">{t('tournament.entry')}</span>
                <strong>{t(`tournament.status.${tour!.status}` as MessageKey)}</strong>
              </span>
            </button>
          )}
          <div className="lobby__badges">
            <button type="button" className="info-pill" onClick={() => go({ id: 'leaderboard' })}>
              {best ? <RankEmblem tier={best.tier as 'gold'} division={best.division} size={34} /> : <Icon name="trophy" />}
              <span>
                <span className="tiny muted">{t('profile.rank')}</span>
                <strong>{best ? best.label : connStatus === 'connected' ? '—' : t('common.offline')}</strong>
              </span>
            </button>
            <button type="button" className="info-pill" onClick={() => go(est ? { id: 'profile' } : { id: 'placement' })}>
              <Icon name="brain" />
              <span>
                <span className="tiny muted">{t('lobby.englishLevel')}</span>
                <strong>{est?.status === 'estimated' ? `${est.level}` : t('lobby.takePlacement')}</strong>
              </span>
            </button>
          </div>
          <div className="lobby__play">
            <button type="button" className="mode-card" onClick={() => setModeOpen(true)} aria-label={t('lobby.changeMode')}>
              <span className="mode-card__icon">
                <Icon name={MODE_ICON[selected.id] ?? 'sword'} />
              </span>
              <span className="mode-card__text">
                <span className="tiny muted">{t('lobby.selectedMode')}</span>
                <strong>{t(`mode.${selected.id}` as MessageKey)}</strong>
              </span>
              <Icon name="refresh" className="mode-card__swap" />
            </button>
            <button type="button" className="btn btn-play" onClick={play} data-testid="play">
              <span>
                {t('lobby.play')}
                <span className="btn-play__sub">{selected.status === 'playable' ? (selected.online ? t('play.vsBot') : t('play.solo')) : t(`mode.status.${selected.status}`)}</span>
              </span>
            </button>
          </div>
        </section>

        <aside className="lobby__col lobby__col--end">
          {tiles.slice(3).map((tile) => (
            <button key={tile.key} type="button" className="tile lobby-tile" style={{ ['--tile-glow' as string]: tile.glow }} onClick={tile.onClick}>
              <span className="lobby-tile__icon">
                <Icon name={tile.icon} />
              </span>
              <span className="tile__title">{tile.title}</span>
              <span className="tile__sub">{tile.sub}</span>
            </button>
          ))}
          <div className="panel momentum">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong className="small">{t('lobby.momentum')}</strong>
              <span className="tiny muted">{t('lobby.momentumDays', { n: momentum.filter(Boolean).length })}</span>
            </div>
            <div className="momentum__days" dir="ltr">
              {momentum.map((on, i) => (
                <span key={i} className={`momentum__day ${on ? 'momentum__day--on' : ''}`}>
                  {(lang === 'he' ? ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'])[i]}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </main>

      <nav className="bottom-nav" aria-label="Main">
        {(
          [
            ['lobby', 'home', 'nav.lobby'],
            ['practice', 'target', 'nav.practice'],
            ['adventure', 'map', 'nav.adventure'],
            ['bagrut', 'book', 'nav.bagrut'],
            ['profile', 'user', 'nav.profile'],
          ] as const
        ).map(([id, icon, label]) => (
          <button key={id} type="button" className={`bottom-nav__item ${id === 'lobby' ? 'bottom-nav__item--active' : ''}`} onClick={() => id !== 'lobby' && go({ id } as never)}>
            <Icon name={icon} />
            <span>{t(label)}</span>
          </button>
        ))}
      </nav>

      <ModePicker open={modeOpen} onClose={() => setModeOpen(false)} />
      <Onboarding />
    </div>
  );
}

function ModePicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const selectMode = usePlayer((s) => s.selectMode);
  const selected = usePlayer((s) => s.selectedMode);
  const go = useNav((s) => s.go);
  return (
    <Dialog open={open} title={t('lobby.changeMode')} onClose={onClose}>
      <div className="mode-list">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`mode-row ${selected === m.id ? 'mode-row--active' : ''}`}
            onClick={() => {
              if (m.status === 'planned') {
                onClose();
                go({ id: 'mode-info', mode: m.id });
                return;
              }
              selectMode(m.id);
              onClose();
            }}
          >
            <span className="mode-row__icon">
              <Icon name={MODE_ICON[m.id] ?? 'sword'} />
            </span>
            <span className="mode-row__text">
              <strong>{t(`mode.${m.id}` as MessageKey)}</strong>
              <span className="tiny muted">{t(`mode.${m.id}.desc` as MessageKey)}</span>
            </span>
            <Chip tone={m.status === 'playable' ? 'good' : m.status === 'preview' ? 'purple' : undefined}>{t(`mode.status.${m.status}`)}</Chip>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

function Onboarding() {
  const t = useT();
  const onboarded = usePlayer((s) => s.onboarded);
  const nickname = usePlayer((s) => s.nickname);
  const setNickname = usePlayer((s) => s.setNickname);
  const setSelfLevel = usePlayer((s) => s.setSelfLevel);
  const setOnboarded = usePlayer((s) => s.setOnboarded);
  const language = useSettings((s) => s.language);
  const setSettings = useSettings((s) => s.set);
  const go = useNav((s) => s.go);
  const [name, setName] = useState(nickname);
  const [level, setLevel] = useState<(typeof CEFR_LEVELS)[number] | ''>('');
  if (onboarded) return null;
  const finish = (placement: boolean) => {
    setNickname(name);
    if (level) setSelfLevel(level);
    setOnboarded();
    if (placement) go({ id: 'placement' });
    else toast(t('lobby.welcome', { name }), 'good');
  };
  return (
    <Dialog open title={t('lobby.welcome', { name })} onClose={() => finish(false)}>
      <div className="stack">
        <p className="muted small">{t('lobby.guestBanner')}</p>
        <div className="field">
          <label className="field__label" htmlFor="nick">
            {t('profile.nickname')}
          </label>
          <input id="nick" className="input" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </div>
        <div className="field">
          <span className="field__label">{t('settings.language')}</span>
          <Segmented label={t('settings.language')} value={language} onChange={(v) => setSettings({ language: v })} options={[{ value: 'he', label: 'עברית' }, { value: 'en', label: 'English' }]} />
        </div>
        <div className="field">
          <span className="field__label">{t('placement.chooseSelf')}</span>
          <div className="row" dir="ltr">
            {CEFR_LEVELS.map((l) => (
              <button key={l} type="button" className={`level-chip ${level === l ? 'level-chip--on' : ''}`} onClick={() => setLevel(l)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="dialog__actions">
          <Button onClick={() => finish(false)}>{t('placement.skip')}</Button>
          <Button variant="primary" icon="brain" onClick={() => finish(true)}>
            {t('placement.start')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
