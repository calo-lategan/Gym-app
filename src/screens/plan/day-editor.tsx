import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { Button, IconButton } from '@/components/button';
import { Icon } from '@/components/icon';
import { Panel } from '@/components/panel';
import { PageScroll, Section } from '@/components/screen';
import { Stepper } from '@/components/stepper';
import { Text } from '@/components/text';
import { getExercise } from '@/domain/exercises';
import { MUSCLE_LABELS, plannedSets } from '@/domain/science';
import { describeEquipment } from '@/domain/substitution';
import type { MuscleGroup, PlannedExercise } from '@/domain/types';
import { estimateMinutes } from '@/hooks/use-game-data';
import { haptics } from '@/services/haptics';
import { moveInDay, removeFromDay, updatePlanned } from '@/state/actions';
import { useGame } from '@/state/stores';
import { colors, radius, spacing } from '@/theme';

const formatRest = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

function ExerciseRow({ dayId, planned, index, count }: { dayId: string; planned: PlannedExercise; index: number; count: number }) {
  const [open, setOpen] = useState(false);
  const exercise = getExercise(planned.exerciseId);
  const timed = exercise.measure === 'time';
  const unitLabel = timed ? 's' : 'reps';
  return (
    <Animated.View layout={LinearTransition.duration(200)}>
      <Panel>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${exercise.name}, ${planned.sets} sets of ${planned.repMin} to ${planned.repMax} ${unitLabel}. ${open ? 'Collapse' : 'Edit'}`}
          onPress={() => {
            haptics.tap();
            setOpen((o) => !o);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 }}
          testID={`day-exercise-${index}`}
        >
          <View style={{ width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.slate, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="label">{index + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{exercise.name}</Text>
            <Text variant="caption">
              {planned.sets} x {planned.repMin}
              {planned.repMax !== planned.repMin ? ` to ${planned.repMax}` : ''} {unitLabel}, rest {formatRest(planned.restSec)}
            </Text>
          </View>
          <Icon name={open ? 'chevronDown' : 'edit'} size={18} color={colors.dim} />
        </Pressable>
        {open ? (
          <Animated.View entering={FadeIn.duration(180)} style={{ gap: spacing.ms }}>
            <Text variant="caption">
              {exercise.primary.map((m) => MUSCLE_LABELS[m]).join(', ')}. {exercise.equipment.length ? `Needs ${describeEquipment(exercise.equipment)}.` : 'No equipment needed.'}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Stepper label="Sets" value={planned.sets} min={1} max={10} onChange={(sets) => updatePlanned(dayId, planned.id, { sets })} compact testID={`sets-${index}`} />
              <Stepper label="Rest" value={planned.restSec} min={15} max={600} step={15} format={formatRest} onChange={(restSec) => updatePlanned(dayId, planned.id, { restSec })} compact />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Stepper
                label={timed ? 'Min seconds' : 'Min reps'}
                value={planned.repMin}
                min={1}
                max={timed ? 600 : 50}
                step={timed ? 5 : 1}
                onChange={(repMin) => updatePlanned(dayId, planned.id, { repMin, repMax: Math.max(repMin, planned.repMax) })}
                compact
              />
              <Stepper
                label={timed ? 'Max seconds' : 'Max reps'}
                value={planned.repMax}
                min={planned.repMin}
                max={timed ? 600 : 50}
                step={timed ? 5 : 1}
                onChange={(repMax) => updatePlanned(dayId, planned.id, { repMax })}
                compact
              />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <Button
                title="Swap"
                icon="swap"
                variant="secondary"
                size="sm"
                style={{ flex: 1 }}
                onPress={() => router.push(`/swap?dayId=${dayId}&slotId=${planned.id}`)}
                testID={`swap-${index}`}
              />
              <IconButton icon="up" label="Move up" onPress={() => moveInDay(dayId, planned.id, -1)} color={index === 0 ? colors.dim : colors.bone} />
              <IconButton icon="down" label="Move down" onPress={() => moveInDay(dayId, planned.id, 1)} color={index === count - 1 ? colors.dim : colors.bone} />
              <IconButton icon="trash" label={`Remove ${exercise.name}`} onPress={() => removeFromDay(dayId, planned.id)} color={colors.ember} />
            </View>
          </Animated.View>
        ) : null}
      </Panel>
    </Animated.View>
  );
}

export function DayEditorScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const day = useGame((s) => s.program?.days.find((d) => d.id === dayId) ?? null);
  if (!day) {
    return (
      <PageScroll>
        <Stack.Screen options={{ title: 'Day' }} />
        <Text variant="subhead">This day is no longer in your plan.</Text>
      </PageScroll>
    );
  }
  const sets = day.exercises.reduce((n, e) => n + e.sets, 0);
  const rest = day.exercises.reduce((n, e) => n + e.restSec, 0) / Math.max(1, day.exercises.length);
  const muscles = plannedSets(day);
  const hit = (Object.keys(muscles) as MuscleGroup[]).filter((m) => muscles[m] >= 1).sort((a, b) => muscles[b] - muscles[a]);
  return (
    <PageScroll testID="day-editor">
      <Stack.Screen options={{ title: day.name }} />
      <View style={{ gap: spacing.xs }}>
        <Text variant="subhead">
          {day.exercises.length} exercises, {sets} sets, about {estimateMinutes(sets, rest)} min
        </Text>
        <Text variant="caption">
          Works {hit.map((m) => `${MUSCLE_LABELS[m].toLowerCase()} (${Math.round(muscles[m] * 2) / 2})`).join(', ')}.
        </Text>
      </View>
      <Section title="Exercises" detail="Tap one to change sets, reps or rest, or to swap it for kit you have.">
        {day.exercises.map((planned, i) => (
          <ExerciseRow key={planned.id} dayId={day.id} planned={planned} index={i} count={day.exercises.length} />
        ))}
        <Button title="Add exercise" icon="plus" variant="secondary" onPress={() => router.push(`/exercise-picker?dayId=${day.id}`)} testID="day-add-exercise" />
      </Section>
    </PageScroll>
  );
}
