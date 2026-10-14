import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { Field, parseNumber } from '@/components/field';
import { OptionCard } from '@/components/option-card';
import { Text } from '@/components/text';
import { TimePicker } from '@/components/time-picker';
import { WEEKDAY_SHORT } from '@/domain/dates';
import { getExercise } from '@/domain/exercises';
import { dragonForTier } from '@/domain/game/dragon';
import { HERO_CLASSES, newHero } from '@/domain/game/progression';
import { ALL_EQUIPMENT, EQUIPMENT_LABELS } from '@/domain/substitution';
import { estimateOneRepMax, fromDisplayWeight, suggestStartingLoad, toDisplayWeight } from '@/domain/strength';
import type { ClockTime, EquipmentId, Experience, Focus, GoalKind, HeroClass, Sex, WeightUnit } from '@/domain/types';
import { HeroShowcase } from '@/game3d/scenes/hero-showcase';
import { requestNotificationPermission, syncReminders } from '@/services/notifications';
import { play } from '@/services/sound';
import { completeOnboarding } from '@/state/actions';
import { colors, radius, spacing } from '@/theme';

const STEPS = ['Hero', 'Goal', 'Body', 'Schedule', 'Gear', 'Ready'] as const;
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const LIFT_GOALS = ['bench_press', 'back_squat', 'deadlift', 'overhead_press'];

const round = (v: number, step = 0.5) => Math.round(v / step) * step;

export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [heroClass, setHeroClass] = useState<HeroClass>('knight');
  const [focus, setFocus] = useState<Focus>('fit');
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [weightText, setWeightText] = useState('');
  const [experience, setExperience] = useState<Experience>('beginner');
  const [sex, setSex] = useState<Sex>('unspecified');
  const [goalKind, setGoalKind] = useState<GoalKind>('sessions');
  const [targetText, setTargetText] = useState('');
  const [liftId, setLiftId] = useState('bench_press');
  const [liftStartText, setLiftStartText] = useState('');
  const [sessionTarget, setSessionTarget] = useState(36);
  const [days, setDays] = useState<boolean[]>([false, true, true, false, true, true, false]);
  const [time, setTime] = useState<ClockTime>({ hour: 18, minute: 0 });
  const [gym, setGym] = useState<EquipmentId[]>(['barbell', 'rack', 'bench', 'dumbbells', 'cable', 'machines', 'pullup_bar']);
  const [home, setHome] = useState<EquipmentId[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const previewHero = useMemo(() => newHero(name || 'Hero', heroClass), [name, heroClass]);
  const bodyweightKg = useMemo(() => {
    const v = parseNumber(weightText);
    return v === null ? null : fromDisplayWeight(v, unit);
  }, [weightText, unit]);

  const chooseFocus = (f: Focus) => {
    setFocus(f);
    setGoalKind(f === 'fit' ? 'sessions' : 'bodyweight');
    setTargetText('');
  };

  const validate = (): string | null => {
    if (step === 0 && !name.trim()) return 'Give your hero a name.';
    if (step === 2) {
      if (bodyweightKg === null || bodyweightKg < 30 || bodyweightKg > 300)
        return 'Enter your body weight so the app can scale loads and recovery advice.';
    }
    if (step === 1 || step === 5) {
      if (goalKind === 'bodyweight' && step === 5) {
        const t = parseNumber(targetText);
        if (t === null) return 'Set a target body weight on the Goal step.';
      }
    }
    if (step === 3 && !days.some(Boolean)) return 'Pick at least one training day.';
    return null;
  };

  const defaultTarget = (): number | null => {
    if (bodyweightKg === null) return null;
    if (goalKind === 'bodyweight') return round(toDisplayWeight(bodyweightKg * (focus === 'lean' ? 0.92 : 1.05), unit), unit === 'kg' ? 0.5 : 1);
    if (goalKind === 'lift') {
      const start = liftStartKg();
      return start ? round(toDisplayWeight(start * 1.2, unit), unit === 'kg' ? 2.5 : 5) : null;
    }
    return null;
  };

  const liftStartKg = (): number | null => {
    const typed = parseNumber(liftStartText);
    if (typed !== null) return fromDisplayWeight(typed, unit);
    if (bodyweightKg === null) return null;
    const load = suggestStartingLoad(getExercise(liftId), bodyweightKg, experience, sex, unit);
    return load ? estimateOneRepMax(load, 8) : null;
  };

  const next = () => {
    const problem = validate();
    setError(problem);
    if (problem) return;
    play('tap');
    if (step === 2 && goalKind !== 'sessions' && !targetText) {
      const t = defaultTarget();
      if (t !== null) setTargetText(String(t));
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const finish = async () => {
    if (bodyweightKg === null) {
      setStep(2);
      setError('Enter your body weight.');
      return;
    }
    const target = goalKind === 'sessions' ? sessionTarget : parseNumber(targetText);
    if (target === null) {
      setStep(1);
      setError('Set your goal target.');
      return;
    }
    const targetKg = goalKind === 'sessions' ? target : fromDisplayWeight(target, unit);
    if (goalKind === 'bodyweight' && Math.abs(targetKg - bodyweightKg) < 0.5) {
      setStep(1);
      setError('Your target needs to differ from your current weight.');
      return;
    }
    const start = goalKind === 'lift' ? (liftStartKg() ?? 0) : undefined;
    if (goalKind === 'lift' && start !== undefined && targetKg <= start) {
      setStep(1);
      setError('Your strength target must be above your current best.');
      return;
    }
    setSaving(true);
    play('levelUp');
    completeOnboarding({
      name,
      heroClass,
      focus,
      experience,
      sex,
      unit,
      bodyweightKg,
      heightCm: null,
      birthYear: null,
      trainingDays: days,
      reminderTime: time,
      gymEquipment: gym,
      homeEquipment: home,
      goal: { kind: goalKind, target: targetKg, start, exerciseId: goalKind === 'lift' ? liftId : undefined },
    });
    await requestNotificationPermission();
    await syncReminders();
    router.replace('/');
  };

  const dragon = dragonForTier(1);
  const unitLabel = unit;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.abyss }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {STEPS.map((s, i) => (
            <View key={s} style={{ flex: 1, height: 4, borderRadius: radius.full, backgroundColor: i <= step ? colors.torch : colors.slateHigh }} />
          ))}
        </View>
        <Text variant="label" color={colors.dim}>
          Step {step + 1} of {STEPS.length}
        </Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl }}>
        {step === 0 ? (
          <>
            <View>
              <Text variant="hero">Forge your hero</Text>
              <Text variant="subhead">Every workout you finish makes them stronger. Every record you break takes them deeper.</Text>
            </View>
            <View style={{ height: 280, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.seam }}>
              <HeroShowcase hero={previewHero} />
            </View>
            <Field label="Hero name" value={name} onChangeText={setName} placeholder="Name your hero" testID="hero-name" maxLength={20} />
            <View style={{ gap: spacing.sm }}>
              {HERO_CLASSES.map((c) => (
                <OptionCard
                  key={c.id}
                  title={c.name}
                  detail={c.blurb}
                  selected={heroClass === c.id}
                  onPress={() => setHeroClass(c.id)}
                  testID={`class-${c.id}`}
                  icon="swords"
                />
              ))}
            </View>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <View>
              <Text variant="hero">Choose your quest</Text>
              <Text variant="subhead">Your plan, rep ranges and rewards are tuned to this.</Text>
            </View>
            <View style={{ gap: spacing.sm }}>
              <OptionCard
                title="Grow"
                detail="Build muscle and strength. Heavier sets, longer rests."
                icon="bolt"
                selected={focus === 'grow'}
                onPress={() => chooseFocus('grow')}
                testID="focus-grow"
              />
              <OptionCard
                title="Get fit"
                detail="Feel stronger and healthier. Balanced strength and conditioning."
                icon="heart"
                selected={focus === 'fit'}
                onPress={() => chooseFocus('fit')}
                testID="focus-fit"
              />
              <OptionCard
                title="Get lean"
                detail="Lose fat and keep your muscle. Higher reps, short rests, finishers."
                icon="run"
                selected={focus === 'lean'}
                onPress={() => chooseFocus('lean')}
                testID="focus-lean"
              />
            </View>
            <View style={{ gap: spacing.sm }}>
              <Text variant="heading">
                Slay {dragon.name}, {dragon.epithet}
              </Text>
              <Text variant="subhead">
                The dragon at the bottom of the dungeon can only be killed when you reach your real goal. Pick what that goal is.
              </Text>
              <ChipRow>
                <Chip label="Body weight" selected={goalKind === 'bodyweight'} onPress={() => setGoalKind('bodyweight')} testID="goal-bodyweight" />
                <Chip label="Strength" selected={goalKind === 'lift'} onPress={() => setGoalKind('lift')} testID="goal-lift" />
                <Chip label="Consistency" selected={goalKind === 'sessions'} onPress={() => setGoalKind('sessions')} testID="goal-sessions" />
              </ChipRow>
              {goalKind === 'sessions' ? (
                <View style={{ gap: spacing.sm }}>
                  <Text variant="caption">Complete this many workouts. Showing up is the whole game.</Text>
                  <ChipRow>
                    {[24, 36, 48, 72].map((n) => (
                      <Chip key={n} label={`${n} workouts`} selected={sessionTarget === n} onPress={() => setSessionTarget(n)} />
                    ))}
                  </ChipRow>
                </View>
              ) : null}
              {goalKind === 'bodyweight' ? (
                <Field
                  label="Target body weight"
                  value={targetText}
                  onChangeText={setTargetText}
                  keyboardType="decimal-pad"
                  suffix={unitLabel}
                  placeholder="Suggested on the next step"
                  helper="A safe pace is 0.5 to 1% of body weight a week when cutting, about 0.25 to 0.5% when building."
                  testID="goal-target"
                />
              ) : null}
              {goalKind === 'lift' ? (
                <View style={{ gap: spacing.sm }}>
                  <ChipRow>
                    {LIFT_GOALS.map((id) => (
                      <Chip key={id} label={getExercise(id).name.replace('Barbell ', '')} selected={liftId === id} onPress={() => setLiftId(id)} />
                    ))}
                  </ChipRow>
                  <Field
                    label="Current best estimate (one rep)"
                    value={liftStartText}
                    onChangeText={setLiftStartText}
                    keyboardType="decimal-pad"
                    suffix={unitLabel}
                    placeholder="Leave empty and we will estimate it"
                  />
                  <Field
                    label="Target one rep max"
                    value={targetText}
                    onChangeText={setTargetText}
                    keyboardType="decimal-pad"
                    suffix={unitLabel}
                    placeholder="For example 20% above your best"
                    testID="goal-target"
                  />
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <View>
              <Text variant="hero">Your build</Text>
              <Text variant="subhead">Used to suggest starting weights, protein, water and safe weekly changes. It stays on your phone.</Text>
            </View>
            <ChipRow>
              <Chip label="Kilograms" selected={unit === 'kg'} onPress={() => setUnit('kg')} testID="unit-kg" />
              <Chip label="Pounds" selected={unit === 'lb'} onPress={() => setUnit('lb')} testID="unit-lb" />
            </ChipRow>
            <Field
              label="Body weight"
              value={weightText}
              onChangeText={setWeightText}
              keyboardType="decimal-pad"
              suffix={unitLabel}
              placeholder={unit === 'kg' ? '80' : '176'}
              testID="bodyweight"
            />
            <View style={{ gap: spacing.sm }}>
              <Text variant="label">Training experience</Text>
              <OptionCard
                title="New or returning"
                detail="Less than 6 months of steady lifting"
                selected={experience === 'beginner'}
                onPress={() => setExperience('beginner')}
                testID="exp-beginner"
              />
              <OptionCard
                title="Intermediate"
                detail="6 months to 2 years of regular training"
                selected={experience === 'intermediate'}
                onPress={() => setExperience('intermediate')}
                testID="exp-intermediate"
              />
              <OptionCard
                title="Advanced"
                detail="More than 2 years of consistent training"
                selected={experience === 'advanced'}
                onPress={() => setExperience('advanced')}
                testID="exp-advanced"
              />
            </View>
            <View style={{ gap: spacing.sm }}>
              <Text variant="label">Sex, for starting weight estimates only</Text>
              <ChipRow>
                <Chip label="Male" selected={sex === 'male'} onPress={() => setSex('male')} />
                <Chip label="Female" selected={sex === 'female'} onPress={() => setSex('female')} />
                <Chip label="Prefer not to say" selected={sex === 'unspecified'} onPress={() => setSex('unspecified')} />
              </ChipRow>
            </View>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <View>
              <Text variant="hero">Training days</Text>
              <Text variant="subhead">Completing a training day earns +1 Strength and keeps your streak lit. Rest days never break it.</Text>
            </View>
            <ChipRow>
              {WEEK_ORDER.map((d) => (
                <Chip
                  key={d}
                  label={WEEKDAY_SHORT[d]}
                  selected={days[d]}
                  onPress={() => setDays((prev) => prev.map((v, i) => (i === d ? !v : v)))}
                  testID={`day-${d}`}
                />
              ))}
            </ChipRow>
            <Text variant="caption">
              {days.filter(Boolean).length} training days a week. 3 to 5 suits most people; your plan adapts to the number you pick.
            </Text>
            <View style={{ gap: spacing.sm }}>
              <Text variant="label">Gym time</Text>
              <TimePicker value={time} onChange={setTime} testID="gym-time" />
              <Text variant="caption">You get a reminder at this time on training days. You can move any single session earlier or later.</Text>
            </View>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <View>
              <Text variant="hero">Your armory</Text>
              <Text variant="subhead">Pick what your gym has. Missing something later? Swap any exercise in one tap.</Text>
            </View>
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="label">At the gym</Text>
                <Button
                  title={gym.length === ALL_EQUIPMENT.length ? 'Clear' : 'Full gym'}
                  variant="ghost"
                  size="sm"
                  onPress={() => setGym(gym.length === ALL_EQUIPMENT.length ? [] : ALL_EQUIPMENT)}
                />
              </View>
              <ChipRow>
                {ALL_EQUIPMENT.map((q) => (
                  <Chip
                    key={q}
                    label={EQUIPMENT_LABELS[q]}
                    selected={gym.includes(q)}
                    onPress={() => setGym((g) => (g.includes(q) ? g.filter((x) => x !== q) : [...g, q]))}
                    testID={`gym-${q}`}
                  />
                ))}
              </ChipRow>
            </View>
            <View style={{ gap: spacing.sm }}>
              <Text variant="label">At home</Text>
              <Text variant="caption">Nothing at all is fine. Home sessions use body weight versions of your plan, so there are no excuses.</Text>
              <ChipRow>
                {(['dumbbells', 'kettlebell', 'bands', 'pullup_bar', 'bench'] as EquipmentId[]).map((q) => (
                  <Chip
                    key={q}
                    label={EQUIPMENT_LABELS[q]}
                    selected={home.includes(q)}
                    onPress={() => setHome((h) => (h.includes(q) ? h.filter((x) => x !== q) : [...h, q]))}
                    testID={`home-${q}`}
                  />
                ))}
              </ChipRow>
            </View>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <View>
              <Text variant="hero">The gate opens</Text>
              <Text variant="subhead">Here is how the dungeon works.</Text>
            </View>
            <View style={{ gap: spacing.ms }}>
              {[
                ['Finish a training day', '+1 Strength, XP, gold and a treasure chest. Each workout clears a room.'],
                ['Break a personal record', 'More weight, more reps or a faster set. Records break the seal on each floor gate.'],
                ['Face the minibosses', 'Every fifth floor holds a guardian with a challenge built from your own numbers. One attempt a week.'],
                ['Reach your goal', `Only then can you slay ${dragon.name}. Its ward shrinks as you close in.`],
              ].map(([title, detail]) => (
                <View key={title} style={{ flexDirection: 'row', gap: spacing.ms }}>
                  <View style={{ width: 10, height: 10, marginTop: 7, borderRadius: 5, backgroundColor: colors.torch }} />
                  <View style={{ flex: 1 }}>
                    <Text variant="headline">{title}</Text>
                    <Text variant="subhead">{detail}</Text>
                  </View>
                </View>
              ))}
            </View>
            <Text variant="caption">
              Next, the app asks to send notifications so it can remind you at your gym time. You can change this in settings.
            </Text>
          </>
        ) : null}

        {error ? (
          <Text variant="bodyStrong" color={colors.ember} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          gap: spacing.sm,
          padding: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.seam,
          backgroundColor: colors.abyss,
        }}
      >
        {step > 0 ? (
          <Button title="Back" variant="secondary" onPress={() => setStep((s) => s - 1)} style={{ flex: 1 }} testID="onboarding-back" />
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button title="Next" onPress={next} style={{ flex: 2 }} testID="onboarding-next" />
        ) : (
          <Button
            title="Enter the dungeon"
            icon="swords"
            onPress={finish}
            loading={saving}
            style={{ flex: 2 }}
            testID="onboarding-finish"
            sound={null}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
