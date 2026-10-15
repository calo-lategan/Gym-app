import { useEffect } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { activityAvailability, connectActivity, openActivitySettings, readActivity, type ActivityAvailability } from '@/services/activity';
import { applyActivitySync } from '@/state/actions';
import { useActivity } from '@/state/stores';

/** A first sync reads four weeks for the energy model; later ones refresh the last few days. */
const FULL_SYNC_DAYS = 28;
const QUICK_SYNC_DAYS = 3;
const QUICK_SYNC_WITHIN_MS = 24 * 60 * 60 * 1000;

const useSyncStatus = create<{ availability: ActivityAvailability | null; syncing: boolean }>(() => ({
  availability: null,
  syncing: false,
}));

async function syncActivity() {
  const availability = await activityAvailability();
  useSyncStatus.setState({ availability });
  if (availability !== 'ready' || useSyncStatus.getState().syncing) return;
  const last = useActivity.getState().lastSync;
  const days = last && Date.now() - last < QUICK_SYNC_WITHIN_MS ? QUICK_SYNC_DAYS : FULL_SYNC_DAYS;
  useSyncStatus.setState({ syncing: true });
  try {
    applyActivitySync(await readActivity(days));
  } catch {
    // Keep the last sync; the next foreground tries again.
  } finally {
    useSyncStatus.setState({ syncing: false });
  }
}

async function connectAndSync() {
  if (await connectActivity()) await syncActivity();
  else useSyncStatus.setState({ availability: await activityAvailability() });
}

/** Keeps tracker data fresh while a screen that shows it is open. */
export function useActivitySync() {
  const availability = useSyncStatus((s) => s.availability);
  const syncing = useSyncStatus((s) => s.syncing);

  useEffect(() => {
    void syncActivity();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncActivity();
    });
    return () => sub.remove();
  }, []);

  return { availability, syncing, connect: connectAndSync, sync: syncActivity, openSettings: openActivitySettings };
}
