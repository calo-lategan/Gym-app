import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Platform, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { PageScroll } from '@/components/screen';
import { Text } from '@/components/text';
import { parseDayKey } from '@/domain/dates';
import { describeBonus, RARITY_LABELS } from '@/domain/game/loot';
import { salvageValue, SLOT_LABELS } from '@/domain/game/progression';
import { haptics } from '@/services/haptics';
import { play } from '@/services/sound';
import { equipItem, salvageItem } from '@/state/actions';
import { useGame } from '@/state/stores';
import { colors, fonts, radius, rarityColors, spacing } from '@/theme';

export function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hero = useGame((s) => s.hero);
  const item = hero.inventory.find((i) => i.id === id);
  if (!item) {
    return (
      <PageScroll>
        <Text variant="subhead">This item is gone.</Text>
      </PageScroll>
    );
  }
  const color = rarityColors[item.rarity];
  const equipped = hero.equipped[item.slot] === item.id;
  const worn = hero.inventory.find((i) => i.id === hero.equipped[item.slot]);
  const diff = worn && !equipped ? item.power - worn.power : null;
  const value = salvageValue(item);

  const salvage = () => {
    const go = () => {
      salvageItem(item.id);
      play('coin', 0.8);
      haptics.success();
      router.back();
    };
    if (Platform.OS === 'web') {
      go();
      return;
    }
    Alert.alert(`Salvage ${item.name}?`, `You get ${value} gold. This cannot be undone.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Salvage', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <PageScroll testID="item-screen" padTop={spacing.lg}>
      <View style={{ borderRadius: radius.lg, borderWidth: 2, borderColor: color, padding: spacing.md, gap: spacing.sm, backgroundColor: `${color}12`, boxShadow: `0 0 30px ${color}55` }}>
        <Text variant="label" color={color}>
          {RARITY_LABELS[item.rarity]} {SLOT_LABELS[item.slot].toLowerCase()}
        </Text>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 34, color: colors.bone }}>{item.name}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.lg }}>
          <View>
            <Text variant="stat" color={color}>
              {item.power}
            </Text>
            <Text variant="label">Power</Text>
          </View>
          {describeBonus(item.bonus) ? (
            <View>
              <Text variant="stat">{describeBonus(item.bonus)}</Text>
              <Text variant="label">Bonus</Text>
            </View>
          ) : null}
        </View>
        <Text variant="caption">
          {item.source}, {parseDayKey(item.foundOn).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
      </View>

      {diff !== null && worn ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name={diff > 0 ? 'up' : diff < 0 ? 'down' : 'swap'} size={18} color={diff > 0 ? colors.verdant : diff < 0 ? colors.ember : colors.ash} />
          <Text variant="body" style={{ flex: 1 }}>
            {diff === 0 ? 'Same power as' : `${Math.abs(diff)} ${diff > 0 ? 'more' : 'less'} power than`} your {worn.name}.
          </Text>
        </View>
      ) : null}

      {equipped ? (
        <Text variant="bodyStrong" color={colors.verdant}>
          Equipped
        </Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <Button
            title="Equip"
            icon="check"
            size="lg"
            onPress={() => {
              equipItem(item.id);
              play('statUp', 0.7);
              haptics.success();
              router.back();
            }}
            testID="item-equip"
          />
          <Button title={`Salvage for ${value} gold`} icon="coin" variant="secondary" onPress={salvage} testID="item-salvage" />
        </View>
      )}
    </PageScroll>
  );
}
