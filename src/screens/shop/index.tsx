import { View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Panel } from '@/components/panel';
import { PageScroll } from '@/components/screen';
import { Text } from '@/components/text';
import { toast } from '@/components/toast';
import { SHOP, type ShopItem } from '@/domain/game/progression';
import { haptics } from '@/services/haptics';
import { play } from '@/services/sound';
import { buyItem, drinkInsight } from '@/state/actions';
import { useGame } from '@/state/stores';
import { colors, spacing } from '@/theme';

const ITEMS: ShopItem[] = ['resolve', 'insight'];

export function ShopScreen() {
  const hero = useGame((s) => s.hero);
  return (
    <PageScroll testID="shop-screen">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="coin" size={22} color={colors.torch} />
        <Text variant="stat">{hero.gold}</Text>
        <Text variant="subhead">gold in your purse</Text>
      </View>
      <Text variant="subhead">The merchant only sells help for staying consistent. Strength itself cannot be bought.</Text>
      {ITEMS.map((key) => {
        const entry = SHOP[key];
        const owned = hero.potions[key];
        const full = owned >= entry.max;
        const broke = hero.gold < entry.price;
        return (
          <Panel key={key}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.ms }}>
              <Icon name="potion" size={26} color={key === 'resolve' ? colors.ember : colors.arcane} />
              <View style={{ flex: 1 }}>
                <Text variant="heading">{entry.name}</Text>
                <Text variant="caption">
                  You have {owned} of {entry.max}
                </Text>
              </View>
            </View>
            <Text variant="body">{entry.description}</Text>
            <Button
              title={full ? 'Your bag is full' : `Buy for ${entry.price} gold`}
              icon="coin"
              disabled={full || broke}
              onPress={() => {
                if (buyItem(key)) {
                  play('coin', 0.8);
                  haptics.success();
                  toast({ title: `${entry.name} added to your bag`, icon: 'potion', tone: 'torch' });
                }
              }}
              testID={`buy-${key}`}
            />
            {key === 'insight' && owned > 0 ? (
              <Button
                title={hero.insightActive ? 'Insight is active' : 'Drink before your next quest'}
                variant="secondary"
                disabled={hero.insightActive}
                onPress={() => {
                  if (drinkInsight()) {
                    play('lootRare', 0.7);
                    haptics.success();
                    toast({ title: 'Insight is active', detail: 'Your next completed quest earns 25% more XP.', icon: 'sparkles', tone: 'frost' });
                  }
                }}
                testID="drink-insight"
              />
            ) : null}
            {broke && !full ? (
              <Text variant="caption" color={colors.dim}>
                {entry.price - hero.gold} more gold needed. Finish quests and salvage spare gear.
              </Text>
            ) : null}
          </Panel>
        );
      })}
    </PageScroll>
  );
}
