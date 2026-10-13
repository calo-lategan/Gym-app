import type { GearSlot, Hero, HeroClass, Item, Stats } from '../types';
import { BALANCE } from './balance';

export type { HeroClass };

export const HERO_CLASSES: { id: HeroClass; name: string; blurb: string }[] = [
  { id: 'knight', name: 'Knight', blurb: 'Sword and shield. Steady, stubborn, hard to stop.' },
  { id: 'barbarian', name: 'Barbarian', blurb: 'Axes and appetite. Built to move heavy things.' },
  { id: 'rogue', name: 'Rogue', blurb: 'Quick blades. Lives for faster sets and longer streaks.' },
  { id: 'mage', name: 'Mage', blurb: 'Staff and spellbook. Patient, precise, relentless.' },
];

export function xpToNext(level: number): number {
  return Math.round(BALANCE.levelCurve.base * Math.pow(level, BALANCE.levelCurve.exponent));
}

/** Total XP needed to reach `level` from level 1. */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNext(l);
  return total;
}

export interface XpResult {
  hero: Hero;
  levelsGained: number;
}

export function addXp(hero: Hero, amount: number): XpResult {
  let level = hero.level;
  let xp = hero.xp + Math.max(0, Math.round(amount));
  let levelsGained = 0;
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
    levelsGained++;
  }
  return {
    hero: { ...hero, level, xp, totalXp: hero.totalXp + Math.max(0, Math.round(amount)) },
    levelsGained,
  };
}

export function equippedItems(hero: Hero): Item[] {
  return (Object.values(hero.equipped) as (string | undefined)[])
    .map((id) => hero.inventory.find((item) => item.id === id))
    .filter((item): item is Item => Boolean(item));
}

/** Base stats plus gear bonuses. */
export function effectiveStats(hero: Hero): Stats {
  const stats = { ...hero.stats };
  for (const item of equippedItems(hero)) {
    if (item.bonus.stat && item.bonus.amount) stats[item.bonus.stat] += item.bonus.amount;
  }
  return stats;
}

export function gearPower(hero: Hero): number {
  return equippedItems(hero).reduce((sum, item) => sum + item.power, 0);
}

/** A single headline number for the hero card. */
export function heroPower(hero: Hero): number {
  const s = effectiveStats(hero);
  return s.str * 2 + s.end + s.agi + s.vit + gearPower(hero) + hero.level * 5;
}

export function gearXpBonusPct(hero: Hero): number {
  return equippedItems(hero).reduce((sum, item) => sum + (item.bonus.xpPct ?? 0), 0);
}

export function gearGoldBonusPct(hero: Hero): number {
  return equippedItems(hero).reduce((sum, item) => sum + (item.bonus.goldPct ?? 0), 0);
}

/** Equip an item, replacing whatever was in its slot. */
export function equip(hero: Hero, itemId: string): Hero {
  const item = hero.inventory.find((i) => i.id === itemId);
  if (!item) return hero;
  return { ...hero, equipped: { ...hero.equipped, [item.slot]: item.id } };
}

/** Auto-equip a new drop when its slot is empty or it is stronger than what is worn. */
export function autoEquip(hero: Hero, item: Item): { hero: Hero; equipped: boolean } {
  const currentId = hero.equipped[item.slot];
  const current = hero.inventory.find((i) => i.id === currentId);
  if (!current || item.power > current.power) {
    return { hero: { ...hero, equipped: { ...hero.equipped, [item.slot]: item.id } }, equipped: true };
  }
  return { hero, equipped: false };
}

export function salvageValue(item: Item): number {
  return item.power * BALANCE.loot.salvagePerPower[item.rarity];
}

export function salvage(hero: Hero, itemId: string): Hero {
  const item = hero.inventory.find((i) => i.id === itemId);
  if (!item || Object.values(hero.equipped).includes(itemId)) return hero;
  return {
    ...hero,
    gold: hero.gold + salvageValue(item),
    inventory: hero.inventory.filter((i) => i.id !== itemId),
  };
}

export type ShopItem = 'resolve' | 'insight';

export const SHOP: Record<ShopItem, { name: string; description: string; price: number; max: number }> = {
  resolve: {
    name: 'Potion of Resolve',
    description: 'Protects your streak if you miss one scheduled training day. Used automatically.',
    price: BALANCE.shop.resolve.price,
    max: BALANCE.shop.resolve.max,
  },
  insight: {
    name: 'Elixir of Insight',
    description: 'Your next completed workout earns 25% more XP.',
    price: BALANCE.shop.insight.price,
    max: BALANCE.shop.insight.max,
  },
};

export function buy(hero: Hero, item: ShopItem): Hero | null {
  const entry = SHOP[item];
  if (hero.gold < entry.price || hero.potions[item] >= entry.max) return null;
  return {
    ...hero,
    gold: hero.gold - entry.price,
    potions: { ...hero.potions, [item]: hero.potions[item] + 1 },
  };
}

export function newHero(name: string, heroClass: HeroClass): Hero {
  return {
    name,
    heroClass,
    level: 1,
    xp: 0,
    totalXp: 0,
    gold: 50,
    stats: { str: 1, end: 1, agi: 1, vit: 1 },
    inventory: [],
    equipped: {},
    potions: { resolve: 1, insight: 0 },
    insightActive: false,
    titles: ['Initiate'],
    activeTitle: 'Initiate',
    streak: { current: 0, best: 0, lastEvaluated: null },
    pity: { sinceRare: 0, sinceEpic: 0 },
    weightMilestones: 0,
    checkIns: 0,
  };
}

export const SLOT_LABELS: Record<GearSlot, string> = {
  weapon: 'Weapon',
  helm: 'Helm',
  armor: 'Armor',
  boots: 'Boots',
  relic: 'Relic',
};

export const STAT_INFO = {
  str: { label: 'Strength', short: 'STR', how: '+1 for every scheduled training day you complete.' },
  end: { label: 'Endurance', short: 'END', how: '+1 for rep and hold records (up to 2 a session).' },
  agi: { label: 'Agility', short: 'AGI', how: '+1 when you finish a set faster than ever before.' },
  vit: { label: 'Vitality', short: 'VIT', how: '+1 per body weight milestone toward your goal, and per 7 recovery check-ins.' },
} as const;
