import { useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { parseDayKey } from '@/domain/dates';
import { findExercise } from '@/domain/exercises';
import type { ExerciseRecord } from '@/domain/records';
import { formatWeight } from '@/domain/strength';
import { useGame } from '@/state/stores';
import { colors, radius, spacing } from '@/theme';

function bestReps(record: ExerciseRecord): number {
  return Object.values(record.repsAtLoad).reduce((m, r) => Math.max(m, r), 0);
}

export function RecordsScreen() {
  const records = useGame((s) => s.records);
  const unit = useGame((s) => s.profile.unit);
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(records)
      .filter((r) => findExercise(r.exerciseId) && (!q || findExercise(r.exerciseId)!.name.toLowerCase().includes(q)))
      .sort((a, b) => b.lastDay.localeCompare(a.lastDay));
  }, [records, query]);

  return (
    <FlatList
      testID="records-screen"
      data={list}
      keyExtractor={(r) => r.exerciseId}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl }}
      ListHeaderComponent={
        <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
          <Text variant="subhead">Every record you break also breaks a gate seal in the dungeon.</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Find an exercise"
            placeholderTextColor={colors.dim}
            accessibilityLabel="Find an exercise"
            selectionColor={colors.torch}
            style={{ minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.seam, backgroundColor: colors.slate, color: colors.bone, fontSize: 17 }}
          />
        </View>
      }
      ListEmptyComponent={<Text variant="subhead">Log a few sets and your bests will appear here.</Text>}
      renderItem={({ item }) => {
        const exercise = findExercise(item.exerciseId)!;
        const timed = exercise.measure === 'time';
        const loaded = exercise.externalLoad && item.bestWeight > 0;
        const reps = bestReps(item);
        return (
          <View style={{ padding: spacing.md, gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.seam, backgroundColor: colors.stone }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name="trophy" size={18} color={colors.torch} />
              <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                {exercise.name}
              </Text>
              <Text variant="label" color={colors.dim}>
                {parseDayKey(item.lastDay).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' }}>
              {timed ? (
                <View>
                  <Text variant="number">{item.bestHold} s</Text>
                  <Text variant="label">Longest hold</Text>
                </View>
              ) : null}
              {loaded ? (
                <>
                  <View>
                    <Text variant="number">{formatWeight(item.bestE1rm, unit)}</Text>
                    <Text variant="label">Estimated max</Text>
                  </View>
                  <View>
                    <Text variant="number">
                      {formatWeight(item.bestWeight, unit)} x {item.bestWeightReps}
                    </Text>
                    <Text variant="label">Heaviest</Text>
                  </View>
                </>
              ) : null}
              {!timed && reps > 0 ? (
                <View>
                  <Text variant="number">{reps}</Text>
                  <Text variant="label">Most reps</Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      }}
    />
  );
}
