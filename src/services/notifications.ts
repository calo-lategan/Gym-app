import * as Notifications from 'expo-notifications';

import { dayKeyOf } from '@/domain/dates';
import { dragonForTier } from '@/domain/game/dragon';
import { planReminders } from '@/domain/reminders';
import { completedDays, todaysProgramDay } from '@/state/actions';
import { useGame } from '@/state/stores';

const REMINDER_CHANNEL = 'quest-reminders';
const REST_CHANNEL = 'rest-timer';
const isWeb = process.env.EXPO_OS === 'web';

let configured = false;

export async function configureNotifications() {
  if (isWeb || configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (process.env.EXPO_OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
      name: 'Workout reminders',
      description: 'A nudge at your gym time on training days',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#F2A93B',
    });
    await Notifications.setNotificationChannelAsync(REST_CHANNEL, {
      name: 'Rest timer',
      description: 'Tells you when your rest is over while the app is in the background',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250],
    });
  }
}

export async function notificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (isWeb) return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (isWeb) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.status === 'granted';
}

/**
 * Re-plans the rolling window of dated reminders. Called on launch, when the
 * app comes back to the foreground, after a workout and after any schedule change.
 */
export async function syncReminders() {
  if (isWeb) return;
  const state = useGame.getState();
  if (!state.onboarded) return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith('session-') || n.identifier.startsWith('comeback-'))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
    if (status !== 'granted') return;
    const dragon = state.dragon ? `${state.dragon.name}` : dragonForTier(1).name;
    const reminders = planReminders(state.schedule, new Date(), {
      heroName: state.hero.name,
      streak: state.hero.streak.current,
      completedDays: completedDays(false),
      nextDayName: todaysProgramDay()?.name ?? 'your workout',
      floor: state.dungeon.floor,
      dragonName: dragon,
    });
    for (const reminder of reminders) {
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.id,
        content: { title: reminder.title, body: reminder.body, data: { url: '/' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.date, channelId: REMINDER_CHANNEL },
      });
    }
  } catch {
    // Scheduling is best effort; the app works without reminders.
  }
}

let restId: string | null = null;

/** Rest-over alert for when the lifter locks the phone between sets. */
export async function scheduleRestAlert(seconds: number, nextExercise: string) {
  if (isWeb || seconds < 5) return;
  await cancelRestAlert();
  try {
    restId = await Notifications.scheduleNotificationAsync({
      identifier: `rest-${dayKeyOf(new Date())}-${Date.now()}`,
      content: { title: 'Rest is over', body: `Next up: ${nextExercise}. Pick up your weapon.`, data: { url: '/workout' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.round(seconds), channelId: REST_CHANNEL },
    });
  } catch {
    restId = null;
  }
}

export async function cancelRestAlert() {
  if (isWeb || !restId) return;
  const id = restId;
  restId = null;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // ignore
  }
}

export async function sendTestReminder() {
  if (isWeb) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Your quest awaits', body: 'This is how your gym reminder will look.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: REMINDER_CHANNEL },
  });
}
