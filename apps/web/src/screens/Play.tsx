import { useEffect, useState } from 'react';
import { BOT_TIERS, BRACKET_LEVELS, BRACKETS, bracketForLevel, MODES, type Bracket, type BotTier, type GameModeId, type OnlineModeId } from '@lingua/shared';
import { recommendedLevel } from '@lingua/learning';
import { WORD_BATTLE_SETS } from '@lingua/content';
import { Hero, Vehicle } from '../art/Art';
import { Icon } from '../art/icons';
import { Button, Chip, Panel, Segmented, StateMessage } from '../design';
import { useT, useLang, type MessageKey } from '../i18n';
import { usePlayer } from '../state/player';
import { useNav } from '../state/nav';
import { checkServer } from '../net/api';
import { connection, useConnection } from '../net/connection';

export function Play({ initialMode }: { initialMode?: GameModeId }) {
  const t = useT();
  const lang = useLang();
  const go = useNav((s) => s.go);
  const back = useNav((s) => s.back);
  const learner = usePlayer((s) => s.learner);
  const loadout = usePlayer((s) => s.loadout);
  const playable = MODES.filter((m) => m.status === 'playable');
  const [mode, setMode] = useState<OnlineModeId>((playable.find((m) => m.id === initialMode)?.id as OnlineModeId) ?? 'word-battle');
  const [bracket, setBracket] = useState<Bracket>(bracketForLevel(recommendedLevel(learner)));
  const [tier, setTier] = useState<BotTier>('adept');
  const [setId, setSetId] = useState<string>('');
  const [server, setServer] = useState<'checking' | 'up' | 'down'>('checking');
  const status = useConnection((s) => s.status);

  useEffect(() => {
    let alive = true;
    void checkServer().then((r) => alive && setServer(r.ok ? 'up' : 'down'));
    return () => {
      alive = false;
    };
  }, []);

  const levels = [...BRACKET_LEVELS[bracket]];
  const startBot = () => go({ id: 'match', params: { kind: 'local', mode, levels, botTier: tier, ...(setId && mode === 'word-battle' ? { setId } : {}) } });
  const startOnline = async (flow: 'queue' | 'room', queue?: 'ranked' | 'casual') => {
    const ok = await connection.connect();
    if (!ok) {
      setServer('down');
      return;
    }
    go({ id: 'online', mode, flow, ...(queue ? { queue } : {}), bracket });
  };

  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{t('play.title')}</h1>
      </div>

      <div className="mode-picker" role="radiogroup" aria-label={t('play.mode')}>
        {playable.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className={`mode-big ${mode === m.id ? 'mode-big--on' : ''}`} onClick={() => setMode(m.id as OnlineModeId)}>
            <div className="mode-big__art">
              {m.id === 'grammar-race' ? <Vehicle id={loadout.vehicleId} /> : <Hero id={m.id === 'sentence-master' ? 'kael' : loadout.characterId} />}
            </div>
            <strong className="mode-big__name display">{t(`mode.${m.id}` as MessageKey)}</strong>
            <span className="tiny muted">{t(`mode.${m.id}.desc` as MessageKey)}</span>
            <Chip>{m.players}</Chip>
          </button>
        ))}
      </div>

      <Panel title={t('play.bracket')}>
        <Segmented label={t('play.bracket')} value={bracket} onChange={setBracket} options={BRACKETS.map((b) => ({ value: b, label: t(`play.bracket.${b}` as MessageKey) }))} />
      </Panel>

      <div className="grid-auto">
        <Panel title={t('play.vsBot')}>
          <p className="small muted">{t('play.vsBotSub')}</p>
          <div className="field">
            <span className="field__label">{t('play.botLevel')}</span>
            <Segmented label={t('play.botLevel')} value={tier} onChange={setTier} options={BOT_TIERS.map((b) => ({ value: b, label: t(`bot.${b}` as MessageKey) }))} />
          </div>
          {mode === 'word-battle' && (
            <div className="field">
              <label className="field__label" htmlFor="set">
                {t('play.set')}
              </label>
              <select id="set" className="input" value={setId} onChange={(e) => setSetId(e.target.value)}>
                <option value="">{t('play.anySet')}</option>
                {WORD_BATTLE_SETS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {lang === 'he' ? s.nameHe : s.name} ({s.levels.join('–')})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="row">
            <Button variant="primary" size="lg" icon="play" onClick={startBot} data-testid="start-bot">
              {t('common.start')}
            </Button>
            {mode === 'sentence-master' && (
              <Button variant="secondary" icon="puzzle" onClick={() => go({ id: 'sentence-practice', levels })}>
                {t('sentence.practice')}
              </Button>
            )}
          </div>
        </Panel>

        <Panel title={t('common.online')}>
          {server === 'down' ? (
            <StateMessage icon="wifiOff" title={t('common.offline')}>
              <p className="small">{t('play.serverOffline')}</p>
            </StateMessage>
          ) : (
            <div className="stack">
              <p className="small muted">{t('queue.noBots').split('?')[0]}.</p>
              <Button variant="secondary" icon="globe" disabled={server !== 'up'} onClick={() => void startOnline('queue', 'casual')} data-testid="casual">
                {t('play.casual')}
              </Button>
              <Button variant="arcane" icon="trophy" disabled={server !== 'up'} onClick={() => void startOnline('queue', 'ranked')} data-testid="ranked">
                {t('play.ranked')}
              </Button>
              <Button icon="users" disabled={server !== 'up'} onClick={() => void startOnline('room')} data-testid="private-room">
                {t('play.private')}
              </Button>
              <span className="tiny muted">
                <Icon name="info" style={{ width: 14, height: 14, verticalAlign: 'middle' }} /> {status === 'connected' ? t('common.online') : server === 'checking' ? t('common.loading') : ''}
              </span>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
