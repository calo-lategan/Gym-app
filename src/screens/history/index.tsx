import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { addDays, dayKeyOf, parseDayKey, startOfIsoWeek } from '@/domain/dates';
import { findExercise } from '@/domain/exercises';
import { setDuration } from '@/domain/records';
import { formatWeight } from '@/domain/strength';
import type { WorkoutSession } from '@/domain/types';
import { haptics } from '@/services/haptics';
import { useGame, useHistory } from '@/state/stores';
import { colors, radius, spacing } from '@/theme';

const WEEKS = 8;

function minutes(session: WorkoutSession) {
  return session.endedAt ? Math.max(1, Math.round((session.endedAt - session.startedAt) / 60000)) : 0;
}

function volumeKg(session: WorkoutSession) {
  return session.exercises.reduce((sum, e) => sum + e.sets.reduce((s, set) => s + set.weight * set.reps, 0), 0);
}

/** Workouts per week for the last few weeks, oldest first. */
function weeklyCounts(sessions: readonly WorkoutSession[], today: string) {
  const thisWeek = startOfIsoWeek(today);
  return Array.from({ length: WEEKS }, (_, i) => {
    const start = addDays(thisWeek, -7 * (WEEKS - 1 - i));
    const end = addDays(start, 7);
    return { start, count: sessions.filter((s) => s.endedAt && s.dayKey >= start && s.dayKey < end).length };
  });
}

function WeekBars({ weeks, goal }: { weeks: { start: string; count: number }[]; goal: number }) {
  const max = Math.max(goal, ...weeks.map((w) => w.count), 1);
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 84 }} accessible accessibilityLabel={`Workouts per week, last ${WEEKS} weeks: ${weeks.map((w) => w.count).join(', ')}`}>
        {weeks.map((w, i) => {
          const hit = w.count >= goal;
          return (
            <View key={w.start} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <Text variant="label" color={hit ? colors.torchHigh : colors.dim}>
                {w.count || ''}
              </Text>
              <View
                style={{
                  width: '100%',
                  height: Math.max(4, (w.count / max) * 56),
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  backgroundColor: hit ? colors.torch : i === weeks.length - 1 ? colors.torchDeep : colors.slateHigh,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="label" color={colors.dim}>
          {WEEKS} weeks ago
        </Text>
        <Text variant="label" color={colors.dim}>
          This week
        </Text>
      </View>
    </View>
  );
}

function SessionCard({ session }: { session: WorkoutSession }) {
  const unit = useGame((s) => s.profile.unit);
  const [open, setOpen] = useState(false);
  const sets = session.exercises.reduce((n, e) => n + e.sets.length, 0);
  const date = parseDayKey(session.dayKey).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const volume = volumeKg(session);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={() => {
        haptics.tap();
        setOpen((o) => !o);
      }}
      style={({ pressed }) => ({
        padding: spacing.md,
        gap: spacing.sm,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.seam,
        backgroundColor: pressed ? colors.slate : colors.stone,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name={session.kind === 'recovery' ? 'heart' : session.location === 'home' ? 'home' : 'swords'} size={18} color={session.kind === 'recovery' ? colors.verdant : colors.torch} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {session.title}
          </Text>
          <Text variant="caption">
            {date}, {minutes(session)} min, {sets} sets{volume > 0 ? `, ${formatWeight(volume, unit)} moved` : ''}
          </Text>
        </View>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={18} color={colors.dim} />
      </View>
      {open
        ? session.exercises
            .filter((e) => e.sets.length > 0)
            .map((e) => (
              <View key={e.slotId} style={{ gap: 2 }}>
                <Text variant="body">{findExercise(e.exerciseId)?.name ?? 'Exercise'}</Text>
                <Text variant="caption">
                  {e.sets
                    .map((s) => {
                      const t = setDuration(s);
                      const load = s.weight > 0 ? `${formatWeight(s.weight, unit)} x ` : '';
                      return `${load}${s.reps}${findExercise(e.exerciseId)?.measure === 'time' ? ' s' : ''}${t ? ` (${Math.round(t)} s)` : ''}`;
                    })
                    .join(', ')}
                </Text>
              </View>
            ))
        : null}
    </Pressable>
  );
}

export function HistoryScreen() {
  const sessions = useHistory((s) => s.sessions);
  const schedule = useGame((s) => s.schedule);
  const done = useMemo(() => sessions.filter((s) => s.endedAt).slice().reverse(), [sessions]);
  const today = dayKeyOf(new Date());
  const weeks = useMemo(() => weeklyCounts(done, today), [done, today]);
  const goal = schedule.trainingDays.filter(Boolean).length;
  const totalMinutes = done.reduce((n, s) => n + minutes(s), 0);
  return (
    <FlatList
      testID="history-screen"
      data={done}
      keyExtractor={(s) => s.id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl }}
      ListHeaderComponent={
        <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {[
              { label: 'Quests', value: done.length },
              { label: 'Time trained', value: totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes}m` },
              { label: 'Weekly goal', value: goal },
            ].map((t) => (
              <View key={t.label} style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.stone, borderWidth: 1, borderColor: colors.seam }}>
                <Text variant="stat">{t.value}</Text>
                <Text variant="label">{t.label}</Text>
              </View>
            ))}
          </View>
          <WeekBars weeks={weeks} goal={goal} />
        </View>
      }
      ListEmptyComponent={<Text variant="subhead">No battles yet. Your finished quests will be logged here.</Text>}
      renderItem={({ item }) => <SessionCard session={item} />}
    />
  );
}
