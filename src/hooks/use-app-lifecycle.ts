import { useEffect } from 'react';
import { AppState } from 'react-native';

import { toast } from '@/components/toast';
import { configureNotifications, syncReminders } from '@/services/notifications';
import { initSound } from '@/services/sound';
import { dismissNotices, settleDaily } from '@/state/actions';
import { useGame } from '@/state/stores';

/**
 * Daily upkeep whenever the app comes to the foreground: settle the streak,
 * refresh the weekly miniboss and re-plan reminders.
 */
export function useAppLifecycle(active: boolean) {
  useEffect(() => {
    void initSound();
    void configureNotifications();
  }, []);

  useEffect(() => {
    if (!active) return;
    const run = () => {
      settleDaily();
      const notices = useGame.getState().notices;
      for (const notice of notices) toast({ title: notice, icon: 'bell' });
      if (notices.length) dismissNotices();
      void syncReminders();
    };
    run();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    // Reminders depend on the schedule and today's plan; re-plan when they change.
    const unsubscribe = useGame.subscribe((state, prev) => {
      if (state.schedule !== prev.schedule || state.nextDayIndex !== prev.nextDayIndex || state.program !== prev.program) {
        void syncReminders();
      }
    });
    return () => {
      sub.remove();
      unsubscribe();
    };
  }, [active]);
}
