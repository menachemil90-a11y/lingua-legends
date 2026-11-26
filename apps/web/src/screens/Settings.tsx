import { useEffect, useState } from 'react';
import { Button, Dialog, Panel, Segmented, Toggle, toast } from '../design';
import { useT } from '../i18n';
import { useSettings } from '../state/settings';
import { usePlayer } from '../state/player';
import { useNav } from '../state/nav';
import { clearAllLocalData } from '../state/storage';
import { checkServer } from '../net/api';
import { connection, useConnection } from '../net/connection';
import { getSupabase, requestAccountDeletion, signInWithEmail, signOut, supabaseConfigured } from '../data/supabase';
import { sfx } from '../audio/sfx';

export function Settings() {
  const t = useT();
  const back = useNav((s) => s.back);
  const s = useSettings();
  const player = usePlayer();
  const conn = useConnection();
  const [serverUrl, setServerUrl] = useState(s.serverUrl);
  const [health, setHealth] = useState<string>('…');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [email, setEmail] = useState('');
  const [session, setSession] = useState<string | null>(null);

  useEffect(() => {
    void checkServer().then((h) => setHealth(h.ok ? `OK${h.supabase ? ' · Supabase' : ''}` : t('common.offline')));
  }, [s.serverUrl, t]);

  useEffect(() => {
    void getSupabase().then(async (sb) => {
      if (!sb) return;
      const { data } = await sb.auth.getSession();
      setSession(data.session?.user.email ?? null);
    });
  }, []);

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), player: usePlayer.getState(), settings: useSettings.getState() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lingua-legends-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{t('settings.title')}</h1>
      </div>

      <div className="grid-auto">
        <Panel title={t('settings.language')}>
          <div className="stack">
            <Segmented label={t('settings.language')} value={s.language} onChange={(v) => s.set({ language: v })} options={[{ value: 'he', label: 'עברית' }, { value: 'en', label: 'English' }]} />
            <span className="field__label">{t('settings.explanations')}</span>
            <Segmented
              label={t('settings.explanations')}
              value={s.explanations}
              onChange={(v) => s.set({ explanations: v })}
              options={[
                { value: 'he', label: t('settings.explanations.he') },
                { value: 'en', label: t('settings.explanations.en') },
                { value: 'both', label: t('settings.explanations.both') },
              ]}
            />
            <Toggle checked={s.immersion} onChange={(v) => s.set({ immersion: v })} label={t('settings.immersion')} description={t('settings.immersionDesc')} />
          </div>
        </Panel>

        <Panel title={t('settings.music')}>
          <div className="stack">
            <label className="field">
              <span className="field__label">{t('settings.music')}</span>
              <input className="range" type="range" min={0} max={1} step={0.05} value={s.musicVolume} onChange={(e) => s.set({ musicVolume: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span className="field__label">{t('settings.sfx')}</span>
              <input
                className="range"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={s.sfxVolume}
                onChange={(e) => s.set({ sfxVolume: Number(e.target.value) })}
                onMouseUp={() => sfx.play('correct')}
                onTouchEnd={() => sfx.play('correct')}
              />
            </label>
            <Toggle checked={s.muted} onChange={(v) => s.set({ muted: v })} label={t('settings.mute')} />
            <Toggle checked={s.visualCues} onChange={(v) => s.set({ visualCues: v })} label={t('settings.captions')} description={t('settings.captionsDesc')} />
          </div>
        </Panel>

        <Panel title={t('settings.reducedMotion')}>
          <div className="stack">
            <Toggle checked={s.reducedMotion} onChange={(v) => s.set({ reducedMotion: v })} label={t('settings.reducedMotion')} description={t('settings.reducedMotionDesc')} />
            <Toggle checked={s.highContrast} onChange={(v) => s.set({ highContrast: v })} label={t('settings.highContrast')} />
          </div>
        </Panel>

        <Panel title={t('settings.account')}>
          <div className="stack">
            {!supabaseConfigured ? (
              <>
                <p className="small">{t('settings.guestAccount')}</p>
                <p className="tiny muted">{t('settings.cloudUnavailable')}</p>
              </>
            ) : session ? (
              <>
                <p className="small">{session}</p>
                <Button icon="logout" onClick={() => void signOut().then(() => setSession(null))}>
                  {t('settings.signOut')}
                </Button>
              </>
            ) : (
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  void signInWithEmail(email).then((r) => toast(r.ok ? t('settings.linkSent') : t('error.server', { msg: r.error ?? '' }), r.ok ? 'good' : 'bad'));
                }}
              >
                <label className="field">
                  <span className="field__label">{t('settings.email')}</span>
                  <input className="input en" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </label>
                <Button type="submit" variant="secondary">
                  {t('settings.sendLink')}
                </Button>
              </form>
            )}
          </div>
        </Panel>

        <Panel title={t('settings.server')}>
          <div className="stack">
            <label className="field">
              <span className="field__label">{t('settings.serverUrl')}</span>
              <input className="input en" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} onBlur={() => s.set({ serverUrl: serverUrl.trim() })} inputMode="url" />
            </label>
            <p className="small">
              {t('settings.serverStatus')}: <strong>{health}</strong> · WS: {conn.status}
              {conn.latencyMs !== null ? ` · ${conn.latencyMs}ms` : ''}
            </p>
            <div className="row">
              <Button size="sm" icon="refresh" onClick={() => void connection.connect()}>
                {t('common.online')}
              </Button>
              <Button size="sm" icon="wifiOff" onClick={() => connection.disconnect()}>
                {t('common.offline')}
              </Button>
            </div>
          </div>
        </Panel>

        <Panel title={t('settings.data')}>
          <div className="stack">
            <Button icon="share" onClick={exportData}>
              {t('settings.export')}
            </Button>
            <Button variant="danger" icon="x" onClick={() => setConfirmDelete(true)}>
              {t('settings.delete')}
            </Button>
            {supabaseConfigured && session && (
              <Button variant="danger" icon="x" onClick={() => void requestAccountDeletion().then((r) => toast(r.ok ? 'OK' : r.error ?? '', r.ok ? 'good' : 'bad'))}>
                {t('settings.deleteCloud')}
              </Button>
            )}
          </div>
        </Panel>
      </div>

      <Panel title={t('settings.about')}>
        <p className="small">{t('settings.aboutText')}</p>
        <p className="tiny muted" style={{ marginTop: 8 }}>
          {t('settings.licenses')}
        </p>
        <p className="tiny muted">Lingua Legends v0.1.0 · {player.playerId}</p>
      </Panel>

      <Dialog
        open={confirmDelete}
        title={t('settings.delete')}
        onClose={() => setConfirmDelete(false)}
        actions={
          <>
            <Button onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              onClick={() => {
                connection.disconnect();
                clearAllLocalData();
                player.reset();
                window.location.reload();
              }}
            >
              {t('settings.delete')}
            </Button>
          </>
        }
      >
        <p>{t('settings.deleteConfirm')}</p>
      </Dialog>
    </div>
  );
}
