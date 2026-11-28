import { useEffect, useState } from 'react';
import { COSMETICS, journeyProgress, SKILLS, type GameModeId } from '@lingua/shared';
import { estimateAll, masteredTags, topErrors, upcomingReviews, weakTopics, dueReviews } from '@lingua/learning';
import { Hero, RankEmblem } from '../art/Art';
import { Icon } from '../art/icons';
import { Button, Chip, Dialog, En, Panel, ProgressBar, Stat, StateMessage } from '../design';
import { useT, type MessageKey } from '../i18n';
import { ACHIEVEMENTS, journeyMetrics, playerLevel, usePlayer } from '../state/player';
import { useNav } from '../state/nav';
import { useConnection } from '../net/connection';
import { TitleBadge } from '../games/shared/components';
import { fetchMyRatings, fetchMyWallet, type RemoteRating, type RemoteWallet } from '../net/api';

function humanTag(tag: string): string {
  return tag.replace(/^[vgi]:/, '').replace(/-/g, ' ');
}

function relTime(ms: number, lang: (k: MessageKey, v?: Record<string, string | number>) => string): string {
  const m = Math.round(ms / 60000);
  if (m < 60) return lang('profile.in', { t: `${m} min` });
  const h = Math.round(m / 60);
  if (h < 48) return lang('profile.in', { t: `${h} h` });
  return lang('profile.in', { t: `${Math.round(h / 24)} d` });
}

export function Profile() {
  const t = useT();
  const back = useNav((s) => s.back);
  const go = useNav((s) => s.go);
  const p = usePlayer();
  const lvl = playerLevel(p.xp);
  const status = useConnection((s) => s.status);
  const [ratings, setRatings] = useState<RemoteRating[] | null>(null);
  const [wallet, setWallet] = useState<RemoteWallet | null>(null);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState(p.nickname);
  const now = Date.now();

  useEffect(() => {
    if (status !== 'connected') return;
    fetchMyRatings().then(setRatings).catch(() => setRatings(null));
    fetchMyWallet().then(setWallet).catch(() => setWallet(null));
  }, [status]);

  const ests = estimateAll(p.learner);
  const matches = p.matches.filter((m) => m.result !== 'complete');
  const wins = matches.filter((m) => m.result === 'win').length;
  const losses = matches.filter((m) => m.result === 'loss').length;
  const draws = matches.filter((m) => m.result === 'draw').length;
  const modeCounts = new Map<GameModeId, number>();
  for (const m of p.matches) modeCounts.set(m.mode, (modeCounts.get(m.mode) ?? 0) + 1);
  const fav = [...modeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const words = masteredTags(p.learner, 'v:');
  const grammar = masteredTags(p.learner, 'g:');
  const weak = weakTopics(p.learner);
  const errors = topErrors(p.learner);
  const upcoming = upcomingReviews(p.learner, now, 6);
  const due = dueReviews(p.learner, now);

  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{t('profile.title')}</h1>
      </div>

      <Panel gold className="profile-hero">
        <div className={`avatar-frame avatar-frame--lg avatar-frame--${p.loadout.frameId}`}>
          <Hero id={p.loadout.characterId} className="avatar-frame__hero" />
        </div>
        <div className="stack" style={{ flex: 1, minWidth: 200 }}>
          <div className="row">
            <h2 className="display" style={{ fontSize: 'var(--fs-2xl)' }}>
              {p.nickname}
            </h2>
            <Button variant="ghost" size="sm" icon="pen" aria-label={t('profile.editName')} onClick={() => setEditName(true)} />
          </div>
          <div className="row">
            <Chip tone="gold" icon="star">
              {t('profile.level')} {lvl.level}
            </Chip>
            <Chip>{t('common.guest')}</Chip>
            <TitleBadge id={p.loadout.titleId} />
            {p.learner.placement && <Chip tone="good">{t('profile.placementDone')}</Chip>}
          </div>
          <ProgressBar value={lvl.progress} tone="gold" label={t('profile.level')} />
          <div className="row">
            <Button size="sm" icon="sparkle" onClick={() => go({ id: 'customize' })} data-testid="profile-customize">
              {t('nav.customize')}
            </Button>
          </div>
          <p className="tiny muted">{t('profile.privacyNote')}</p>
        </div>
      </Panel>

      <Panel title={t('journey.title')} data-testid="journey">
        <p className="small muted" style={{ marginBottom: 12 }}>
          {t('journey.intro')}
        </p>
        <ul className="journey">
          {journeyProgress(journeyMetrics(p)).map(({ milestone, value, done }) => {
            const reward = COSMETICS.find((c) => c.unlock.kind === 'achievement' && c.unlock.achievementId === milestone.id);
            const share = Math.min(1, value / milestone.target);
            return (
              <li key={milestone.id} className={`journey__item ${done ? 'journey__item--done' : ''}`}>
                <span className="journey__ring" style={{ ['--p' as string]: share }} role="img" aria-label={`${Math.round(share * 100)}%`}>
                  <Icon name={done ? 'check' : milestone.metric === 'words' ? 'book' : milestone.metric === 'grammar' ? 'brain' : milestone.metric === 'modes' ? 'map' : 'star'} />
                </span>
                <span className="journey__body">
                  <strong className="small">{t(`achievement.${milestone.id}` as MessageKey)}</strong>
                  <span className="num tiny muted" dir="ltr">
                    {done ? t('journey.done') : `${value}/${milestone.target}`}
                  </span>
                  <span className="tiny muted">{t(`achievement.${milestone.id}.desc` as MessageKey)}</span>
                  {reward && (
                    <span className={`journey__reward ${done ? 'is-earned' : ''}`}>
                      <Icon name={reward.kind === 'title' ? 'crown' : 'sparkle'} />
                      <span className="en" dir="ltr">
                        {reward.name}
                      </span>
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="grid-auto">
        <Panel title={t('profile.matches')}>
          {matches.length === 0 ? (
            <p className="muted small">{t('profile.noData')}</p>
          ) : (
            <div className="stats-row">
              <Stat value={matches.length} label={t('profile.matches')} />
              <Stat value={wins} label={t('profile.wins')} />
              <Stat value={losses} label={t('profile.losses')} />
              <Stat value={draws} label={t('profile.draws')} />
              <Stat value={`${Math.round((wins / Math.max(1, matches.length)) * 100)}%`} label={t('profile.winRate')} />
            </div>
          )}
          {fav && (
            <p className="small" style={{ marginTop: 12 }}>
              {t('profile.favoriteMode')}: <strong>{t(`mode.${fav}` as MessageKey)}</strong>
            </p>
          )}
        </Panel>
        <Panel title={t('profile.rank')}>
          {wallet && (
            <div className="stats-row" style={{ marginBottom: 12 }} data-testid="server-wallet">
              <Stat value={wallet.xp} label={t('profile.serverXp')} />
              <Stat value={wallet.shards} label={t('profile.serverShards')} />
              <Stat value={wallet.achievements.length} label={t('profile.serverAchievements')} />
            </div>
          )}
          {status !== 'connected' ? (
            <p className="small muted">{t('profile.offlineRank')}</p>
          ) : !ratings || ratings.length === 0 ? (
            <p className="small muted">{t('leaderboard.empty')}</p>
          ) : (
            <div className="stack">
              {ratings.map((r) => (
                <div key={`${r.mode}:${r.bracket}`} className="row">
                  <RankEmblem tier={r.tier as 'gold'} division={r.division} size={44} />
                  <div className="stack" style={{ gap: 0 }}>
                    <strong>{r.label}</strong>
                    <span className="tiny muted">
                      {t(`mode.${r.mode}` as MessageKey)} · {t(`play.bracket.${r.bracket}` as MessageKey)} · {r.rating} MMR
                      {r.placement ? ` · ${t('result.placement', { played: r.placement.played, total: r.placement.total })}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title={t('profile.englishEstimate')}>
        <p className="tiny muted" style={{ marginBottom: 12 }}>
          {t('profile.estimateDisclaimer')}
        </p>
        <div className="skills">
          {ests.map((e) => (
            <div key={e.skill} className="skill">
              <span className="skill__name">{t(`skill.${e.skill}` as MessageKey)}</span>
              {e.status === 'estimated' ? (
                <>
                  <span className="skill__level en">{e.level}</span>
                  <ProgressBar value={Math.max(0.05, Math.min(1, (e.theta + 3) / 6))} label={t(`skill.${e.skill}` as MessageKey)} />
                  <span className="tiny muted">
                    {t(`profile.confidence.${e.confidence}` as MessageKey)} · {t('profile.answers', { n: e.n })}
                  </span>
                </>
              ) : (
                <span className="tiny muted skill__na">{t('common.notAssessed')}</span>
              )}
            </div>
          ))}
        </div>
        {!p.learner.placement && (
          <Button variant="secondary" icon="brain" onClick={() => go({ id: 'placement' })} style={{ marginTop: 16 }}>
            {t('lobby.takePlacement')}
          </Button>
        )}
        <span className="sr-only">{SKILLS.length}</span>
      </Panel>

      <div className="grid-auto">
        <Panel title={t('profile.wordsMastered')}>
          <Stat value={words.length} label={t('profile.wordsMastered')} />
          <div className="row tags">
            {words.slice(0, 18).map((w) => (
              <span key={w} className="chip chip--good">
                <En>{w}</En>
              </span>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <Stat value={grammar.length} label={t('profile.grammarMastered')} />
          </div>
        </Panel>
        <Panel title={t('profile.needsWork')}>
          {weak.length === 0 ? (
            <p className="muted small">{t('profile.noData')}</p>
          ) : (
            <div className="stack">
              {weak.map((m) => (
                <div key={m.tag}>
                  <div className="row small" style={{ justifyContent: 'space-between' }}>
                    <En>{humanTag(m.tag)}</En>
                    <span className="tiny muted num">
                      {m.correct}/{m.attempts}
                    </span>
                  </div>
                  <ProgressBar value={m.mastery} tone="purple" label={humanTag(m.tag)} />
                </div>
              ))}
            </div>
          )}
          {errors.length > 0 && (
            <>
              <hr className="divider" />
              <span className="tiny muted">{t('profile.errors')}</span>
              <div className="row tags">
                {errors.map((e) => (
                  <span key={e.category} className="chip chip--bad">
                    <En>{e.category.replace(/-/g, ' ')}</En> ×{e.count}
                  </span>
                ))}
              </div>
            </>
          )}
        </Panel>
        <Panel title={t('profile.scheduled')}>
          {due.length > 0 && (
            <Button variant="primary" size="sm" icon="target" onClick={() => go({ id: 'practice', focus: 'review' })} style={{ marginBottom: 12 }}>
              {t('profile.due')}: {due.length}
            </Button>
          )}
          {upcoming.length === 0 && due.length === 0 ? (
            <p className="muted small">{t('profile.noData')}</p>
          ) : (
            <ul className="plain-list">
              {upcoming.map((r) => (
                <li key={r.tag} className="row small" style={{ justifyContent: 'space-between' }}>
                  <En>{humanTag(r.tag)}</En>
                  <span className="tiny muted">{relTime(r.dueAt - now, t)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title={t('profile.achievements')}>
        <div className="achievements">
          {ACHIEVEMENTS.map((a) => {
            const have = p.achievements.includes(a);
            return (
              <div key={a} className={`achv ${have ? 'achv--on' : ''}`}>
                <Icon name={have ? 'trophy' : 'lock'} />
                <strong className="small">{t(`achievement.${a}` as MessageKey)}</strong>
                <span className="tiny muted">{t(`achievement.${a}.desc` as MessageKey)}</span>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title={t('profile.matchHistory')}>
        {p.matches.length === 0 ? (
          <StateMessage icon="chart" title={t('profile.noData')} />
        ) : (
          <div className="history">
            {p.matches.slice(0, 15).map((m) => (
              <div key={m.id} className={`history__row history__row--${m.result}`}>
                <span className="history__res">{m.result === 'win' ? t('result.victory') : m.result === 'loss' ? t('result.defeat') : m.result === 'draw' ? t('result.draw') : '✓'}</span>
                <span>{t(`mode.${m.mode}` as MessageKey)}</span>
                <span className="tiny muted">
                  {m.opponent ? `${t('common.vs')} ${m.opponent.nickname}${m.opponent.isBot ? ` (${t('common.bot')})` : ''}` : ''}
                </span>
                <span className="num small">{Math.round(m.accuracy * 100)}%</span>
                <span className="tiny muted">{new Date(m.at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Dialog
        open={editName}
        title={t('profile.editName')}
        onClose={() => setEditName(false)}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              p.setNickname(name);
              setEditName(false);
            }}
          >
            {t('common.save')}
          </Button>
        }
      >
        <input className="input" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} aria-label={t('profile.nickname')} />
      </Dialog>
    </div>
  );
}
