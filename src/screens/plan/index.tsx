import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { Icon } from '@/components/icon';
import { Panel } from '@/components/panel';
import { Divider, Section, TabScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { TimePicker } from '@/components/time-picker';
import { ToggleRow } from '@/components/toggle-row';
import { WEEKDAY_SHORT } from '@/domain/dates';
import { findExercise } from '@/domain/exercises';
import { SPLIT_LABELS } from '@/domain/program';
import { formatClock, trainingDaysPerWeek } from '@/domain/schedule';
import { assessPlan, MUSCLE_LABELS, pushPullBalance, VOLUME_LANDMARKS, weeklyPlanSets } from '@/domain/science';
import type { MuscleGroup, ProgramDay } from '@/domain/types';
import { estimateMinutes, useTodayStatus } from '@/hooks/use-game-data';
import { regenerateProgram, setNextDay, setReminderTime, setRemindersEnabled, setTrainingDay } from '@/state/actions';
import { useGame, useHistory } from '@/state/stores';
import { colors, radius, spacing } from '@/theme';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const MUSCLE_ORDER: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core'];

function daySummary(day: ProgramDay) {
  const sets = day.exercises.reduce((n, e) => n + e.sets, 0);
  const rest = day.exercises.reduce((n, e) => n + e.restSec, 0) / Math.max(1, day.exercises.length);
  return { sets, minutes: estimateMinutes(sets, rest) };
}

/** Weekly sets per muscle against the growth window (MEV to MRV). */
function VolumeBars({ totals }: { totals: Record<MuscleGroup, number> }) {
  const scale = 28;
  return (
    <View style={{ gap: spacing.sm }}>
      {MUSCLE_ORDER.filter((m) => m !== 'core').map((m) => {
        const { mev, mrv } = VOLUME_LANDMARKS[m];
        const value = Math.round(totals[m] * 2) / 2;
        const tone = value > mrv ? colors.ember : value >= mev ? colors.verdant : colors.torch;
        return (
          <View key={m} accessible accessibilityLabel={`${MUSCLE_LABELS[m]}: ${value} sets a week. Growth window ${mev} to ${mrv}.`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="caption" style={{ width: 84 }} numberOfLines={1}>
              {MUSCLE_LABELS[m]}
            </Text>
            <View style={{ flex: 1, height: 12, borderRadius: radius.full, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: colors.seam, overflow: 'hidden' }}>
              {/* Growth window. */}
              <View style={{ position: 'absolute', top: 0, bottom: 0, left: `${(mev / scale) * 100}%`, width: `${((Math.min(mrv, scale) - mev) / scale) * 100}%`, backgroundColor: 'rgba(102,212,156,0.14)' }} />
              <View style={{ width: `${Math.min(1, value / scale) * 100}%`, height: '100%', borderRadius: radius.full, backgroundColor: tone }} />
            </View>
            <Text variant="label" style={{ width: 28, textAlign: 'right', fontVariant: ['tabular-nums'] }} color={tone}>
              {value}
            </Text>
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 14, height: 10, borderRadius: 3, backgroundColor: 'rgba(102,212,156,0.3)' }} />
        <Text variant="caption" style={{ flex: 1 }}>
          Shaded band: enough sets to grow, without outrunning recovery.
        </Text>
      </View>
    </View>
  );
}

export function PlanScreen() {
  const program = useGame((s) => s.program);
  const schedule = useGame((s) => s.schedule);
  const nextDayIndex = useGame((s) => s.nextDayIndex);
  const use24h = useGame((s) => s.settings.use24h);
  const sessions = useHistory((s) => s.sessions);
  const status = useTodayStatus();
  const perWeek = trainingDaysPerWeek(schedule);
  const days = useMemo(() => program?.days ?? [], [program]);
  const [openedAt] = useState(() => Date.now());

  const totals = useMemo(() => weeklyPlanSets(days, Math.max(1, perWeek)), [days, perWeek]);
  const balance = useMemo(() => pushPullBalance(days, Math.max(1, perWeek)), [days, perWeek]);
  const warnings = useMemo(
    () => (status.day ? assessPlan(status.day, sessions, status.today, openedAt) : []),
    [status.day, status.today, sessions, openedAt],
  );

  const todayLine = status.override === 'rest'
    ? 'Today is now a rest day. Your session moved to the next free day.'
    : status.trainingDay
      ? status.doneToday
        ? 'Done for today. Well fought.'
        : `${status.day?.name ?? 'Training'} at ${formatClock(status.time, use24h)}${status.override && status.override !== 'train' ? ', moved' : ''}.`
      : 'Rest day. Recovery is where the strength is built.';

  const rebuild = () => {
    const go = () => regenerateProgram();
    if (Platform.OS === 'web') {
      go();
      return;
    }
    Alert.alert('Rebuild your plan?', 'A fresh plan is generated from your goal, schedule and equipment. Your history and records stay.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Rebuild', onPress: go },
    ]);
  };

  return (
    <TabScreen
      title="Plan"
      subtitle={program ? `${SPLIT_LABELS[program.split]}, ${perWeek} ${perWeek === 1 ? 'day' : 'days'} a week` : 'No plan yet'}
      right={<Button title="Science" icon="brain" variant="secondary" size="sm" onPress={() => router.push('/science')} testID="open-science" />}
      testID="plan-screen"
    >
      <Section title="Training days">
        <ChipRow>
          {WEEK_ORDER.map((d) => (
            <Chip
              key={d}
              label={WEEKDAY_SHORT[d]}
              selected={schedule.trainingDays[d]}
              onPress={() => {
                if (schedule.trainingDays[d] && perWeek <= 1) return;
                setTrainingDay(d, !schedule.trainingDays[d]);
              }}
              testID={`plan-day-${d}`}
            />
          ))}
        </ChipRow>
        <Panel>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="calendar" size={18} color={colors.torch} />
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              {todayLine}
            </Text>
          </View>
          {status.trainingDay && !status.doneToday ? (
            <Button title="Move today's session" icon="clock" variant="secondary" size="md" onPress={() => router.push('/move-session')} testID="plan-move-session" />
          ) : !status.trainingDay ? (
            <Button title="Train today anyway" icon="swords" variant="secondary" size="md" onPress={() => router.push('/move-session')} testID="plan-train-today" />
          ) : null}
          <Divider />
          <TimePicker label="Gym time" value={schedule.reminderTime} onChange={setReminderTime} use24h={use24h} testID="plan-gym-time" />
          <ToggleRow
            label="Remind me"
            detail="A nudge at your gym time on training days."
            icon="bell"
            value={schedule.remindersEnabled}
            onValueChange={setRemindersEnabled}
            testID="plan-reminders"
          />
        </Panel>
      </Section>

      {warnings.length > 0 ? (
        <Section title="Before today's session">
          {warnings.map((w) => (
            <Panel key={w.id} tone={w.level === 'danger' ? 'ember' : 'torch'}>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
                <Icon name="warning" size={20} color={w.level === 'danger' ? colors.ember : colors.torch} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">{w.title}</Text>
                  <Text variant="caption">{w.detail}</Text>
                </View>
              </View>
            </Panel>
          ))}
        </Section>
      ) : null}

      <Section title="Your rotation" detail="Days run in order on your training days. Tap a day to edit it." action={<Button title="Rebuild" icon="refresh" variant="ghost" size="sm" onPress={rebuild} testID="plan-rebuild" />}>
        {days.map((day, i) => {
          const { sets, minutes } = daySummary(day);
          const next = i === nextDayIndex % Math.max(1, days.length);
          return (
            <Panel key={day.id} onPress={() => router.push(`/plan/${day.id}`)} tone={next ? 'torch' : 'stone'} testID={`plan-day-card-${i}`} accessibilityLabel={`${day.name}, ${day.exercises.length} exercises${next ? ', next up' : ''}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text variant="heading" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {day.name}
                    </Text>
                    {next ? (
                      <View style={{ paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.torch }}>
                        <Text variant="label" color={colors.onTorch}>
                          Next
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text variant="caption">
                    {day.exercises.length} exercises, {sets} sets, about {minutes} min
                  </Text>
                </View>
                <Icon name="chevronRight" size={20} color={colors.dim} />
              </View>
              <Text variant="caption" numberOfLines={2}>
                {day.exercises.map((e) => findExercise(e.exerciseId)?.name ?? 'Exercise').join(', ')}
              </Text>
              {!next ? (
                <Button title="Do this one next" variant="ghost" size="sm" onPress={() => setNextDay(i)} testID={`plan-set-next-${i}`} />
              ) : null}
            </Panel>
          );
        })}
        {days.length === 0 ? <Button title="Build my plan" icon="plan" onPress={() => regenerateProgram()} /> : null}
      </Section>

      <Section title="Weekly balance" detail="Hard sets each muscle gets in a typical week of this plan.">
        <Panel>
          <VolumeBars totals={totals} />
          <Divider />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="swap" size={18} color={balance.pull >= balance.push ? colors.verdant : colors.torch} />
            <Text variant="body" style={{ flex: 1 }}>
              Push {balance.push} sets, pull {balance.pull} sets.{' '}
              {balance.pull >= balance.push ? 'Balanced for healthy shoulders.' : 'Add a pull movement to even it out.'}
            </Text>
          </View>
        </Panel>
      </Section>

      <Section title="Kit">
        <Button title="Gym and home equipment" icon="equipment" variant="secondary" onPress={() => router.push('/settings')} testID="plan-equipment" />
      </Section>
    </TabScreen>
  );
}
