import type { GearSlot, Rarity } from '../types';

/**
 * Every tunable number in the game economy lives here so balance passes
 * touch one file. See `balance.test.ts` for the pacing checks.
 */
export const BALANCE = {
  xp: {
    perSet: 10,
    bossSetMultiplier: 3,
    workoutComplete: 100,
    recoveryComplete: 60,
    perPr: 40,
    maxPrsPerSession: 5,
    bossVictory: 400,
    checkIn: 15,
    weighIn: 10,
    weightMilestone: 60,
    dragonSlain: 2000,
    /** Percent bonus per day of streak. */
    streakPctPerDay: 3,
    streakPctCap: 30,
    insightPct: 25,
  },
  gold: {
    workoutBase: 15,
    perFloor: 2,
    perPr: 5,
    perMonster: 3,
    bossVictory: 150,
    levelUpPerLevel: 25,
    weightMilestone: 20,
  },
  /** XP to go from `level` to `level + 1` is round(base * level^exponent). */
  levelCurve: { base: 120, exponent: 1.5 },
  dungeon: {
    roomsPerFloor: 2,
    bossEvery: 5,
    setsPerMonster: 3,
  },
  completion: {
    /** Share of planned sets needed for a session to count as completed. */
    minShare: 0.5,
    minSets: 3,
  },
  loot: {
    baseWeights: { common: 55, uncommon: 28, rare: 12, epic: 4.3, legendary: 0.7 } as Record<Rarity, number>,
    /** How each PR in the session (up to 3) shifts the odds. */
    perPrShift: { common: -6, uncommon: 0, rare: 3, epic: 2, legendary: 0.4 } as Record<Rarity, number>,
    pityRare: 5,
    pityEpic: 15,
    powerRange: {
      common: [2, 4],
      uncommon: [5, 8],
      rare: [9, 13],
      epic: [14, 19],
      legendary: [20, 28],
    } as Record<Rarity, [number, number]>,
    statBonus: { common: 1, uncommon: 1, rare: 2, epic: 3, legendary: 5 } as Record<Rarity, number>,
    xpPct: { common: 2, uncommon: 3, rare: 5, epic: 8, legendary: 12 } as Record<Rarity, number>,
    goldPct: { common: 5, uncommon: 8, rare: 12, epic: 18, legendary: 25 } as Record<Rarity, number>,
    slotWeights: { weapon: 25, helm: 20, armor: 20, boots: 15, relic: 20 } as Record<GearSlot, number>,
    salvagePerPower: { common: 3, uncommon: 4, rare: 6, epic: 9, legendary: 14 } as Record<Rarity, number>,
    inventoryCap: 40,
  },
  shop: {
    resolve: { price: 120, max: 3 },
    insight: { price: 80, max: 3 },
  },
  stats: {
    maxEndPerSession: 2,
    maxAgiPerSession: 2,
    checkInsPerVit: 7,
  },
} as const;

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const rarityRank = (r: Rarity) => RARITY_ORDER.indexOf(r);
