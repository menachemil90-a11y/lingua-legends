import { useEffect, useState } from 'react';
import type { PublicPlayer, ServerMessageOf } from '@lingua/shared';
import { Hero, RankEmblem } from '../../art/Art';
import { Icon } from '../../art/icons';
import { BotBadge, Button, Chip, En, Panel, ProgressBar, Stat } from '../../design';
import { useT, type MessageKey } from '../../i18n';
import { sfx } from '../../audio/sfx';
import { playerLevel, usePlayer } from '../../state/player';
import { Explanation } from './components';
import type { MatchSummary } from './finalize';
import type { Mistake } from './useMatch';

export function PostMatch({
  end,
  summary,
  mistakes,
  players,
  selfId,
  onRematch,
  onLobby,
  rematchLabel,
  rematchPending,
  rematchRequestedByOpponent,
  extraStats,
}: {
  end: ServerMessageOf<'MATCH_END'>;
  summary: MatchSummary;
  mistakes: Mistake[];
  players: PublicPlayer[];
  selfId: string;
  onRematch?: () => void;
  onLobby: () => void;
  rematchLabel?: string;
  rematchPending?: boolean;
  rematchRequestedByOpponent?: boolean;
  extraStats?: React.ReactNode;
}) {
  const t = useT();
  const [showReview, setShowReview] = useState(false);
  const xp = usePlayer((s) => s.xp);
  const loadout = usePlayer((s) => s.loadout);
  const me = players.find((p) => p.playerId === selfId);
  const foe = players.find((p) => p.playerId !== selfId);
  const mine = end.stats.find((s) => s.playerId === selfId);
  const lvl = playerLevel(xp);

  useEffect(() => {
    sfx.play(summary.result === 'win' ? 'victory' : summary.result === 'loss' ? 'defeat' : 'heal');
    if (end.ratingChange?.promoted) setTimeout(() => sfx.play('promote'), 1400);
    else if (summary.levelAfter > summary.levelBefore) setTimeout(() => sfx.play('levelup'), 1400);
  }, [summary, end.ratingChange]);

  const word = summary.result === 'win' ? t('result.victory') : summary.result === 'loss' ? t('result.defeat') : t('result.draw');
  const cheer = summary.result === 'win' ? t('result.winCheer') : summary.result === 'loss' ? t('result.lossEncourage') : t('result.drawCheer');
  const avg = mine?.avgResponseMs ? `${(mine.avgResponseMs / 1000).toFixed(1)}s` : '—';
  const rc = end.ratingChange;

  return (
    <div className="post">
      <div className={`result-banner result-banner--${summary.result === 'win' ? 'win' : summary.result === 'loss' ? 'loss' : 'draw'}`}>
        {summary.result === 'win' && <div className="post__rays" aria-hidden="true" />}
        <div className="post__heroes">
          <Hero id={me?.characterId ?? loadout.characterId} className={`post__hero ${summary.result === 'win' ? 'post__hero--win' : ''}`} />
        </div>
        <h1 className="result-banner__word">{word}</h1>
        <p className="muted">{t(`result.reason.${end.reason}` as MessageKey)}</p>
        <p>{cheer}</p>
        {foe && (
          <div className="row tiny muted" style={{ justifyContent: 'center' }}>
            {t('common.vs')} <strong>{foe.nickname}</strong> {foe.isBot && <BotBadge tier={foe.botTier ? t(`bot.${foe.botTier}` as MessageKey) : undefined} />}
          </div>
        )}
      </div>

      <div className="post__grid">
        <Panel title={t('result.accuracy')}>
          <div className="post__acc">
            <div className="post__ring" style={{ ['--p' as string]: summary.accuracy }}>
              <span className="num">{Math.round(summary.accuracy * 100)}%</span>
            </div>
            <div className="post__stats">
              <Stat value={mine?.correct ?? 0} label={t('result.correct')} />
              <Stat value={mine?.incorrect ?? 0} label={t('result.incorrect')} />
              <Stat value={avg} label={t('result.avgTime')} />
              <Stat value={mine?.bestCombo ?? 0} label={t('result.bestCombo')} />
              {mine?.position !== undefined && <Stat value={`#${mine.position}`} label={t('result.position')} />}
              {mine?.score !== undefined && <Stat value={mine.score} label={t('result.score')} />}
            </div>
          </div>
          {extraStats}
        </Panel>

        <Panel title={t('result.xp')} gold>
          <div className="stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <Chip tone="gold" icon="star">
                +{summary.xp} XP
              </Chip>
              <Chip tone="purple" icon="gem">
                +{summary.shards} {t('result.shards')}
              </Chip>
            </div>
            <div className="row tiny muted" style={{ justifyContent: 'space-between' }}>
              <span>
                {t('common.level')} {lvl.level}
              </span>
              <span className="num">
                {lvl.into}/{lvl.needed}
              </span>
            </div>
            <ProgressBar value={lvl.progress} tone="gold" label={t('profile.level')} />
            {summary.levelAfter > summary.levelBefore && (
              <div className="post__levelup">
                <Icon name="sparkle" /> {t('result.levelUp', { n: summary.levelAfter })}
              </div>
            )}
            {summary.stars !== null && (
              <div className="row" aria-label={t('adventure.stars', { n: summary.stars })}>
                {[0, 1, 2].map((i) => (
                  <Icon key={i} name="star" filled={i < summary.stars!} style={{ width: 30, height: 30, color: i < summary.stars! ? 'var(--c-gold)' : 'var(--c-text-mute)', fillOpacity: i < summary.stars! ? 1 : 0.1 }} />
                ))}
              </div>
            )}
            {summary.unlocked.length > 0 && (
              <div className="stack">
                {summary.unlocked.map((a) => (
                  <Chip key={a} tone="good" icon="trophy">
                    {t('result.unlocked')}: {t(`achievement.${a}` as MessageKey)}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        </Panel>

        {rc && (
          <Panel title={t('result.rankChange')}>
            <div className="row">
              <RankEmblem tier={rc.rankAfter.tier} division={rc.rankAfter.division} size={72} />
              <div className="stack" style={{ gap: 4 }}>
                <strong>{rc.rankAfter.label}</strong>
                <span className={`num ${rc.delta >= 0 ? 'text-good' : 'text-bad'}`}>
                  {rc.delta >= 0 ? '+' : ''}
                  {rc.delta} MMR ({rc.after})
                </span>
                {rc.placement && <span className="tiny muted">{t('result.placement', { played: rc.placement.played, total: rc.placement.total })}</span>}
                {rc.promoted && <span className="post__promoted display">{t('result.promoted')}</span>}
              </div>
            </div>
            <ProgressBar value={rc.rankAfter.progress} tone="purple" label={t('result.rankChange')} />
          </Panel>
        )}
      </div>

      <Panel title={t('result.mistakes')}>
        {mistakes.length === 0 ? (
          <p className="muted">{t('result.noMistakes')}</p>
        ) : (
          <div className="stack">
            <p className="small muted">{t('result.reviewLater')}</p>
            {(showReview ? mistakes : mistakes.slice(0, 2)).map((m, i) => (
              <article key={i} className="mistake">
                {m.context && (
                  <En as="p" className="mistake__ctx">
                    {m.context}
                  </En>
                )}
                <En as="p" className="mistake__prompt">
                  {m.prompt}
                </En>
                <div className="row small">
                  {m.yourAnswer && (
                    <Chip tone="bad" icon="x">
                      <En>{m.yourAnswer}</En>
                    </Chip>
                  )}
                  <Chip tone="good" icon="check">
                    <En>{m.correctAnswer}</En>
                  </Chip>
                </div>
                <Explanation exp={m.explanation} feedback={m.feedback} example={m.example} />
              </article>
            ))}
            {mistakes.length > 2 && !showReview && (
              <Button variant="ghost" size="sm" onClick={() => setShowReview(true)} icon="book">
                {t('result.review')} ({mistakes.length})
              </Button>
            )}
          </div>
        )}
      </Panel>

      {rematchRequestedByOpponent && <p className="post__note">{t('result.rematchRequested')}</p>}
      {rematchPending && <p className="post__note muted">{t('result.rematchWaiting')}</p>}

      <div className="post__actions">
        {onRematch && (
          <Button variant="primary" size="lg" icon="refresh" onClick={onRematch} disabled={rematchPending}>
            {rematchLabel ?? t('result.rematch')}
          </Button>
        )}
        {mistakes.length > 0 && (
          <Button variant="secondary" size="lg" icon="book" onClick={() => setShowReview(true)}>
            {t('result.review')}
          </Button>
        )}
        <Button size="lg" icon="home" onClick={onLobby}>
          {t('result.lobby')}
        </Button>
      </div>
    </div>
  );
}
