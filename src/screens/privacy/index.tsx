import { View } from 'react-native';

import { PageScroll } from '@/components/screen';
import { Text } from '@/components/text';
import { spacing } from '@/theme';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Everything stays on your phone',
    body: 'Your hero, workouts, check-ins, body weight and settings are stored only on this device. Ironwyrm has no account, no servers, no analytics, no ads and no third-party tracking. Nothing you enter is collected, sold or shared.',
  },
  {
    title: 'Reminders',
    body: 'Gym and rest reminders are scheduled by your phone itself. They never pass through a server.',
  },
  {
    title: 'Permissions',
    body: 'Notifications, only for your reminders and rest timers. Vibration, for haptic feedback. The app does not use your location, camera, microphone, contacts or photos.',
  },
  {
    title: 'Your control',
    body: 'Export a backup from Settings at any time; you choose where it goes. "Start over" in Settings, or uninstalling, erases everything.',
  },
  {
    title: 'Health information',
    body: 'Training guidance in the app is general fitness information, not medical advice. If you have a health condition, check with a professional before starting a new program.',
  },
];

export function PrivacyScreen() {
  return (
    <PageScroll testID="privacy-screen">
      {SECTIONS.map((s) => (
        <View key={s.title} style={{ gap: spacing.xs }}>
          <Text variant="heading">{s.title}</Text>
          <Text variant="body">{s.body}</Text>
        </View>
      ))}
    </PageScroll>
  );
}
