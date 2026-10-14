import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Chip, ChipRow } from '@/components/chip';
import { Icon } from '@/components/icon';
import { PageScroll, Section } from '@/components/screen';
import { Text } from '@/components/text';
import { ToggleRow } from '@/components/toggle-row';
import { getExercise } from '@/domain/exercises';
import { MUSCLE_LABELS } from '@/domain/science';
import { EQUIPMENT_LABELS, findAlternatives } from '@/domain/substitution';
import type { EquipmentId } from '@/domain/types';
import { haptics } from '@/services/haptics';
import { play } from '@/services/sound';
import { replaceInProgram, setEquipment, swapExercise } from '@/state/actions';
import { useGame } from '@/state/stores';
import { colors, radius, spacing } from '@/theme';

/**
 * "I don't have this equipment": mark what is missing and pick a substitute
 * that trains the same movement and muscles with the kit you do have.
 */
export function SwapScreen() {
  const params = useLocalSearchParams<{ index?: string; dayId?: string; slotId?: string }>();
  const active = useGame((s) => s.active);
  const program = useGame((s) => s.program);
  const profile = useGame((s) => s.profile);
  const inWorkout = params.index !== undefined;
  const exerciseIndex = Number(params.index ?? -1);
  const day = program?.days.find((d) => d.id === params.dayId) ?? null;
  const current = inWorkout ? active?.session.exercises[exerciseIndex] : day?.exercises.find((e) => e.id === params.slotId);
  const location = inWorkout ? (active?.session.location ?? 'gym') : 'gym';
  const equipment = location === 'home' ? profile.homeEquipment : profile.gymEquipment;

  const [missing, setMissing] = useState<EquipmentId[]>([]);
  const [remember, setRemember] = useState(true);
  const [permanent, setPermanent] = useState(false);

  const exerciseId = current?.exerciseId;
  const alternatives = useMemo(() => {
    if (!exerciseId) return [];
    const usable = equipment.filter((q) => !missing.includes(q));
    const taken = inWorkout ? (active?.session.exercises.map((e) => e.exerciseId) ?? []) : (day?.exercises.map((e) => e.exerciseId) ?? []);
    return findAlternatives(exerciseId, usable, { exclude: taken, limit: 10 });
  }, [exerciseId, equipment, missing, inWorkout, active, day]);

  if (!current || !exerciseId) {
    return (
      <PageScroll>
        <Text variant="subhead">There is nothing to swap here any more.</Text>
      </PageScroll>
    );
  }
  const exercise = getExercise(exerciseId);

  const choose = (id: string) => {
    const lacking = remember ? missing : [];
    if (inWorkout) {
      swapExercise(exerciseIndex, id, { permanent, missingEquipment: lacking });
    } else if (day) {
      replaceInProgram(day.id, params.slotId ?? '', id);
      if (lacking.length) setEquipment('gymEquipment', profile.gymEquipment.filter((q) => !lacking.includes(q)));
    }
    play('setStart', 0.7);
    haptics.success();
    router.back();
  };

  return (
    <PageScroll testID="swap-screen" padTop={spacing.lg}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="title">Swap {exercise.name}</Text>
        <Text variant="subhead">
          Works {exercise.primary.map((m) => MUSCLE_LABELS[m].toLowerCase()).join(' and ')}. Every option below trains the same pattern, so your push and pull
          balance holds.
        </Text>
      </View>

      <Section title="Missing equipment?">
        {exercise.equipment.length > 0 ? (
          <>
            <Text variant="caption">Tap what you don&apos;t have{location === 'home' ? ' at home' : ' at your gym'}.</Text>
            <ChipRow>
              {exercise.equipment.map((q) => (
                <Chip
                  key={q}
                  label={`No ${EQUIPMENT_LABELS[q].toLowerCase()}`}
                  icon="close"
                  tone="ember"
                  selected={missing.includes(q)}
                  onPress={() => setMissing((m) => (m.includes(q) ? m.filter((x) => x !== q) : [...m, q]))}
                  testID={`missing-${q}`}
                />
              ))}
            </ChipRow>
            {missing.length > 0 ? (
              <ToggleRow
                label="Remember I don't have it"
                detail="Future plans and swaps will skip it. You can add it back in settings."
                value={remember}
                onValueChange={setRemember}
                testID="remember-missing"
              />
            ) : null}
          </>
        ) : (
          <Text variant="caption">This one needs no equipment. Pick a variation below for a change of pace.</Text>
        )}
        {inWorkout && active?.session.programDayId && location === 'gym' ? (
          <ToggleRow
            label="Change my plan too"
            detail="Use the new exercise every time this day comes round."
            value={permanent}
            onValueChange={setPermanent}
            testID="swap-permanent"
          />
        ) : null}
      </Section>

      <Section title="Alternatives">
        {alternatives.length === 0 ? (
          <Text variant="subhead">Nothing fits that kit. Mark less as missing, or add equipment in settings.</Text>
        ) : (
          alternatives.map((alt, i) => (
            <Pressable
              key={alt.exercise.id}
              accessibilityRole="button"
              accessibilityLabel={`Swap to ${alt.exercise.name}. ${alt.reason}`}
              onPress={() => choose(alt.exercise.id)}
              testID={`alternative-${i}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.ms,
                padding: spacing.md,
                borderRadius: radius.lg,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: i === 0 ? 'rgba(242,169,59,0.55)' : colors.seam,
                backgroundColor: pressed ? colors.slateHigh : i === 0 ? 'rgba(242,169,59,0.08)' : colors.stone,
              })}
            >
              <View style={{ flex: 1, gap: 2 }}>
                {i === 0 ? (
                  <Text variant="label" color={colors.torch}>
                    BEST MATCH
                  </Text>
                ) : null}
                <Text variant="bodyStrong">{alt.exercise.name}</Text>
                <Text variant="caption">{alt.reason}</Text>
              </View>
              <Text variant="label" color={alt.score >= 0.75 ? colors.verdant : colors.ash}>
                {Math.round(alt.score * 100)}%
              </Text>
              <Icon name="swap" size={18} color={colors.dim} />
            </Pressable>
          ))
        )}
      </Section>
    </PageScroll>
  );
}
