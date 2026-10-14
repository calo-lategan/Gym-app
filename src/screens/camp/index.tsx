import { router, useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/button';
import { HeroHud, HudPanel } from '@/components/hero-hud';
import { Icon } from '@/components/icon';
import { ProgressBar } from '@/components/progress-bar';
import { Text } from '@/components/text';
import { BALANCE } from '@/domain/game/balance';
import { canAttemptBoss, describeChallenge } from '@/domain/game/boss';
import { dragonHealth } from '@/domain/game/dragon';
import { isBossFloor, zoneForFloor } from '@/domain/game/dungeon';
import { isoWeekKey } from '@/domain/dates';
import { formatClock } from '@/domain/schedule';
import { formatWeight } from '@/domain/strength';
import { CampScene, type CampMood } from '@/game3d/scenes/camp-scene';
import { estimateMinutes, useDragonProgress, useTodayStatus } from '@/hooks/use-game-data';
import { startAmbience, stopAmbience } from '@/services/sound';
import { useGame } from '@/state/stores';
import { colors, fonts, spacing } from '@/theme';

export function CampScreen() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const hero = useGame((s) => s.hero);
  const dungeon = useGame((s) => s.dungeon);
  const dragon = useGame((s) => s.dragon);
  const active = useGame((s) => s.active);
  const unit = useGame((s) => s.profile.unit);
  const use24h = useGame((s) => s.settings.use24h);
  const status = useTodayStatus();
  const { progress } = useDragonProgress();
  const zone = zoneForFloor(dungeon.floor);

  useEffect(() => {
    if (focused) startAmbience();
    else stopAmbience();
    return () => stopAmbience();
  }, [focused]);

  const mood: CampMood = status.doneToday ? 'victorious' : status.trainingDay ? 'ready' : 'resting';
  const sets = status.day?.exercises.reduce((n, e) => n + e.sets, 0) ?? 0;
  const avgRest = status.day ? status.day.exercises.reduce((n, e) => n + e.restSec, 0) / Math.max(1, status.day.exercises.length) : 90;
  const boss = dungeon.boss;
  const bossReady = boss && canAttemptBoss(boss, isoWeekKey(status.today));
  const rooms = BALANCE.dungeon.roomsPerFloor;
  const gateText = isBossFloor(dungeon.floor)
    ? boss
      ? `${boss.name} guards the stairs.`
      : `Clear ${rooms - dungeon.roomsCleared} more ${rooms - dungeon.roomsCleared === 1 ? 'room' : 'rooms'} to reach the guardian.`
    : dungeon.roomsCleared >= rooms
      ? dungeon.sigils > 0
        ? 'The gate is open. Finish a workout to descend.'
        : 'The gate is sealed. Set any personal record to break it.'
      : `Room ${dungeon.roomsCleared + 1} of ${rooms}. ${dungeon.sigils > 0 ? 'The gate seal is broken.' : 'A record will break the gate seal.'}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.abyss }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        {focused ? <CampScene hero={hero} dungeon={dungeon} mood={mood} /> : null}
      </View>

      <View pointerEvents="box-none" style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <HudPanel>
              <HeroHud hero={hero} />
            </HudPanel>
          </View>
          <IconButton icon="settings" label="Settings" tone="filled" onPress={() => router.push('/settings')} testID="open-settings" />
        </View>
        <View pointerEvents="none" style={{ alignItems: 'center', marginTop: spacing.xs }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: colors.bone, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 10 }}>
            Floor {dungeon.floor}
          </Text>
          <Text variant="caption" color={zone.light} style={{ textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 8 }}>
            {zone.name}
          </Text>
        </View>
      </View>

      <View style={{ flex: 1 }} pointerEvents="box-none">
        <View style={{ position: 'absolute', right: spacing.md, top: spacing.md, gap: spacing.sm }}>
          <IconButton icon="scale" label="Weigh in" tone="filled" onPress={() => router.push('/weigh-in')} testID="weigh-in" />
          <IconButton icon="dragon" label="Dragon lair" tone="filled" color={colors.ember} onPress={() => router.push('/lair')} testID="open-lair" />
        </View>
      </View>

      <ScrollView
        style={{ maxHeight: '50%', flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}
        showsVerticalScrollIndicator={false}
      >
        <HudPanel>
          <View style={{ gap: spacing.ms }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name={dungeon.sigils > 0 ? 'unlock' : 'lock'} size={16} color={dungeon.sigils > 0 ? colors.verdant : colors.torch} />
              <Text variant="caption" style={{ flex: 1 }} color={colors.bone}>
                {gateText}
              </Text>
            </View>
            {dragon ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="label" color={colors.ember}>
                  {dragon.name}
                </Text>
                <ProgressBar value={dragonHealth(progress)} tone="hp" height={7} style={{ flex: 1 }} accessibilityLabel="Dragon ward" />
                <Text variant="label">{Math.round(dragonHealth(progress) * 100)}%</Text>
              </View>
            ) : null}
            <View style={{ height: 1, backgroundColor: colors.seam }} />
            {active ? (
              <>
                <Text variant="title">Quest in progress</Text>
                <Text variant="subhead">
                  {active.session.title}. {active.session.exercises.reduce((n, e) => n + e.sets.length, 0)} sets logged so far.
                </Text>
                <Button title="Resume quest" icon="play" size="xl" onPress={() => router.push('/workout')} testID="resume-quest" />
              </>
            ) : status.doneToday ? (
              <>
                <Text variant="title">Quest complete</Text>
                <Text variant="subhead">Today&apos;s work is banked. Recover well, the dungeon will wait.</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button title="See rewards" icon="gift" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/victory')} />
                  <Button title="Bonus round" icon="plus" variant="ghost" style={{ flex: 1 }} onPress={() => router.push('/check-in?mode=gym')} />
                </View>
              </>
            ) : status.trainingDay && status.day ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm }}>
                  <Text variant="title" style={{ flexShrink: 1 }} numberOfLines={1}>
                    {status.day.name}
                  </Text>
                  <Text variant="caption">{formatClock(status.time, use24h)}</Text>
                </View>
                <Text variant="subhead">
                  {status.day.exercises.length} exercises, {sets} sets, about {estimateMinutes(sets, avgRest)} min
                </Text>
                {boss && bossReady ? (
                  <Text variant="caption" color={colors.ember}>
                    Miniboss: {describeChallenge(boss.challenge, (kg) => formatWeight(kg, unit))}
                  </Text>
                ) : null}
                <Button title="Begin quest" icon="swords" size="xl" onPress={() => router.push('/check-in?mode=gym')} testID="begin-quest" sound="setStart" />
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button title="At home" icon="home" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => router.push('/check-in?mode=home')} testID="train-home" />
                  <Button title="Move it" icon="clock" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => router.push('/move-session')} testID="move-session" />
                  {boss && bossReady ? (
                    <Button title="Boss" icon="skull" variant="danger" size="md" style={{ flex: 1 }} onPress={() => router.push('/check-in?mode=gym&boss=1')} testID="challenge-boss" sound="bossRoar" />
                  ) : null}
                </View>
              </>
            ) : (
              <>
                <Text variant="title">Rest day</Text>
                <Text variant="subhead">Muscles grow while you recover, and your streak is safe. Want to move anyway?</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button title="Recovery rite" icon="heart" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/check-in?mode=recovery')} testID="recovery" />
                  <Button title="Bonus workout" icon="swords" variant="ghost" style={{ flex: 1 }} onPress={() => router.push('/check-in?mode=gym')} testID="bonus-workout" />
                </View>
              </>
            )}
          </View>
        </HudPanel>
      </ScrollView>
    </View>
  );
}
