import type { TextStyle } from 'react-native';

import type { Rarity } from '@/domain/types';

/**
 * Ironwyrm design tokens. One source of truth for every screen.
 *
 * Direction: a torch-lit catacomb. Deep green-black stone, warm torch amber as
 * the single brand accent, ember red reserved for the dragon and for danger.
 * Loot rarity colors follow the genre convention players already read.
 * The app is dark only (userInterfaceStyle is fixed to dark in app.json).
 */
export const colors = {
  abyss: '#0B1110',
  stone: '#131C19',
  slate: '#1B2723',
  slateHigh: '#243430',
  seam: '#2C3D37',
  bone: '#EEE6D3',
  ash: '#A2ACA4',
  dim: '#6E7A73',
  torch: '#F2A93B',
  torchHigh: '#FFC566',
  torchDeep: '#B9761A',
  onTorch: '#1B1206',
  ember: '#E8553E',
  emberDeep: '#9E2E1F',
  verdant: '#66D49C',
  frost: '#5DB2F6',
  arcane: '#B58AF6',
  scrim: 'rgba(6, 10, 9, 0.72)',
  glass: 'rgba(19, 28, 25, 0.86)',
} as const;

export const rarityColors: Record<Rarity, string> = {
  common: '#B9B4A6',
  uncommon: '#66D49C',
  rare: '#5DB2F6',
  epic: '#B58AF6',
  legendary: '#F2A93B',
};

/** 4-point grid. 12 and 20 are named because they recur in dense rows. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  ms: 12,
  md: 16,
  ml: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/**
 * Shape rule: panels use `lg`, buttons and inputs `md`, chips and pills `full`.
 */
export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
} as const;

export const fonts = {
  display: 'GrenzeGotisch_800ExtraBold',
  displayBold: 'GrenzeGotisch_700Bold',
  displaySemi: 'GrenzeGotisch_600SemiBold',
} as const;

/** Display type uses Grenze Gotisch; everything you read or tap uses the system face. */
export const type = {
  hero: { fontFamily: fonts.display, fontSize: 44, lineHeight: 48, color: colors.bone },
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: colors.bone },
  title: { fontFamily: fonts.displayBold, fontSize: 27, lineHeight: 31, color: colors.bone },
  heading: { fontFamily: fonts.displaySemi, fontSize: 21, lineHeight: 25, color: colors.bone },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: colors.bone },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400', color: colors.bone },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: '600', color: colors.bone },
  subhead: { fontSize: 15, lineHeight: 21, fontWeight: '400', color: colors.ash },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.ash },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.ash, letterSpacing: 0.3 },
  stat: { fontSize: 22, lineHeight: 26, fontWeight: '800', color: colors.bone, fontVariant: ['tabular-nums'] },
  timer: { fontSize: 64, lineHeight: 70, fontWeight: '800', color: colors.bone, fontVariant: ['tabular-nums'] },
  number: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: colors.bone, fontVariant: ['tabular-nums'] },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

export const shadows = {
  raised: '0 8px 20px rgba(0, 0, 0, 0.45)',
  torchGlow: '0 0 24px rgba(242, 169, 59, 0.45)',
  emberGlow: '0 0 22px rgba(232, 85, 62, 0.45)',
} as const;

export const motion = {
  fast: 140,
  base: 240,
  slow: 420,
} as const;

/** Minimum comfortable touch target on Android (48dp), larger for gym use with sweaty hands. */
export const touch = {
  min: 48,
  big: 64,
} as const;
