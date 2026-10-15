import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { zoneForFloor } from '@/domain/game/dungeon';
import { areaForRoute } from '@/domain/music';
import { setMusicArea, setMusicInBackground, setMusicOptions } from '@/services/music';
import { useGame } from '@/state/stores';

/** Plays each area's music slot as the player moves through the app. */
export function useAreaMusic(ready: boolean) {
  const pathname = usePathname();
  const zoneIndex = useGame((s) => zoneForFloor(s.dungeon.floor).index);
  const bossFight = useGame((s) => s.active !== null && s.active.bossIndex === s.active.current);
  const music = useGame((s) => s.settings.music);
  const ambience = useGame((s) => s.settings.ambience);

  useEffect(() => {
    setMusicOptions({ music, ambience });
  }, [music, ambience]);

  useEffect(() => {
    if (!ready) return;
    const area = areaForRoute(pathname, { zoneIndex, bossFight });
    if (area !== 'keep') setMusicArea(area);
  }, [ready, pathname, zoneIndex, bossFight]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setMusicInBackground(state !== 'active'));
    return () => sub.remove();
  }, []);
}
