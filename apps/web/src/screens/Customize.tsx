import { useState } from 'react';
import { CHARACTERS, COSMETICS, VEHICLES, type Unlock } from '@lingua/shared';
import { Hero, Vehicle } from '../art/Art';
import { Icon } from '../art/icons';
import { Button, Chip, Panel, Segmented } from '../design';
import { useT, type MessageKey } from '../i18n';
import { VictoryEffect } from '../art/effects';
import { unlockedCharacters, unlockedCosmetics, unlockedVehicles, usePlayer } from '../state/player';
import { useNav } from '../state/nav';
import { sfx } from '../audio/sfx';

type Tab = 'characters' | 'vehicles' | 'titles' | 'frames' | 'arenas' | 'effects';

export function Customize() {
  const t = useT();
  const back = useNav((s) => s.back);
  const p = usePlayer();
  const select = (patch: Parameters<typeof p.equip>[0]) => {
    sfx.play('select');
    p.equip(patch);
  };
  const [tab, setTab] = useState<Tab>('characters');
  const chars = unlockedCharacters(p);
  const cars = unlockedVehicles(p);
  const cos = unlockedCosmetics(p);

  const lockText = (u: Unlock) =>
    u.kind === 'level' ? t('customize.unlockLevel', { n: u.level }) : u.kind === 'achievement' ? t('customize.unlockAchievement', { name: t(`achievement.${u.achievementId}` as MessageKey) }) : '';

  const kindMap: Record<Exclude<Tab, 'characters' | 'vehicles'>, { kind: (typeof COSMETICS)[number]['kind']; key: 'titleId' | 'frameId' | 'arenaId' | 'effectId' }> = {
    titles: { kind: 'title', key: 'titleId' },
    frames: { kind: 'frame', key: 'frameId' },
    arenas: { kind: 'arena-theme', key: 'arenaId' },
    effects: { kind: 'victory-effect', key: 'effectId' },
  };

  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{t('customize.title')}</h1>
      </div>
      <p className="small muted">{t('customize.cosmeticNote')}</p>
      <Segmented
        label={t('customize.title')}
        value={tab}
        onChange={setTab}
        options={(['characters', 'vehicles', 'titles', 'frames', 'arenas', 'effects'] as Tab[]).map((v) => ({ value: v, label: t(`customize.${v}` as MessageKey) }))}
      />
      <div className="grid-auto">
        {tab === 'characters' &&
          CHARACTERS.map((c) => {
            const unlocked = chars.includes(c.id);
            const equipped = p.loadout.characterId === c.id;
            return (
              <Panel key={c.id} className={`cos-card ${unlocked ? '' : 'cos-card--locked'}`}>
                <Hero id={c.id} animated={equipped} className="cos-card__hero" />
                <strong className="display">{c.name}</strong>
                <span className="tiny muted">{c.title}</span>
                {unlocked ? (
                  <Button variant={equipped ? 'default' : 'secondary'} size="sm" silent disabled={equipped} onClick={() => select({ characterId: c.id })}>
                    {equipped ? t('customize.equipped') : t('customize.equip')}
                  </Button>
                ) : (
                  <Chip icon="lock">{lockText(c.unlock)}</Chip>
                )}
              </Panel>
            );
          })}
        {tab === 'vehicles' &&
          VEHICLES.map((v) => {
            const unlocked = cars.includes(v.id);
            const equipped = p.loadout.vehicleId === v.id;
            return (
              <Panel key={v.id} className={`cos-card ${unlocked ? '' : 'cos-card--locked'}`}>
                <Vehicle id={v.id} className="cos-card__car" />
                <strong className="display">{v.name}</strong>
                {unlocked ? (
                  <Button variant={equipped ? 'default' : 'secondary'} size="sm" silent disabled={equipped} onClick={() => select({ vehicleId: v.id })}>
                    {equipped ? t('customize.equipped') : t('customize.equip')}
                  </Button>
                ) : (
                  <Chip icon="lock">{lockText(v.unlock)}</Chip>
                )}
              </Panel>
            );
          })}
        {tab !== 'characters' &&
          tab !== 'vehicles' &&
          COSMETICS.filter((c) => c.kind === kindMap[tab].kind).map((c) => {
            const unlocked = cos.includes(c.id);
            const key = kindMap[tab].key;
            const equipped = p.loadout[key] === c.id;
            return (
              <Panel key={c.id} className={`cos-card ${unlocked ? '' : 'cos-card--locked'}`}>
                {tab === 'frames' ? (
                  <span className={`avatar-frame avatar-frame--lg avatar-frame--${c.id}`}>
                    <Hero id={p.loadout.characterId} className="avatar-frame__hero" />
                  </span>
                ) : tab === 'effects' ? (
                  <VictoryEffect id={c.id} preview />
                ) : (
                  <Icon name={tab === 'titles' ? 'crown' : tab === 'arenas' ? 'castle' : 'sparkle'} style={{ width: 48, height: 48, color: 'var(--c-gold)' }} />
                )}
                <strong className="display">{c.name}</strong>
                {unlocked ? (
                  <Button variant={equipped ? 'default' : 'secondary'} size="sm" silent disabled={equipped} onClick={() => select({ [key]: c.id })}>
                    {equipped ? t('customize.equipped') : t('customize.equip')}
                  </Button>
                ) : (
                  <Chip icon="lock">{lockText(c.unlock)}</Chip>
                )}
              </Panel>
            );
          })}
      </div>
    </div>
  );
}
