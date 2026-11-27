import { useEffect } from 'react';
import { sfx, type MusicTrack } from './sfx';

/** Plays a music track while the calling screen is mounted, then returns to the lobby theme. */
export function useMusic(track: MusicTrack): void {
  useEffect(() => {
    sfx.setMusic(track);
    return () => sfx.setMusic('lobby');
  }, [track]);
}
