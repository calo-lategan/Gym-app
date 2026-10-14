import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { PageScroll, Section } from '@/components/screen';
import { Text } from '@/components/text';
import { TimePicker } from '@/components/time-picker';
import { toast } from '@/components/toast';
import { moveOptions } from '@/domain/reminders';
import { formatClock } from '@/domain/schedule';
import type { ClockTime } from '@/domain/types';
import { useTodayStatus } from '@/hooks/use-game-data';
import { goBack } from '@/navigation/back';
import { haptics } from '@/services/haptics';
import { clearTodayOverride, moveSessionToday, restToday, trainToday } from '@/state/actions';
import { useGame } from '@/state/stores';
import { colors, spacing } from '@/theme';

/** Move today's session earlier or later, swap it with a rest day, or train on a rest day. */
export function MoveSessionScreen() {
  const status = useTodayStatus();
  const use24h = useGame((s) => s.settings.use24h);
  const options = useMemo(() => moveOptions(new Date()), []);
  const [custom, setCustom] = useState<ClockTime>(status.time);

  const moveTo = (time: ClockTime) => {
    if (!status.trainingDay) trainToday();
    moveSessionToday(time);
    haptics.success();
    toast({ title: `Quest set for ${formatClock(time, use24h)}`, detail: 'Your reminder moved with it.', icon: 'clock', tone: 'torch' });
    goBack('/');
  };

  return (
    <PageScroll padTop={spacing.lg} testID="move-session-screen">
      <View style={{ gap: spacing.xs }}>
        <Text variant="title">{status.trainingDay ? "Move today's session" : 'Train on a rest day'}</Text>
        <Text variant="subhead">
          {status.trainingDay
            ? `Planned for ${formatClock(status.time, use24h)}. Pick a new time and the reminder follows.`
            : 'Rest days count as recovery, but a bonus session still earns XP and loot. Pick a time.'}
        </Text>
      </View>

      <Section title="Quick picks">
        <ChipRow>
          {options.map((o) => (
            <Chip
              key={o.label}
              label={`${o.label}, ${formatClock(o, use24h)}`}
              selected={false}
              onPress={() => moveTo({ hour: o.hour, minute: o.minute })}
              testID={`move-${o.label}`}
            />
          ))}
        </ChipRow>
      </Section>

      <Section title="Another time">
        <TimePicker label="Session time" value={custom} onChange={setCustom} use24h={use24h} testID="move-custom-time" />
        <Button title={`Train at ${formatClock(custom, use24h)}`} variant="secondary" onPress={() => moveTo(custom)} testID="move-custom" />
      </Section>

      {status.trainingDay ? (
        <Section title="Need a rest today?" detail="Swap today with your next rest day. Your streak stays safe and the dungeon waits.">
          <Button
            title="Rest today, train on my next rest day"
            icon="bed"
            variant="secondary"
            onPress={() => {
              restToday();
              haptics.success();
              toast({ title: 'Today is a rest day now', detail: 'Your session moved to your next free day.', icon: 'bed', tone: 'verdant' });
              goBack('/');
            }}
            testID="move-rest-today"
          />
        </Section>
      ) : null}

      {status.override ? (
        <Button
          title="Back to the usual plan"
          variant="ghost"
          onPress={() => {
            clearTodayOverride();
            goBack('/');
          }}
          testID="move-reset"
        />
      ) : null}
      {status.override === 'rest' ? (
        <Text variant="caption" color={colors.dim}>
          Today was swapped to a rest day.
        </Text>
      ) : null}
    </PageScroll>
  );
}
