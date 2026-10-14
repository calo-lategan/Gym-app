import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut, FadeOutUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/button';
import { Icon } from '@/components/icon';
import { ProgressBar } from '@/components/progress-bar';
import { Stepper } from '@/components/stepper';
import { Text } from '@/components/text';
import { getExercise } from '@/domain/exercises';
import { zoneForFloor } from '@/domain/game/dungeon';
import { setsNeededToComplete } from '@/domain/game/rewards';
import { PR_LABELS, setDuration, type PrEvent } from '@/domain/records';
import { checkLoadJump } from '@/domain/science';
import { displayWeightValue, formatWeight, fromDisplayWeight, KG_PER_LB } from '@/domain/strength';
import { BattleScene } from '@/game3d/scenes/battle-scene';
import { haptics } from '@/services/haptics';
import { cancelRestAlert, scheduleRestAlert } from '@/services/notifications';
import { play, preload } from '@/services/sound';
import {
  adjustTargetSets,
  cancelSet,
  deleteSet,
  discardWorkout,
  editSet,
  extendRest,
  finishWorkout,
  lastTimeFor,
  logSet,
  selectExercise,
  skipRest,
  startSet,
  suggestionFor,
} from '@/state/actions';
import { useGame } from '@/state/stores';
import { colors, fonts, radius, spacing } from '@/theme';

const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

interface Floater {
  id: number;
  text: string;
  color: string;
}

export function WorkoutScreen() {
  useKeepAwake(undefined, { suppressDeactivateWarnings: true });
  const insets = useSafeAreaInsets();
  const active = useGame((s) => s.active);
  const hero = useGame((s) => s.hero);
  const floor = useGame((s) => s.dungeon.floor);
  const unit = useGame((s) => s.profile.unit);
  const records = useGame((s) => s.records);
  const graphics = useGame((s) => s.settings.graphics);
  const [now, setNow] = useState(() => Date.now());
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [prBanner, setPrBanner] = useState<PrEvent[] | null>(null);
  const [strike, setStrike] = useState({ key: 0, crit: false });
  const [cheerKey, setCheerKey] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const floaterId = useRef(0);
  const restAnnounced = useRef<number | null>(null);

  useEffect(() => {
    preload(['setStart', 'setEnd', 'hit', 'crit', 'monsterDeath', 'pr', 'restDone', 'countdown', 'xpTick']);
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const index = active?.current ?? 0;
  const ex = active?.session.exercises[index];
  const exercise = ex ? getExercise(ex.exerciseId) : null;
  const isBoss = active?.bossIndex === index;
  const suggestion = useMemo(() => (ex ? suggestionFor(ex.exerciseId, ex.repMin, ex.repMax) : null), [ex?.exerciseId, ex?.repMin, ex?.repMax]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastTime = useMemo(() => (ex ? lastTimeFor(ex.exerciseId) : []), [ex?.exerciseId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draft values for the next set, prefilled from the last set or the plan.
  const [draft, setDraft] = useState({ weight: 0, reps: 8 });
  const draftFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ex) return;
    const key = `${index}:${ex.exerciseId}`;
    if (draftFor.current === key) return;
    draftFor.current = key;
    const last = ex.sets.at(-1);
    const reps = last?.reps ?? (isBoss ? ex.repMin : (suggestion?.reps ?? Math.round((ex.repMin + ex.repMax) / 2)));
    setDraft({ weight: last?.weight ?? ex.targetWeight ?? 0, reps });
  }, [ex, index, isBoss, suggestion]);

  // Rest finished while the screen is open: chime once.
  useEffect(() => {
    if (!active?.restEndsAt) return;
    const left = (active.restEndsAt - now) / 1000;
    if (left <= 3.2 && left > 0 && restAnnounced.current !== Math.ceil(left)) {
      restAnnounced.current = Math.ceil(left);
      play('countdown', 0.6);
    }
    if (left <= 0) {
      restAnnounced.current = null;
      play('restDone');
      haptics.success();
      skipRest();
    }
  }, [now, active?.restEndsAt]);

  if (!active || !ex || !exercise) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.abyss, padding: spacing.lg }}>
        <Text variant="title">No quest in progress</Text>
        <Button title="Back to camp" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const session = active.session;
  const timed = exercise.measure === 'time';
  const loaded = exercise.externalLoad || draft.weight > 0;
  const weightStep = unit === 'kg' ? (exercise.equipment.includes('dumbbells') ? 1 : 2.5) : 5;
  const running = active.running;
  const resting = !running && active.restEndsAt !== null && active.restEndsAt > now;
  const totalDone = session.exercises.reduce((n, e) => n + e.sets.length, 0);
  const totalPlanned = session.exercises.reduce((n, e) => n + e.targetSets, 0);
  const allDone = session.exercises.every((e) => e.sets.length >= e.targetSets);
  const exerciseDone = ex.sets.length >= ex.targetSets;
  const needed = setsNeededToComplete(session);
  const zone = zoneForFloor(floor);
  const monsterKind = isBoss ? 'skeleton_warrior' : zone.monsters[index % zone.monsters.length];
  const monsterName = isBoss ? (ex.note?.replace('Miniboss: ', '') ?? 'Guardian') : zone.monsterNames[index % zone.monsterNames.length];
  const hp = Math.max(0, 1 - ex.sets.length / ex.targetSets);
  const jump = checkLoadJump(exercise, draft.weight, records[ex.exerciseId], unit);
  const elapsed = (now - session.startedAt) / 1000;
  const nextUp = session.exercises.find((e, i) => i !== index && e.sets.length < e.targetSets);

  const float = (text: string, color: string) => {
    const id = ++floaterId.current;
    setFloaters((f) => [...f, { id, text, color }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 1300);
  };

  const onStart = () => {
    void cancelRestAlert();
    if (jump) haptics.warning();
    startSet();
    play('setStart', 0.8);
    haptics.light();
  };

  const onEnd = () => {
    const weightKg = draft.weight;
    const result = logSet({ reps: draft.reps, weight: weightKg });
    if (!result) return;
    const crit = result.prs.length > 0;
    setStrike((s) => ({ key: s.key + 1, crit }));
    play('setEnd', 0.75);
    setTimeout(() => {
      play(crit ? 'crit' : 'hit');
      haptics.impact();
      float(`+${isBoss ? 30 : 10} XP`, colors.torchHigh);
      if (result.exerciseDone) {
        setTimeout(() => play('monsterDeath', 0.8), 250);
        float(isBoss ? (result.bossDefeated ? 'Boss defeated' : 'The boss endures') : 'Foe defeated', result.bossDefeated || !isBoss ? colors.verdant : colors.ember);
      }
    }, 260);
    if (crit) {
      setTimeout(() => {
        setPrBanner(result.prs);
        setCheerKey((k) => k + 1);
        play('pr');
        haptics.success();
      }, 450);
      setTimeout(() => setPrBanner(null), 2800);
    }
    if (result.restSec > 0) {
      const next = useGame.getState().active;
      const upcoming = next ? getExercise(next.session.exercises[next.current].exerciseId).name : exercise.name;
      void scheduleRestAlert(result.restSec, upcoming);
    }
  };

  const onFinish = () => {
    const done = () => {
      void cancelRestAlert();
      const outcome = finishWorkout();
      if (outcome) router.replace('/victory');
    };
    if (totalDone < needed) {
      Alert.alert(
        'Finish early?',
        `You have ${totalDone} of ${needed} sets needed to clear the room. You still keep the XP for every set.`,
        [
          { text: 'Keep fighting', style: 'cancel' },
          { text: 'Finish anyway', onPress: done },
        ],
      );
      if (process.env.EXPO_OS === 'web') done();
      return;
    }
    done();
  };

  const onQuit = () => {
    const quit = () => {
      void cancelRestAlert();
      discardWorkout();
      router.replace('/');
    };
    Alert.alert('Leave the dungeon?', 'Leaving now abandons this quest and its rewards.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Finish and claim', onPress: onFinish },
      { text: 'Abandon quest', style: 'destructive', onPress: quit },
    ]);
  };

  const weightLabel = unit === 'kg' ? 'kg' : 'lb';
  const displayWeight = displayWeightValue(draft.weight, unit);

  return (
    <View style={{ flex: 1, backgroundColor: colors.abyss }}>
      {/* Battle view */}
      <View style={{ height: graphics === 'full' ? '36%' : 150 }}>
        {graphics === 'full' ? (
          <BattleScene
            hero={hero}
            floor={floor}
            monster={{ kind: monsterKind, boss: isBoss, id: `${index}-${ex.exerciseId}` }}
            strikeKey={strike.key}
            crit={strike.crit}
            monsterDead={exerciseDone}
            cheerKey={cheerKey}
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.stone, experimental_backgroundImage: `radial-gradient(circle at 50% 120%, ${zone.light}55 0%, transparent 70%)` }} />
        )}
        <View style={{ position: 'absolute', top: insets.top + spacing.xs, left: spacing.sm, right: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <IconButton icon="close" label="Leave workout" tone="filled" onPress={onQuit} testID="quit-workout" />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="label" color={colors.bone} style={{ textShadowColor: '#000', textShadowRadius: 6 }}>
              {session.title}
            </Text>
            <Text variant="number" style={{ textShadowColor: '#000', textShadowRadius: 6 }}>
              {clock(elapsed)}
            </Text>
          </View>
          <View style={{ minWidth: 48, alignItems: 'flex-end' }}>
            <Text variant="number" style={{ textShadowColor: '#000', textShadowRadius: 6 }} testID="sets-progress">
              {totalDone}/{totalPlanned}
            </Text>
            <Text variant="label">sets</Text>
          </View>
        </View>
        <View style={{ position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.sm, gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="label" color={isBoss ? colors.ember : colors.bone} style={{ textShadowColor: '#000', textShadowRadius: 6 }}>
              {monsterName}
            </Text>
            <Text variant="label" style={{ textShadowColor: '#000', textShadowRadius: 6 }}>
              {ex.targetSets - Math.min(ex.sets.length, ex.targetSets)} HP
            </Text>
          </View>
          <ProgressBar value={hp} tone="hp" height={8} durationMs={350} accessibilityLabel={`${monsterName} health`} />
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', right: '10%', top: '26%', alignItems: 'flex-end', gap: 2 }}>
          {floaters.map((f) => (
            <Animated.View key={f.id} entering={ZoomIn.duration(180)} exiting={FadeOutUp.duration(500)}>
              <Text style={{ fontFamily: fonts.display, fontSize: 26, lineHeight: 30, color: f.color, textShadowColor: '#000', textShadowRadius: 8 }}>{f.text}</Text>
            </Animated.View>
          ))}
        </View>
      </View>

      {/* Exercise strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        {session.exercises.map((e, i) => {
          const done = e.sets.length >= e.targetSets;
          const selected = i === index;
          return (
            <Pressable
              key={`${e.slotId}-${i}`}
              testID={`exercise-tab-${i}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${getExercise(e.exerciseId).name}, ${e.sets.length} of ${e.targetSets} sets`}
              onPress={() => {
                haptics.tap();
                selectExercise(i);
              }}
              style={{
                paddingHorizontal: spacing.ms,
                minHeight: 40,
                justifyContent: 'center',
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: selected ? colors.torch : active.bossIndex === i ? colors.ember : colors.seam,
                backgroundColor: selected ? 'rgba(242,169,59,0.16)' : done ? 'rgba(102,212,156,0.12)' : colors.slate,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {done ? <Icon name="check" size={14} color={colors.verdant} /> : null}
              <Text variant="label" color={selected ? colors.bone : colors.ash} numberOfLines={1}>
                {getExercise(e.exerciseId).name.replace(/^(Barbell|Dumbbell) /, '')} {e.sets.length}/{e.targetSets}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.ms }}>
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="title" style={{ flex: 1 }} numberOfLines={2} testID="current-exercise">
              {exercise.name}
            </Text>
            <IconButton icon="swap" label="Swap exercise" tone="filled" onPress={() => router.push(`/swap?index=${index}`)} testID="swap-exercise" />
          </View>
          <Text variant="subhead">
            {isBoss
              ? `Boss challenge: ${ex.repMin} ${timed ? 'seconds' : 'reps'}${ex.targetWeight ? ` at ${formatWeight(ex.targetWeight, unit)}` : ''}, one set`
              : `${ex.targetSets} sets of ${ex.repMin}${ex.repMax !== ex.repMin ? ` to ${ex.repMax}` : ''} ${timed ? 'seconds' : 'reps'}${ex.targetWeight ? ` at ${formatWeight(ex.targetWeight, unit)}` : ''}, rest ${clock(ex.restSec)}`}
          </Text>
          {lastTime.length > 0 && !isBoss ? (
            <Text variant="caption">
              Last time: {lastTime.map((s) => (s.weight > 0 ? `${displayWeightValue(s.weight, unit)}×${s.reps}` : `${s.reps}${timed ? 's' : ''}`)).join(', ')}
            </Text>
          ) : null}
          {suggestion && !isBoss ? (
            <Text variant="caption" color={colors.torch}>
              {suggestion.reason}
            </Text>
          ) : null}
          <Text variant="caption" color={colors.dim}>
            {exercise.cue}
          </Text>
        </View>

        {ex.sets.length > 0 ? (
          <View style={{ gap: 6 }}>
            {ex.sets.map((s, i) => {
              const prs = active.livePrs.filter((p) => p.setId === s.id);
              const duration = setDuration(s);
              const open = editing === s.id;
              return (
                <View key={s.id}>
                  <Pressable
                    testID={`set-row-${i}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Set ${i + 1}. Tap to edit.`}
                    onPress={() => setEditing(open ? null : s.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.ms,
                      paddingHorizontal: spacing.ms,
                      minHeight: 48,
                      borderRadius: radius.md,
                      backgroundColor: colors.stone,
                      borderWidth: 1,
                      borderColor: prs.length ? colors.torch : colors.seam,
                    }}
                  >
                    <Text variant="label" style={{ width: 44 }}>
                      Set {i + 1}
                    </Text>
                    <Text variant="number" style={{ flex: 1 }}>
                      {s.weight > 0 ? `${displayWeightValue(s.weight, unit)} ${weightLabel} × ` : ''}
                      {s.reps}
                      {timed ? ' s' : ' reps'}
                    </Text>
                    {prs.length ? <Icon name="trophy" size={16} color={colors.torch} /> : null}
                    <Text variant="caption" style={{ fontVariant: ['tabular-nums'] }}>
                      {duration ? clock(duration) : 'untimed'}
                    </Text>
                  </Pressable>
                  {open ? (
                    <View style={{ flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm, alignItems: 'center' }}>
                      <Button title="−1" variant="secondary" size="sm" onPress={() => editSet(index, s.id, { reps: Math.max(0, s.reps - 1) })} />
                      <Button title="+1" variant="secondary" size="sm" onPress={() => editSet(index, s.id, { reps: s.reps + 1 })} />
                      {loaded ? <Button title={`−${weightStep}`} variant="secondary" size="sm" onPress={() => editSet(index, s.id, { weight: Math.max(0, s.weight - fromDisplayWeight(weightStep, unit)) })} /> : null}
                      {loaded ? <Button title={`+${weightStep}`} variant="secondary" size="sm" onPress={() => editSet(index, s.id, { weight: s.weight + fromDisplayWeight(weightStep, unit) })} /> : null}
                      <View style={{ flex: 1 }} />
                      <IconButton icon="trash" label="Delete set" color={colors.ember} onPress={() => { deleteSet(index, s.id); setEditing(null); }} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {!isBoss ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <Text variant="caption" style={{ flex: 1 }}>
              Planned sets: {ex.targetSets}
            </Text>
            <Button title="One less" variant="ghost" size="sm" onPress={() => adjustTargetSets(index, -1)} />
            <Button title="One more" variant="ghost" size="sm" onPress={() => adjustTargetSets(index, 1)} testID="add-set" />
          </View>
        ) : null}
      </ScrollView>

      {/* Action area */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: insets.bottom + spacing.sm, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.seam, backgroundColor: colors.stone }}>
        {jump && !running && !exerciseDone ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }} testID="load-warning">
            <Icon name="warning" size={16} color={colors.torch} />
            <Text variant="caption" color={colors.torch} style={{ flex: 1 }}>
              {jump.title}. {jump.detail}
            </Text>
          </View>
        ) : null}

        {running ? (
          <>
            <View style={{ alignItems: 'center' }}>
              <Text variant="label">{timed ? 'Holding' : 'Set in progress'}</Text>
              <Text variant="timer" testID="set-timer">
                {clock((now - running.startedAt) / 1000)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Stepper label={timed ? 'Seconds' : 'Reps'} value={draft.reps} min={0} max={timed ? 900 : 100} step={timed ? 5 : 1} onChange={(reps) => setDraft((d) => ({ ...d, reps }))} testID="reps" compact />
            </View>
            <Button title="End set" icon="stop" size="xl" onPress={onEnd} testID="end-set" sound={null} />
            <Button title="Cancel set" variant="ghost" size="sm" onPress={cancelSet} />
          </>
        ) : allDone ? (
          <>
            <Text variant="headline" align="center">
              Every foe has fallen.
            </Text>
            <Button title="Claim rewards" icon="gift" size="xl" onPress={onFinish} testID="claim-rewards" sound="chestOpen" />
          </>
        ) : resting ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text variant="label">Rest</Text>
                <ProgressBar value={(active.restEndsAt! - now) / 1000 / Math.max(1, active.restTotalSec)} tone="frost" durationMs={240} />
              </View>
              <Text variant="timer" style={{ fontSize: 44, lineHeight: 50 }} testID="rest-timer">
                {clock((active.restEndsAt! - now) / 1000)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="+30 s" variant="secondary" style={{ flex: 1 }} onPress={() => extendRest(30)} testID="rest-plus" />
              <Button title="Skip rest" variant="secondary" style={{ flex: 1 }} onPress={() => { void cancelRestAlert(); skipRest(); }} testID="skip-rest" />
            </View>
            <Button title={exerciseDone && nextUp ? `Next: ${getExercise(nextUp.exerciseId).name}` : 'Start next set'} icon="play" size="lg" onPress={onStart} testID="start-set" sound={null} />
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              {loaded || exercise.externalLoad ? (
                <Stepper
                  label={exercise.externalLoad ? `Weight (${weightLabel})` : `Added (${weightLabel})`}
                  value={displayWeight}
                  min={0}
                  max={unit === 'kg' ? 500 : 1100}
                  step={weightStep}
                  onChange={(v) => setDraft((d) => ({ ...d, weight: unit === 'kg' ? v : v * KG_PER_LB }))}
                  testID="weight"
                  compact
                />
              ) : null}
              <Stepper label={timed ? 'Seconds' : 'Reps'} value={draft.reps} min={0} max={timed ? 900 : 100} step={timed ? 5 : 1} onChange={(reps) => setDraft((d) => ({ ...d, reps }))} testID="reps" compact />
            </View>
            {exerciseDone ? (
              <Button
                title={nextUp ? `Next: ${getExercise(nextUp.exerciseId).name}` : 'Claim rewards'}
                icon="play"
                size="xl"
                onPress={() => {
                  if (!nextUp) return onFinish();
                  selectExercise(session.exercises.indexOf(nextUp));
                }}
                testID="next-exercise"
              />
            ) : (
              <Button title={isBoss ? 'Face the boss' : `Start set ${ex.sets.length + 1}`} icon="play" size="xl" onPress={onStart} testID="start-set" sound={null} />
            )}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Log without timer" variant="ghost" size="sm" style={{ flex: 1 }} onPress={onEnd} testID="quick-log" sound={null} />
              <Button title="Finish workout" variant="ghost" size="sm" style={{ flex: 1 }} onPress={onFinish} testID="finish-workout" sound={null} />
            </View>
          </>
        )}
      </View>

      {prBanner ? (
        <Animated.View entering={ZoomIn.springify().damping(12)} exiting={FadeOut.duration(250)} pointerEvents="none" style={{ position: 'absolute', top: '18%', left: spacing.lg, right: spacing.lg, alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.glass, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.torch, padding: spacing.md, alignItems: 'center', boxShadow: '0 0 40px rgba(242,169,59,0.55)' }}>
            <Icon name="trophy" size={34} color={colors.torchHigh} />
            <Text style={{ fontFamily: fonts.display, fontSize: 34, lineHeight: 40, color: colors.torchHigh }}>New record</Text>
            {prBanner.map((p) => (
              <Animated.View key={`${p.kind}-${p.setId}`} entering={FadeIn.delay(150)}>
                <Text variant="bodyStrong" align="center">
                  {PR_LABELS[p.kind]}
                </Text>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}
