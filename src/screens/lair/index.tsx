import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/button';
import { HudPanel } from '@/components/hero-hud';
import { ProgressBar } from '@/components/progress-bar';
import { Text } from '@/components/text';
import { findExercise } from '@/domain/exercises';
import { canSlay, crossedPhases, describeGoal, dragonHealth } from '@/domain/game/dragon';
import { formatWeight } from '@/domain/strength';
import { LairScene, HERO_START, HERO_STRIKE } from '@/game3d/scenes/lair-scene';
import { heroLoadout } from '@/game3d/loadout';
import type { OneShot } from '@/game3d/models';
import { useDragonProgress } from '@/hooks/use-game-data';
import { haptics } from '@/services/haptics';
import { play } from '@/services/sound';
import { useGame } from '@/state/stores';
import { colors, fonts, spacing } from '@/theme';

export function LairScreen() {
  const insets = useSafeAreaInsets();
  const hero = useGame((s) => s.hero);
  const dragon = useGame((s) => s.dragon);
  const unit = useGame((s) => s.profile.unit);
  const graphics = useGame((s) => s.settings.graphics);
  const { goal, current, progress } = useDragonProgress();
  const loadout = useMemo(() => heroLoadout(hero), [hero]);

  const [roarKey, setRoarKey] = useState(0);
  const [hurtKey, setHurtKey] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const [dead, setDead] = useState(false);
  const [heroAt, setHeroAt] = useState<[number, number, number]>(HERO_START);
  const [heroAction, setHeroAction] = useState<string | undefined>(undefined);
  const [heroShot, setHeroShot] = useState<OneShot | null>(null);
  const [slaying, setSlaying] = useState(false);
  const [flash, setFlash] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastRoar = useRef(0);

  const roar = useCallback((volume = 0.8) => {
    const now = Date.now();
    if (now - lastRoar.current < 2200) return;
    lastRoar.current = now;
    setRoarKey((k) => k + 1);
    setShakeKey((k) => k + 1);
    play('dragonRoar', volume);
    haptics.heavy();
  }, []);

  // The dragon greets every visit.
  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => roar(0.65), 700);
      return () => clearTimeout(t);
    }, [roar]),
  );

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(0), 240);
    return () => clearTimeout(t);
  }, [flash]);

  if (!dragon || !goal) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md }}>
        <Text variant="title">The lair is empty</Text>
        <Button title="Return to camp" onPress={() => router.back()} />
      </View>
    );
  }

  const health = dragonHealth(progress);
  const ready = canSlay(progress);
  const fmt = (kg: number) => formatWeight(kg, unit);
  const phases = crossedPhases(0, Math.max(progress, dragon.bestProgress));
  const exerciseName = goal.exerciseId ? findExercise(goal.exerciseId)?.name : undefined;
  const now =
    current === null
      ? goal.kind === 'bodyweight'
        ? 'Log a weigh-in to start measuring.'
        : goal.kind === 'lift'
          ? 'Log this lift to start measuring.'
          : ''
      : goal.kind === 'sessions'
        ? `${current} of ${goal.target} done.`
        : `Now ${fmt(current)}.`;

  const slay = () => {
    if (slaying) return;
    setSlaying(true);
    const steps: [number, () => void][] = [
      [
        0,
        () => {
          setHeroAction('Running_A');
          setHeroAt(HERO_STRIKE);
          play('setStart', 0.8);
        },
      ],
      [
        950,
        () => {
          setHeroAction(undefined);
          lastRoar.current = 0;
          roar(1);
        },
      ],
      [2100, () => setHeroShot({ name: loadout.attacks[0], key: 1, speed: 1.2 })],
      [
        2360,
        () => {
          setHurtKey((k) => k + 1);
          setShakeKey((k) => k + 1);
          play('crit', 0.9);
          haptics.impact();
        },
      ],
      [3000, () => setHeroShot({ name: loadout.attacks[1 % loadout.attacks.length], key: 2, speed: 1.2 })],
      [
        3260,
        () => {
          setHurtKey((k) => k + 1);
          setShakeKey((k) => k + 1);
          play('hit', 0.9);
          haptics.impact();
        },
      ],
      [3900, () => setHeroShot({ name: loadout.finisher, key: 3, speed: 1.1 })],
      [
        4250,
        () => {
          setDead(true);
          setShakeKey((k) => k + 1);
          setFlash((f) => f + 1);
          play('crit', 1);
          play('monsterDeath', 1);
          haptics.heavy();
        },
      ],
      [
        5900,
        () => {
          setHeroShot({ name: 'Cheer', key: 4 });
          play('victory', 0.95);
          haptics.success();
        },
      ],
      [8000, () => router.replace('/slay?mode=slain')],
    ];
    timers.current = steps.map(([ms, fn]) => setTimeout(fn, ms));
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#120807' }} testID="lair-screen">
      <View style={StyleSheet.absoluteFill}>
        {graphics === 'full' ? (
          <LairScene
            hero={hero}
            tier={dragon.tier}
            health={dead ? 0 : health}
            roarKey={roarKey}
            hurtKey={hurtKey}
            dead={dead}
            shakeKey={shakeKey}
            heroAction={heroAction}
            heroShot={heroShot}
            heroAt={heroAt}
            onDragonTap={() => roar(0.6)}
          />
        ) : (
          <View style={{ flex: 1, experimental_backgroundImage: 'radial-gradient(circle at 50% 38%, rgba(232,85,62,0.35) 0%, transparent 65%)' }} />
        )}
      </View>

      {flash ? (
        <Animated.View key={flash} pointerEvents="none" entering={FadeIn.duration(80)} exiting={FadeOut.duration(800)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 214, 140, 0.45)' }]} />
      ) : null}

      <View pointerEvents="box-none" style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <IconButton icon="back" label="Back" tone="filled" onPress={() => router.back()} testID="lair-back" />
        <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', paddingRight: 48 + spacing.sm }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: colors.bone, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 12 }}>{dragon.name}</Text>
          <Text variant="caption" color={colors.ember} style={{ textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 8 }}>
            {dragon.epithet}
          </Text>
        </View>
      </View>

      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.md, paddingBottom: insets.bottom + spacing.md }}>
        {dead ? (
          <Animated.View entering={FadeInDown.delay(1200).springify()} pointerEvents="none" style={{ alignItems: 'center', marginBottom: spacing.xl }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 48, lineHeight: 54, color: colors.torchHigh, textShadowColor: 'rgba(242,169,59,0.9)', textShadowRadius: 24 }}>Dragon slain</Text>
          </Animated.View>
        ) : (
          <HudPanel>
            <View style={{ gap: spacing.ms }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="label" color={colors.ember}>
                  WARD
                </Text>
                <ProgressBar value={health} tone="hp" height={12} style={{ flex: 1 }} accessibilityLabel="Dragon ward" />
                <Text variant="number" color={ready ? colors.verdant : colors.bone}>
                  {Math.round(health * 100)}%
                </Text>
              </View>
              <View style={{ gap: 2 }}>
                <Text variant="bodyStrong">{describeGoal(goal, fmt, exerciseName)}</Text>
                <Text variant="caption">
                  {now} {Math.round(progress * 100)}% of the way there.
                </Text>
              </View>
              {phases.length > 0 && !ready ? (
                <Text variant="caption" color={colors.ember}>
                  {phases[phases.length - 1].line}
                </Text>
              ) : null}
              {ready ? (
                <>
                  <Text variant="bodyStrong" color={colors.verdant}>
                    You reached your goal. The ward is gone.
                  </Text>
                  <Button title={`Slay ${dragon.name}`} icon="swords" variant="danger" size="xl" onPress={slay} loading={slaying} sound={null} testID="slay-dragon" />
                </>
              ) : (
                <>
                  <Text variant="caption">
                    Its ward breaks only when you reach your real goal. Every workout, record and weigh-in moves you closer. Tap the dragon if you dare.
                  </Text>
                  <Button title="Change goal" icon="target" variant="ghost" size="sm" onPress={() => router.push('/slay?mode=change')} testID="change-goal" />
                </>
              )}
            </View>
          </HudPanel>
        )}
      </View>
    </View>
  );
}
