import { useState } from 'react';
import { View } from 'react-native';

import { getExercise } from '@/domain/exercises';
import { estimateOneRepMax, fromDisplayWeight, suggestStartingLoad, toDisplayWeight } from '@/domain/strength';
import type { GoalKind } from '@/domain/types';
import { latestBodyweight } from '@/state/actions';
import { useGame } from '@/state/stores';
import { spacing } from '@/theme';

import { Button } from './button';
import { Chip, ChipRow } from './chip';
import { Field, parseNumber } from './field';
import { Text } from './text';

export interface GoalChoice {
  kind: GoalKind;
  target: number;
  start?: number;
  exerciseId?: string;
}

const LIFT_GOALS = ['bench_press', 'back_squat', 'deadlift', 'overhead_press'];
const SESSION_GOALS = [24, 36, 48, 72];
const round = (v: number, step: number) => Math.round(v / step) * step;

/**
 * Picks the real-world goal a dragon is bound to: a body weight, an
 * estimated max on a main lift, or a number of workouts.
 */
export function GoalForm({ submitLabel, onSubmit, testID }: { submitLabel: string; onSubmit: (goal: GoalChoice) => void; testID?: string }) {
  const profile = useGame((s) => s.profile);
  const records = useGame((s) => s.records);
  const unit = profile.unit;
  const bodyweightKg = latestBodyweight();
  const [kind, setKind] = useState<GoalKind>(profile.focus === 'fit' ? 'sessions' : 'bodyweight');
  const [sessions, setSessions] = useState(36);
  const [liftId, setLiftId] = useState(LIFT_GOALS[0]);
  const [error, setError] = useState<string | null>(null);

  const liftBestKg = (id: string): number | null => {
    const best = records[id]?.bestE1rm;
    if (best) return best;
    const load = suggestStartingLoad(getExercise(id), bodyweightKg, profile.experience, profile.sex, unit);
    return load ? estimateOneRepMax(load, 8) : null;
  };

  const suggested = (k: GoalKind, id = liftId): string => {
    if (k === 'bodyweight') {
      const factor = profile.focus === 'lean' ? 0.94 : 1.04;
      return String(round(toDisplayWeight(bodyweightKg * factor, unit), unit === 'kg' ? 0.5 : 1));
    }
    if (k === 'lift') {
      const best = liftBestKg(id);
      return best ? String(round(toDisplayWeight(best * 1.15, unit), unit === 'kg' ? 2.5 : 5)) : '';
    }
    return '';
  };

  const [targetText, setTargetText] = useState(() => suggested(kind));

  const choose = (k: GoalKind) => {
    setKind(k);
    setError(null);
    setTargetText(suggested(k));
  };

  const submit = () => {
    if (kind === 'sessions') {
      onSubmit({ kind, target: sessions });
      return;
    }
    const typed = parseNumber(targetText);
    if (typed === null) {
      setError('Enter a target.');
      return;
    }
    const targetKg = fromDisplayWeight(typed, unit);
    if (kind === 'bodyweight') {
      if (Math.abs(targetKg - bodyweightKg) < 0.5) {
        setError('Pick a target at least half a kilo from your current weight.');
        return;
      }
      onSubmit({ kind, target: targetKg });
      return;
    }
    const start = liftBestKg(liftId) ?? 0;
    if (targetKg <= start) {
      setError(`Aim above your current best of about ${Math.round(toDisplayWeight(start, unit))} ${unit}.`);
      return;
    }
    onSubmit({ kind, target: targetKg, start, exerciseId: liftId });
  };

  return (
    <View style={{ gap: spacing.md }} testID={testID}>
      <ChipRow>
        <Chip label="Body weight" selected={kind === 'bodyweight'} onPress={() => choose('bodyweight')} testID="goal-kind-bodyweight" />
        <Chip label="Strength" selected={kind === 'lift'} onPress={() => choose('lift')} testID="goal-kind-lift" />
        <Chip label="Consistency" selected={kind === 'sessions'} onPress={() => choose('sessions')} testID="goal-kind-sessions" />
      </ChipRow>
      {kind === 'sessions' ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="caption">Complete this many workouts. Showing up is the whole game.</Text>
          <ChipRow>
            {SESSION_GOALS.map((n) => (
              <Chip key={n} label={`${n} workouts`} selected={sessions === n} onPress={() => setSessions(n)} />
            ))}
          </ChipRow>
        </View>
      ) : null}
      {kind === 'bodyweight' ? (
        <Field
          label="Target body weight"
          value={targetText}
          onChangeText={(t) => {
            setTargetText(t);
            setError(null);
          }}
          keyboardType="decimal-pad"
          suffix={unit}
          error={error}
          helper={`You weigh about ${Math.round(toDisplayWeight(bodyweightKg, unit) * 10) / 10} ${unit}. A safe pace is 0.5 to 1% a week when cutting, 0.25 to 0.5% when building.`}
          testID="goal-form-target"
        />
      ) : null}
      {kind === 'lift' ? (
        <View style={{ gap: spacing.sm }}>
          <ChipRow>
            {LIFT_GOALS.map((id) => (
              <Chip
                key={id}
                label={getExercise(id).name.replace('Barbell ', '')}
                selected={liftId === id}
                onPress={() => {
                  setLiftId(id);
                  setTargetText(suggested('lift', id));
                  setError(null);
                }}
              />
            ))}
          </ChipRow>
          <Field
            label="Target estimated one rep max"
            value={targetText}
            onChangeText={(t) => {
              setTargetText(t);
              setError(null);
            }}
            keyboardType="decimal-pad"
            suffix={unit}
            error={error}
            helper={
              records[liftId]?.bestE1rm
                ? `Your best so far estimates to about ${Math.round(toDisplayWeight(records[liftId].bestE1rm, unit))} ${unit}.`
                : 'No sets logged yet, so your current best is estimated from your body weight.'
            }
            testID="goal-form-target"
          />
        </View>
      ) : null}
      <Button title={submitLabel} size="lg" onPress={submit} testID="goal-form-submit" />
    </View>
  );
}
