import { describe, expect, it } from 'vitest';
import { sanitizeCosmetics, verifiedCosmetics } from '../src/hub';

describe('cosmetics shown to other players', () => {
  it('accepts every catalog hero and vehicle (including new ones) and rejects unknown ids', () => {
    expect(sanitizeCosmetics({ characterId: 'liora', vehicleId: 'aurum' })).toMatchObject({ characterId: 'liora', vehicleId: 'aurum' });
    expect(sanitizeCosmetics({ characterId: 'brann', vehicleId: 'ember' }).characterId).toBe('brann');
    expect(sanitizeCosmetics({ characterId: 'mira', vehicleId: 'comet' }).characterId).toBe('mira');
    expect(sanitizeCosmetics({ characterId: 'not-a-hero', vehicleId: 'x' })).toMatchObject({ characterId: 'vexa', vehicleId: 'comet' });
  });

  it('passes on default titles/frames, and earned ones only when the server recorded the achievement', () => {
    const base = sanitizeCosmetics({ characterId: 'kael', vehicleId: 'viper', titleId: 'title-tournament', frameId: 'frame-arcane' });
    // Nothing recorded on the server: status cosmetics are not shown to others.
    expect(verifiedCosmetics(base, [])).toEqual({ characterId: 'kael', vehicleId: 'viper' });
    // Server-awarded achievements vouch for their cosmetics.
    expect(verifiedCosmetics(base, ['tournament-champion', 'combo-master'])).toEqual({ characterId: 'kael', vehicleId: 'viper', titleId: 'title-tournament', frameId: 'frame-arcane' });
    // Defaults always pass; locally earned (unverifiable) items do not.
    expect(verifiedCosmetics(sanitizeCosmetics({ characterId: 'vexa', vehicleId: 'comet', titleId: 'title-newcomer', frameId: 'frame-azure' }), [])).toMatchObject({ titleId: 'title-newcomer', frameId: 'frame-azure' });
    expect(verifiedCosmetics(sanitizeCosmetics({ characterId: 'vexa', vehicleId: 'comet', titleId: 'title-lexicon', frameId: 'frame-gilded' }), ['words-100'])).toEqual({ characterId: 'vexa', vehicleId: 'comet' });
    // Made-up ids never pass.
    expect(verifiedCosmetics(sanitizeCosmetics({ characterId: 'vexa', vehicleId: 'comet', titleId: 'title-hacker' }), [])).toEqual({ characterId: 'vexa', vehicleId: 'comet' });
  });
});
