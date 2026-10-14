import { View } from 'react-native';

import { xpToNext } from '@/domain/game/progression';
import type { Hero } from '@/domain/types';
import { colors, fonts, radius, spacing } from '@/theme';

import { Icon } from './icon';
import { ProgressBar } from './progress-bar';
import { Text } from './text';

/** Level crest: a framed level number in the display face. */
export function LevelCrest({ level, size = 54 }: { level: number; size?: number }) {
  return (
    <View
      accessibilityLabel={`Level ${level}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 3.2,
        borderCurve: 'continuous',
        backgroundColor: colors.stone,
        borderWidth: 2,
        borderColor: colors.torch,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 18px rgba(242, 169, 59, 0.35)',
        transform: [{ rotate: '45deg' }],
      }}
    >
      <View style={{ transform: [{ rotate: '-45deg' }], alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.display, fontSize: size * 0.46, lineHeight: size * 0.52, color: colors.torchHigh }}>{level}</Text>
      </View>
    </View>
  );
}

export function Counter({ icon, value, color, label }: { icon: 'camp' | 'coin' | 'potion' | 'star'; value: string | number; color: string; label: string }) {
  return (
    <View accessibilityLabel={`${label}: ${value}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name={icon} size={16} color={color} />
      <Text variant="number" style={{ fontSize: 15 }}>
        {value}
      </Text>
    </View>
  );
}

/** Compact hero status for the top of game screens. */
export function HeroHud({ hero }: { hero: Hero }) {
  const need = xpToNext(hero.level);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <LevelCrest level={hero.level} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
          <Text variant="heading" numberOfLines={1} style={{ flexShrink: 1 }}>
            {hero.name}
          </Text>
          {hero.activeTitle ? (
            <Text variant="caption" numberOfLines={1} color={colors.torch}>
              {hero.activeTitle}
            </Text>
          ) : null}
        </View>
        <ProgressBar value={hero.xp / need} accessibilityLabel={`Experience ${hero.xp} of ${need}`} />
        <View style={{ flexDirection: 'row', gap: spacing.ms, alignItems: 'center' }}>
          <Text variant="caption" numberOfLines={1} style={{ flex: 1, fontVariant: ['tabular-nums'] }}>
            {hero.xp}/{need} XP
          </Text>
          <Counter icon="camp" value={hero.streak.current} color={colors.ember} label="Streak" />
          <Counter icon="coin" value={hero.gold} color={colors.torch} label="Gold" />
        </View>
      </View>
    </View>
  );
}

export function HudPanel({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.glass,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.seam,
        padding: spacing.ms,
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.45)',
      }}
    >
      {children}
    </View>
  );
}
