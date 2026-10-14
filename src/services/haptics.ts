import * as Haptics from 'expo-haptics';

import { useGame } from '@/state/stores';

const enabled = () => process.env.EXPO_OS !== 'web' && useGame.getState().settings.haptics;

/** Haptics are always paired with a visual; these never replace feedback, only add to it. */
export const haptics = {
  tap() {
    if (enabled()) void Haptics.selectionAsync();
  },
  light() {
    if (enabled()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  impact() {
    if (enabled()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
  heavy() {
    if (enabled()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },
  success() {
    if (enabled()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  warning() {
    if (enabled()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
};
