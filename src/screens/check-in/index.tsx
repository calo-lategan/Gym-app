import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { Icon } from '@/components/icon';
import { Panel } from '@/components/panel';
import { Stepper } from '@/components/stepper';
import { Text } from '@/components/text';
import { toast } from '@/components/toast';
import { dayKeyOf } from '@/domain/dates';
import { recoveryDay } from '@/domain/program';
import { jointLabel, scoreReadiness } from '@/domain/readiness';
import { assessPlan, MUSCLE_LABELS, recoveryTargets } from '@/domain/science';
import type { JointArea, MuscleGroup, ReadinessInput } from '@/domain/types';
import { useLatestWeight } from '@/hooks/use-game-data';
import { haptics } from '@/services/haptics';
import { play } from '@/services/sound';
import { previewDay, startWorkout, submitCheckIn, todaysProgramDay } from '@/state/actions';
import { useGame, useHistory } from '@/state/stores';
import { colors, radius, spacing } from '@/theme';

const SCALE_5 = ['Awful', 'Poor', 'Okay', 'Good', 'Great'];
const STRESS_5 = ['Calm', 'Mild', 'Some', 'High', 'Very high'];
const MUSCLES = Object.keys(MUSCLE_LABELS) as MuscleGroup[];
const JOINTS: JointArea[] = ['shoulder', 'elbow', 'wrist', 'lower_back', 'hip', 'knee', 'ankle'];
const SORENESS_LABELS = ['', 'mild', 'moderate', 'severe'];
const SORENESS_COLORS = [colors.seam, colors.torch, '#F07A3A', colors.ember];

function ScaleRow({ label, value, onChange, labels, testID }: { label: string; value: number; onChange: (v: number) => void; labels: string[]; testID: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label">{label}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {labels.map((l, i) => (
          <Pressable
            key={l}
            testID={`${testID}-${i + 1}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === i + 1 }}
            accessibilityLabel={`${label}: ${l}`}
            onPress={() => {
              haptics.tap();
              onChange(i + 1);
            }}
            style={{
              flex: 1,
              minHeight: 46,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: value === i + 1 ? colors.torch : colors.seam,
              backgroundColor: value === i + 1 ? 'rgba(242,169,59,0.16)' : colors.slate,
            }}
          >
            <Text variant="label" color={value === i + 1 ? colors.bone : colors.ash} style={{ fontSize: 12 }} numberOfLines={1}>
              {l}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function CheckInScreen() {
  const params = useLocalSearchParams<{ mode?: string; boss?: string }>();
  const mode = params.mode === 'home' ? 'home' : params.mode === 'recovery' ? 'recovery' : 'gym';
  const boss = params.boss === '1';
  const insets = useSafeAreaInsets();
  const focus = useGame((s) => s.profile.focus);
  const today = dayKeyOf(new Date());
  const previous = useHistory((s) => s.checkIns.find((c) => c.dayKey === today));
  const sessions = useHistory((s) => s.sessions);
  const bodyweight = useLatestWeight() ?? 75;

  const [input, setInput] = useState<ReadinessInput>(
    previous
      ? { sleepHours: previous.sleepHours, sleepQuality: previous.sleepQuality, energy: previous.energy, stress: previous.stress, soreness: previous.soreness, pain: previous.pain }
      : { sleepHours: 7.5, sleepQuality: 4, energy: 4, stress: 2, soreness: {}, pain: [] },
  );
  const result = useMemo(() => scoreReadiness(input), [input]);
  const preview = useMemo(
    () => previewDay({ location: mode === 'home' ? 'home' : 'gym', recovery: mode === 'recovery', readiness: { input, result }, applyAdjustments: true }),
    [input, result, mode],
  );
  const [openedAt] = useState(() => Date.now());
  const warnings = useMemo(() => {
    const plan = mode === 'recovery' ? recoveryDay() : todaysProgramDay();
    return plan ? assessPlan(plan, sessions, today, openedAt) : [];
  }, [mode, sessions, today, openedAt]);
  const targets = recoveryTargets(bodyweight, focus, mode !== 'recovery');

  const set = <K extends keyof ReadinessInput>(key: K, value: ReadinessInput[K]) => setInput((i) => ({ ...i, [key]: value }));
  const cycleSoreness = (m: MuscleGroup) => {
    const current = input.soreness[m] ?? 0;
    const next = ((current + 1) % 4) as 0 | 1 | 2 | 3;
    set('soreness', { ...input.soreness, [m]: next });
  };
  const togglePain = (j: JointArea) => set('pain', input.pain.includes(j) ? input.pain.filter((p) => p !== j) : [...input.pain, j]);

  const begin = (applyAdjustments: boolean, recordCheckIn = true, recoveryOverride = false) => {
    if (recordCheckIn) {
      const outcome = submitCheckIn(input, result);
      if (outcome.xp > 0) toast({ title: `+${outcome.xp} XP for checking in`, detail: outcome.vit ? 'Vitality +1 for steady check-ins' : undefined, icon: 'heart', tone: 'verdant' });
    }
    const ok = startWorkout({
      location: mode === 'home' ? 'home' : 'gym',
      recovery: mode === 'recovery' || recoveryOverride,
      readiness: recordCheckIn ? { input, result } : null,
      applyAdjustments,
      bossAttempt: boss,
    });
    if (!ok) {
      toast({ title: 'No plan found', detail: 'Create a plan in the Plan tab first.', icon: 'warning', tone: 'ember' });
      return;
    }
    play('setStart');
    haptics.impact();
    router.replace('/workout');
  };

  const bandColor = result.band === 'ready' ? colors.verdant : result.band === 'steady' ? colors.torch : result.band === 'tired' ? '#F07A3A' : colors.ember;

  return (
    <View style={{ flex: 1, backgroundColor: colors.abyss }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl }} contentInsetAdjustmentBehavior="automatic">
        <View style={{ gap: spacing.xs }}>
          <Text variant="display">How is your body today?</Text>
          <Text variant="subhead">Thirty seconds. It tunes today&apos;s session so you can train hard without digging a recovery hole.</Text>
        </View>

        <View style={{ gap: spacing.md }}>
          <Stepper label="Hours slept" value={input.sleepHours} min={3} max={12} step={0.5} onChange={(v) => set('sleepHours', v)} format={(v) => `${v} h`} testID="sleep-hours" />
          <ScaleRow label="Sleep quality" value={input.sleepQuality} onChange={(v) => set('sleepQuality', v)} labels={SCALE_5} testID="sleep-quality" />
          <ScaleRow label="Energy" value={input.energy} onChange={(v) => set('energy', v)} labels={SCALE_5} testID="energy" />
          <ScaleRow label="Stress" value={input.stress} onChange={(v) => set('stress', v)} labels={STRESS_5} testID="stress" />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="label">Sore muscles. Tap again for worse.</Text>
          <ChipRow>
            {MUSCLES.map((m) => {
              const level = input.soreness[m] ?? 0;
              return (
                <Pressable
                  key={m}
                  testID={`sore-${m}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${MUSCLE_LABELS[m]} soreness ${level ? SORENESS_LABELS[level] : 'none'}`}
                  onPress={() => {
                    haptics.tap();
                    cycleSoreness(m);
                  }}
                  style={{
                    minHeight: 44,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: SORENESS_COLORS[level],
                    backgroundColor: level ? `${SORENESS_COLORS[level]}22` : colors.slate,
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="label" color={level ? colors.bone : colors.ash} style={{ fontSize: 14 }}>
                    {MUSCLE_LABELS[m]}
                    {level ? `, ${SORENESS_LABELS[level]}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ChipRow>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="label">Any joint pain? Sharp or pinching, not muscle soreness.</Text>
          <ChipRow>
            {JOINTS.map((j) => (
              <Chip key={j} label={jointLabel(j)} selected={input.pain.includes(j)} onPress={() => togglePain(j)} tone="ember" testID={`pain-${j}`} />
            ))}
          </ChipRow>
        </View>

        <Panel tone={result.band === 'ready' ? 'stone' : result.band === 'drained' ? 'ember' : 'torch'} testID="readiness-result">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.ms }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: bandColor, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="stat" color={bandColor}>
                {result.score}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="headline">{result.headline}</Text>
              <Text variant="caption">Readiness score out of 100</Text>
            </View>
          </View>
          {result.notes.map((n) => (
            <Text key={n} variant="subhead">
              {n}
            </Text>
          ))}
          {preview && preview.changes.length > 0 ? (
            <View style={{ gap: spacing.xs }}>
              <Text variant="label" color={colors.torch}>
                Suggested changes
              </Text>
              {preview.changes.map((c) => (
                <View key={c} style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Icon name="check" size={16} color={colors.torch} />
                  <Text variant="subhead" style={{ flex: 1 }}>
                    {c}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Panel>

        {warnings.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            {warnings.map((w) => (
              <Panel key={w.id} tone={w.level === 'danger' ? 'ember' : 'torch'}>
                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                  <Icon name="warning" size={18} color={w.level === 'danger' ? colors.ember : colors.torch} />
                  <Text variant="headline" style={{ flex: 1 }}>
                    {w.title}
                  </Text>
                </View>
                <Text variant="subhead">{w.detail}</Text>
              </Panel>
            ))}
          </View>
        ) : null}

        <Panel>
          <Text variant="headline">Recovery targets for your weight</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Icon name="food" size={18} color={colors.torch} />
              <Text variant="number">
                {targets.proteinG[0]} to {targets.proteinG[1]} g
              </Text>
              <Text variant="caption">protein a day</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Icon name="water" size={18} color={colors.frost} />
              <Text variant="number">{(targets.waterMl / 1000).toFixed(1)} L</Text>
              <Text variant="caption">water today</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Icon name="bed" size={18} color={colors.arcane} />
              <Text variant="number">
                {targets.sleepHours[0]} to {targets.sleepHours[1]} h
              </Text>
              <Text variant="caption">sleep tonight</Text>
            </View>
          </View>
        </Panel>
      </ScrollView>

      <View style={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.seam }}>
        {mode === 'recovery' ? (
          <Button title="Begin recovery rite" icon="heart" size="lg" onPress={() => begin(false)} testID="begin-recovery" />
        ) : result.band === 'drained' ? (
          <>
            <Button title="Do a recovery rite instead" icon="heart" size="lg" onPress={() => begin(false, true, true)} testID="begin-recovery-instead" />
            <Button title="Train lighter anyway" variant="secondary" onPress={() => begin(true)} testID="begin-adjusted" />
          </>
        ) : preview && preview.changes.length > 0 ? (
          <>
            <Button title="Fight with these changes" icon="swords" size="lg" onPress={() => begin(true)} testID="begin-adjusted" />
            <Button title="Keep the full plan" variant="secondary" onPress={() => begin(false)} testID="begin-full" />
          </>
        ) : (
          <Button title="To battle" icon="swords" size="lg" onPress={() => begin(false)} testID="begin-full" />
        )}
        <Button title="Skip check-in" variant="ghost" size="sm" onPress={() => begin(false, false)} testID="skip-check-in" />
      </View>
    </View>
  );
}
