import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { GoalForm, type GoalChoice } from '@/components/goal-form';
import { Icon } from '@/components/icon';
import { PageScroll } from '@/components/screen';
import { Text } from '@/components/text';
import { dragonForTier } from '@/domain/game/dragon';
import { describeBonus } from '@/domain/game/loot';
import { SLOT_LABELS } from '@/domain/game/progression';
import type { Item } from '@/domain/types';
import { haptics } from '@/services/haptics';
import { play } from '@/services/sound';
import { setGoal, slayDragon } from '@/state/actions';
import { useGame } from '@/state/stores';
import { colors, fonts, radius, rarityColors, spacing } from '@/theme';

/**
 * Two jobs: after a dragon falls, claim its hoard and bind the next dragon to
 * a new goal; or, from the lair, change the current goal.
 */
export function SlayScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const dragon = useGame((s) => s.dragon);
  const [claimed, setClaimed] = useState<{ item: Item; title: string; next: { name: string; epithet: string } } | null>(null);
  const slain = mode === 'slain';

  if (claimed) {
    const color = rarityColors.legendary;
    return (
      <PageScroll testID="slay-claimed" padTop={spacing.xl}>
        <Animated.View entering={ZoomIn.springify().damping(10)} style={{ alignItems: 'center', gap: spacing.sm }}>
          <Icon name="crown" size={56} color={colors.torchHigh} />
          <Text style={{ fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.torchHigh, textAlign: 'center' }}>The hoard is yours</Text>
          <Text variant="subhead" align="center">
            You now carry the title {claimed.title}, with 500 gold and a heap of experience.
          </Text>
        </Animated.View>
        <Animated.View
          entering={FadeInDown.delay(400).springify()}
          style={{ borderRadius: radius.lg, borderWidth: 2, borderColor: color, padding: spacing.md, gap: 6, backgroundColor: `${color}14`, boxShadow: `0 0 34px ${color}88` }}
        >
          <Text variant="label" color={color}>
            Legendary {SLOT_LABELS[claimed.item.slot].toLowerCase()}, equipped
          </Text>
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 32, color: colors.bone }}>{claimed.item.name}</Text>
          <Text variant="bodyStrong" color={color}>
            Power {claimed.item.power} {describeBonus(claimed.item.bonus)}
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(900).springify()} style={{ gap: spacing.sm }}>
          <Text variant="heading">A new shadow stirs</Text>
          <Text variant="body">
            {claimed.next.name}, {claimed.next.epithet}, has taken the deepest hall. Its ward is whole again, bound to your new goal.
          </Text>
          <Button title="Return to camp" icon="camp" size="lg" onPress={() => router.back()} testID="slay-done" />
        </Animated.View>
      </PageScroll>
    );
  }

  const submit = (goal: GoalChoice) => {
    if (slain) {
      const tier = dragon?.tier ?? 1;
      const result = slayDragon(goal);
      if (!result) {
        router.back();
        return;
      }
      play('lootLegendary', 1);
      haptics.success();
      setClaimed({ ...result, next: dragonForTier(tier + 1) });
      return;
    }
    setGoal(goal);
    play('gateOpen', 0.7);
    haptics.success();
    router.back();
  };

  const next = dragonForTier((dragon?.tier ?? 1) + 1);
  return (
    <PageScroll testID="slay-screen">
      <Stack.Screen options={{ title: slain ? 'Dragon slain' : 'Your goal' }} />
      {slain ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="display">{dragon ? `${dragon.name} has fallen` : 'The dragon has fallen'}</Text>
          <Text variant="body">
            You reached your goal, and the dungeon felt it. Claim the hoard: a legendary weapon, 500 gold, 2,000 XP and a new title.
          </Text>
          <Text variant="subhead">
            First, name your next goal. {next.name}, {next.epithet}, will guard it.
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <Text variant="display">Change your goal</Text>
          <Text variant="subhead">The dragon&apos;s ward resets and is measured against the new goal from today.</Text>
        </View>
      )}
      <GoalForm submitLabel={slain ? 'Claim the hoard' : 'Bind the dragon to this goal'} onSubmit={submit} />
    </PageScroll>
  );
}
