import { useUpdates } from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { toast } from '@/components/toast';
import { downloadAppUpdate, restartIntoUpdate } from '@/services/updates';
import { useGame } from '@/state/stores';

/** Time to read the toast before the restart. */
const RESTART_DELAY_MS = 1800;

/**
 * Looks for a new version whenever the app comes to the front and restarts
 * onto it, so updates arrive by simply opening the app. Never restarts during
 * a workout or onboarding, where unsaved progress lives on screen; those pick
 * the update up on the next launch instead.
 */
export function useAppUpdates() {
  const { isUpdatePending } = useUpdates();
  const busy = useGame((s) => s.active !== null || !s.onboarded);

  useEffect(() => {
    void downloadAppUpdate();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void downloadAppUpdate();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!isUpdatePending || busy) return;
    toast({ title: 'Updating Ironwyrm', detail: 'Restarting on the newest version.', icon: 'refresh', tone: 'torch' });
    const timer = setTimeout(restartIntoUpdate, RESTART_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isUpdatePending, busy]);
}
