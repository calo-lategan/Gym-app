import { router, useIsFocused } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { LevelCrest } from '@/components/hero-hud';
import { Icon } from '@/components/icon';
import { Panel } from '@/components/panel';
import { ProgressBar } from '@/components/progress-bar';
import { Section } from '@/components/screen';
import { Text } from '@/components/text';
import { rarityRank } from '@/domain/game/balance';
import { describeBonus, RARITY_LABELS } from '@/domain/game/loot';
import { effectiveStats, HERO_CLASSES, heroPower, SLOT_LABELS, STAT_INFO, xpToNext } from '@/domain/game/progression';
import type { GearSlot, Item, StatKey } from '@/domain/types';
import { HeroShowcase } from '@/game3d/scenes/hero-showcase';
import { setActiveTitle } from '@/state/actions';
import { useGame } from '@/state/stores';
import { colors, fonts, radius, rarityColors, spacing } from '@/theme';

const SLOTS: GearSlot[] = ['weapon', 'helm', 'armor', 'boots', 'relic'];
const STATS: StatKey[] = ['str', 'end', 'agi', 'vit'];
const SLOT_ICONS = { weapon: 'swords', helm: 'crown', armor: 'hero', boots: 'walk', relic: 'sparkles' } as const;

function ItemRow({ item, equipped }: { item: Item; equipped?: boolean }) {
  const color = rarityColors[item.rarity];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${RARITY_LABELS[item.rarity]} ${SLOT_LABELS[item.slot]}, power ${item.power}${equipped ? ', equipped' : ''}`}
      onPress={() => router.push(`/item/${item.id}`)}
      testID={`item-${item.id}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.ms,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.ms,
        minHeight: 56,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: `${color}55`,
        backgroundColor: pressed ? colors.slateHigh : `${color}0D`,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.3)',
        }}
      >
        <Icon name={SLOT_ICONS[item.slot]} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" color={color} numberOfLines={1}>
          {item.name}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {RARITY_LABELS[item.rarity]} {SLOT_LABELS[item.slot].toLowerCase()}, power {item.power}
          {describeBonus(item.bonus) ? `, ${describeBonus(item.bonus)}` : ''}
        </Text>
      </View>
      {equipped ? <Icon name="check" size={16} color={colors.verdant} /> : <Icon name="chevronRight" size={18} color={colors.dim} />}
    </Pressable>
  );
}

export function HeroScreen() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const hero = useGame((s) => s.hero);
  const graphics = useGame((s) => s.settings.graphics);
  const stats = effectiveStats(hero);
  const power = heroPower(hero);
  const need = xpToNext(hero.level);
  const heroClass = HERO_CLASSES.find((c) => c.id === hero.heroClass);
  const equippedIds = new Set(Object.values(hero.equipped));
  const pack = useMemo(
    () => hero.inventory.filter((i) => !equippedIds.has(i.id)).sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || b.power - a.power),
    // equippedIds derives from hero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hero],
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.abyss }} contentContainerStyle={{ paddingBottom: spacing.xxl }} testID="hero-screen">
      <View style={{ height: 360 }}>
        {focused && graphics === 'full' ? (
          <HeroShowcase hero={hero} />
        ) : (
          <View style={{ flex: 1, experimental_backgroundImage: 'radial-gradient(circle at 50% 60%, rgba(242,169,59,0.25) 0%, transparent 60%)' }} />
        )}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 90,
            experimental_backgroundImage: `linear-gradient(to bottom, transparent, ${colors.abyss})`,
          }}
        />
        <View style={{ position: 'absolute', top: insets.top + spacing.sm, right: spacing.md, gap: spacing.sm }}>
          <IconButton icon="settings" label="Settings" tone="filled" onPress={() => router.push('/settings')} testID="hero-settings" />
          <IconButton icon="history" label="Battle log" tone="filled" onPress={() => router.push('/history')} testID="open-history" />
          <IconButton icon="trophy" label="Records" tone="filled" onPress={() => router.push('/records')} testID="open-records" />
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.md, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <LevelCrest level={hero.level} size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 36, color: colors.bone }} numberOfLines={1}>
              {hero.name}
            </Text>
            <Text variant="caption" color={colors.torch}>
              {[hero.activeTitle, heroClass?.name].filter(Boolean).join(', ')}
            </Text>
            <ProgressBar value={hero.xp / need} accessibilityLabel={`Experience ${hero.xp} of ${need}`} />
            <Text variant="caption" style={{ fontVariant: ['tabular-nums'] }}>
              {hero.xp} / {need} XP to level {hero.level + 1}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {[
            { label: 'Power', value: power, color: colors.torchHigh },
            { label: 'Gold', value: hero.gold, color: colors.torch },
            { label: 'Streak', value: `${hero.streak.current}`, color: colors.ember },
            { label: 'Best', value: `${hero.streak.best}`, color: colors.ash },
          ].map((t) => (
            <View
              key={t.label}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: colors.stone,
                borderWidth: 1,
                borderColor: colors.seam,
              }}
            >
              <Text variant="stat" color={t.color}>
                {t.value}
              </Text>
              <Text variant="label">{t.label}</Text>
            </View>
          ))}
        </View>

        <Section title="Attributes" detail="Earned in the gym, not bought. Gear adds on top.">
          <Panel>
            {STATS.map((k) => {
              const base = hero.stats[k];
              const bonus = stats[k] - base;
              return (
                <View key={k} style={{ flexDirection: 'row', gap: spacing.ms, alignItems: 'flex-start' }}>
                  <View style={{ width: 52, alignItems: 'center' }}>
                    <Text variant="stat">{stats[k]}</Text>
                    <Text variant="label" color={colors.torch}>
                      {STAT_INFO[k].short}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong">
                      {STAT_INFO[k].label}
                      {bonus > 0 ? <Text variant="caption" color={colors.verdant}>{`  +${bonus} from gear`}</Text> : null}
                    </Text>
                    <Text variant="caption">{STAT_INFO[k].how}</Text>
                  </View>
                </View>
              );
            })}
          </Panel>
        </Section>

        <Section title="Equipped">
          {SLOTS.map((slot) => {
            const item = hero.inventory.find((i) => i.id === hero.equipped[slot]);
            return item ? (
              <ItemRow key={slot} item={item} equipped />
            ) : (
              <View
                key={slot}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.ms,
                  padding: spacing.ms,
                  minHeight: 56,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: colors.seam,
                }}
              >
                <Icon name={SLOT_ICONS[slot]} size={18} color={colors.dim} />
                <Text variant="caption">{SLOT_LABELS[slot]}: empty. Chests drop gear for every slot.</Text>
              </View>
            );
          })}
        </Section>

        <Section
          title={`Pack (${pack.length})`}
          action={<Button title="Merchant" icon="bag" variant="secondary" size="sm" onPress={() => router.push('/shop')} testID="open-shop" />}
        >
          {pack.length === 0 ? (
            <Text variant="subhead">Spare gear lands here. Salvage what you do not need for gold.</Text>
          ) : (
            pack.map((item) => <ItemRow key={item.id} item={item} />)
          )}
        </Section>

        {hero.titles.length > 1 ? (
          <Section title="Titles">
            <ChipRow>
              {hero.titles.map((t) => (
                <Chip key={t} label={t} selected={hero.activeTitle === t} onPress={() => setActiveTitle(t)} />
              ))}
            </ChipRow>
          </Section>
        ) : null}

        <Section title="Potions">
          <Panel>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.ms }}>
              <Icon name="potion" size={22} color={colors.arcane} />
              <Text variant="body" style={{ flex: 1 }}>
                Resolve {hero.potions.resolve}, Insight {hero.potions.insight}
                {hero.insightActive ? '. Insight is active for your next quest.' : ''}
              </Text>
              <Button title="Visit" variant="ghost" size="sm" onPress={() => router.push('/shop')} />
            </View>
          </Panel>
        </Section>
      </View>
    </ScrollView>
  );
}
