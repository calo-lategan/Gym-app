import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';

import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { ToggleRow } from '@/components/toggle-row';
import { EXERCISES, isAvailable } from '@/domain/exercises';
import { MUSCLE_LABELS } from '@/domain/science';
import { describeEquipment } from '@/domain/substitution';
import type { Exercise, MuscleGroup } from '@/domain/types';
import { goBack } from '@/navigation/back';
import { haptics } from '@/services/haptics';
import { play } from '@/services/sound';
import { addExerciseToWorkout, addToDay } from '@/state/actions';
import { useGame } from '@/state/stores';
import { colors, radius, spacing } from '@/theme';

const MUSCLES: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core'];

/** Adds an exercise to a plan day (`dayId`) or to the running workout. */
export function ExercisePickerScreen() {
  const { dayId } = useLocalSearchParams<{ dayId?: string }>();
  const profile = useGame((s) => s.profile);
  const active = useGame((s) => s.active);
  const location = dayId ? 'gym' : (active?.session.location ?? 'gym');
  const equipment = location === 'home' ? profile.homeEquipment : profile.gymEquipment;
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [showAll, setShowAll] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EXERCISES.filter(
      (e) => (!q || e.name.toLowerCase().includes(q)) && (!muscle || e.primary.includes(muscle)) && (showAll || isAvailable(e, equipment)),
    ).sort((a, b) => Number(isAvailable(b, equipment)) - Number(isAvailable(a, equipment)) || a.name.localeCompare(b.name));
  }, [query, muscle, showAll, equipment]);

  const add = (exercise: Exercise) => {
    if (dayId) addToDay(dayId, exercise.id);
    else addExerciseToWorkout(exercise.id);
    play('setStart', 0.6);
    haptics.success();
    goBack('/plan');
  };

  return (
    <FlatList
      testID="exercise-picker"
      data={list}
      keyExtractor={(e) => e.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: spacing.md, paddingTop: spacing.lg, gap: spacing.sm }}
      ListHeaderComponent={
        <View style={{ gap: spacing.ms, marginBottom: spacing.sm }}>
          <Text variant="title">Add an exercise</Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              minHeight: 50,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.seam,
              backgroundColor: colors.slate,
            }}
          >
            <Icon name="list" size={18} color={colors.dim} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search exercises"
              placeholderTextColor={colors.dim}
              accessibilityLabel="Search exercises"
              selectionColor={colors.torch}
              autoCorrect={false}
              style={{ flex: 1, color: colors.bone, fontSize: 17, paddingVertical: spacing.sm }}
              testID="exercise-search"
            />
          </View>
          <FlatList
            horizontal
            data={[null, ...MUSCLES]}
            keyExtractor={(m) => m ?? 'all'}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}
            renderItem={({ item }) => (
              <Chip
                label={item ? MUSCLE_LABELS[item] : 'All'}
                selected={muscle === item}
                onPress={() => setMuscle(item)}
                testID={`muscle-${item ?? 'all'}`}
              />
            )}
          />
          <ToggleRow label="Include exercises I lack the kit for" value={showAll} onValueChange={setShowAll} />
        </View>
      }
      ListEmptyComponent={<Text variant="subhead">No exercises match. Try another muscle or search.</Text>}
      renderItem={({ item }) => {
        const available = isAvailable(item, equipment);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add ${item.name}`}
            onPress={() => add(item)}
            testID={`pick-${item.id}`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.ms,
              padding: spacing.md,
              borderRadius: radius.lg,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: colors.seam,
              backgroundColor: pressed ? colors.slateHigh : colors.stone,
              opacity: available ? 1 : 0.6,
            })}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{item.name}</Text>
              <Text variant="caption">
                {item.primary.map((m) => MUSCLE_LABELS[m]).join(', ')}.{' '}
                {available
                  ? item.equipment.length
                    ? `Uses ${describeEquipment(item.equipment)}.`
                    : 'No equipment.'
                  : `Needs ${describeEquipment(item.equipment)}.`}
              </Text>
            </View>
            <Icon name="plus" size={20} color={available ? colors.torch : colors.dim} />
          </Pressable>
        );
      }}
    />
  );
}
