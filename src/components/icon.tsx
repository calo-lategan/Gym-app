import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors } from '@/theme';

type SymbolName = Exclude<ComponentProps<typeof SymbolView>['name'], string>;

/**
 * One semantic icon set. iOS renders SF Symbols, Android and web render the
 * matching Material Symbol, so each platform gets its own native glyphs.
 */
const ICONS = {
  camp: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
  dungeon: { ios: 'building.columns.fill', android: 'castle', web: 'castle' },
  plan: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' },
  hero: { ios: 'shield.lefthalf.filled', android: 'shield_person', web: 'shield_person' },
  settings: { ios: 'gearshape.fill', android: 'settings', web: 'settings' },
  bell: { ios: 'bell.fill', android: 'notifications', web: 'notifications' },
  timer: { ios: 'timer', android: 'timer', web: 'timer' },
  play: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' },
  stop: { ios: 'stop.fill', android: 'stop', web: 'stop' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  minus: { ios: 'minus', android: 'remove', web: 'remove' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  chevronDown: { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  swap: { ios: 'arrow.triangle.2.circlepath', android: 'swap_horiz', web: 'swap_horiz' },
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  moon: { ios: 'moon.fill', android: 'bedtime', web: 'bedtime' },
  sun: { ios: 'sun.max.fill', android: 'wb_sunny', web: 'wb_sunny' },
  trophy: { ios: 'trophy.fill', android: 'trophy', web: 'trophy' },
  crown: { ios: 'crown.fill', android: 'crown', web: 'crown' },
  bolt: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' },
  heart: { ios: 'heart.fill', android: 'favorite', web: 'favorite' },
  scale: { ios: 'scalemass.fill', android: 'monitor_weight', web: 'monitor_weight' },
  bed: { ios: 'bed.double.fill', android: 'bed', web: 'bed' },
  water: { ios: 'drop.fill', android: 'water_drop', web: 'water_drop' },
  food: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
  lock: { ios: 'lock.fill', android: 'lock', web: 'lock' },
  unlock: { ios: 'lock.open.fill', android: 'lock_open', web: 'lock_open' },
  key: { ios: 'key.fill', android: 'key', web: 'key' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  gift: { ios: 'gift.fill', android: 'redeem', web: 'redeem' },
  bag: { ios: 'bag.fill', android: 'backpack', web: 'backpack' },
  coin: { ios: 'circle.fill', android: 'toll', web: 'toll' },
  clock: { ios: 'clock.fill', android: 'schedule', web: 'schedule' },
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  up: { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' },
  down: { ios: 'arrow.down', android: 'arrow_downward', web: 'arrow_downward' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
  list: { ios: 'list.bullet', android: 'list', web: 'list' },
  walk: { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' },
  run: { ios: 'figure.run', android: 'directions_run', web: 'directions_run' },
  medal: { ios: 'medal.fill', android: 'military_tech', web: 'military_tech' },
  star: { ios: 'star.fill', android: 'star', web: 'star' },
  swords: { ios: 'shield.fill', android: 'swords', web: 'swords' },
  skull: { ios: 'exclamationmark.octagon.fill', android: 'skull', web: 'skull' },
  stairs: { ios: 'stairs', android: 'stairs', web: 'stairs' },
  map: { ios: 'map.fill', android: 'map', web: 'map' },
  history: { ios: 'clock.arrow.circlepath', android: 'history', web: 'history' },
  potion: { ios: 'flask.fill', android: 'science', web: 'science' },
  brain: { ios: 'brain.head.profile', android: 'psychology', web: 'psychology' },
  pain: { ios: 'bandage.fill', android: 'healing', web: 'healing' },
  dragon: { ios: 'flame.circle.fill', android: 'local_fire_department', web: 'local_fire_department' },
  target: { ios: 'scope', android: 'target', web: 'target' },
  mute: { ios: 'speaker.slash.fill', android: 'volume_off', web: 'volume_off' },
  sound: { ios: 'speaker.wave.2.fill', android: 'volume_up', web: 'volume_up' },
  music: { ios: 'music.note', android: 'music_note', web: 'music_note' },
  musicOff: { ios: 'speaker.slash.fill', android: 'music_off', web: 'music_off' },
  vibrate: { ios: 'iphone.radiowaves.left.and.right', android: 'vibration', web: 'vibration' },
  export: { ios: 'square.and.arrow.up', android: 'ios_share', web: 'ios_share' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' },
  person: { ios: 'person.fill', android: 'person', web: 'person' },
  equipment: { ios: 'wrench.and.screwdriver.fill', android: 'build', web: 'build' },
  location: { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' },
} satisfies Record<string, SymbolName>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 22,
  color = colors.bone,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return <SymbolView name={ICONS[name]} size={size} tintColor={color} style={style} />;
}
