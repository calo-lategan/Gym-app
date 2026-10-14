import { intBetween, pick, uid, weighted, type Rng } from '../rng';
import type { DayKey, GearSlot, HeroClass, Item, ItemBonus, Rarity, StatKey } from '../types';
import { BALANCE, RARITY_ORDER, rarityRank } from './balance';

export interface RarityContext {
  prCount: number;
  floor: number;
  pity: { sinceRare: number; sinceEpic: number };
  /** Guarantee at least this rarity (boss chests). */
  minimum?: Rarity;
}

export function rarityWeights(ctx: Omit<RarityContext, 'pity' | 'minimum'>): Record<Rarity, number> {
  const weights = { ...BALANCE.loot.baseWeights };
  const prs = Math.min(3, ctx.prCount);
  for (const r of RARITY_ORDER) weights[r] = Math.max(0, weights[r] + BALANCE.loot.perPrShift[r] * prs);
  // Deeper floors drop slightly better gear.
  const depth = Math.min(10, Math.max(0, ctx.floor - 5)) * 0.5;
  weights.rare += depth;
  weights.common = Math.max(5, weights.common - depth);
  return weights;
}

export function rollRarity(rng: Rng, ctx: RarityContext): Rarity {
  let rarity = weighted(rng, rarityWeights(ctx));
  const floorTo = (r: Rarity) => {
    if (rarityRank(rarity) < rarityRank(r)) rarity = r;
  };
  if (ctx.pity.sinceRare + 1 >= BALANCE.loot.pityRare) floorTo('rare');
  if (ctx.pity.sinceEpic + 1 >= BALANCE.loot.pityEpic) floorTo('epic');
  if (ctx.minimum) floorTo(ctx.minimum);
  return rarity;
}

export function nextPity(pity: { sinceRare: number; sinceEpic: number }, rarity: Rarity) {
  const rank = rarityRank(rarity);
  return {
    sinceRare: rank >= rarityRank('rare') ? 0 : pity.sinceRare + 1,
    sinceEpic: rank >= rarityRank('epic') ? 0 : pity.sinceEpic + 1,
  };
}

const WEAPON_BASES: Record<HeroClass, [string, string]> = {
  knight: ['Sword', 'Greatsword'],
  barbarian: ['Axe', 'Greataxe'],
  rogue: ['Dagger', 'Crossbow'],
  mage: ['Wand', 'Staff'],
};

const SLOT_BASES: Record<Exclude<GearSlot, 'weapon'>, string[]> = {
  helm: ['Helm', 'Visor', 'Crown', 'Hood', 'Coif'],
  armor: ['Hauberk', 'Cuirass', 'Brigandine', 'Mantle', 'Plate'],
  boots: ['Greaves', 'Boots', 'Sabatons', 'Treads'],
  relic: ['Talisman', 'Amulet', 'Sigil', 'Ring', 'Idol'],
};

const PREFIXES: Record<Exclude<Rarity, 'legendary'>, string[]> = {
  common: ['Rusted', 'Worn', 'Plain', 'Chipped', 'Iron'],
  uncommon: ['Tempered', 'Ashwood', 'Steelbound', 'Sturdy', 'Chalked'],
  rare: ['Runed', 'Frostforged', 'Moonlit', 'Gleaming', 'Stormglass'],
  epic: ['Emberheart', 'Wyrmbone', 'Voidsteel', 'Thunderborn', 'Bloodforged'],
};

const LEGENDARY_SUFFIXES = [
  'of the Last Rep',
  'of the Iron Will',
  'of the Unbroken Streak',
  'of Perfect Form',
  'of the Deep Breath',
  'of the Sixth Set',
  'of the Wyrmslayer',
  'of Endless Mornings',
];

const SLOT_STAT: Record<Exclude<GearSlot, 'relic'>, StatKey[]> = {
  weapon: ['str'],
  helm: ['vit', 'end'],
  armor: ['end', 'vit'],
  boots: ['agi'],
};

function bonusFor(rng: Rng, slot: GearSlot, rarity: Rarity): ItemBonus {
  if (slot === 'relic') {
    return rng() < 0.6 ? { xpPct: BALANCE.loot.xpPct[rarity] } : { goldPct: BALANCE.loot.goldPct[rarity] };
  }
  return { stat: pick(rng, SLOT_STAT[slot]), amount: BALANCE.loot.statBonus[rarity] };
}

export function generateItem(rng: Rng, rarity: Rarity, heroClass: HeroClass, floor: number, day: DayKey, source: string, slot?: GearSlot): Item {
  const chosenSlot = slot ?? weighted(rng, BALANCE.loot.slotWeights);
  const [lo, hi] = BALANCE.loot.powerRange[rarity];
  const power = intBetween(rng, lo, hi) + Math.floor(Math.max(0, floor - 1) / 5);
  const base =
    chosenSlot === 'weapon' ? WEAPON_BASES[heroClass][rarityRank(rarity) >= rarityRank('rare') ? 1 : 0] : pick(rng, SLOT_BASES[chosenSlot]);
  const name = rarity === 'legendary' ? `${base} ${pick(rng, LEGENDARY_SUFFIXES)}` : `${pick(rng, PREFIXES[rarity])} ${base}`;
  return {
    id: uid('item_'),
    name,
    slot: chosenSlot,
    rarity,
    power,
    bonus: bonusFor(rng, chosenSlot, rarity),
    foundOn: day,
    source,
  };
}

export function describeBonus(bonus: ItemBonus): string {
  if (bonus.stat && bonus.amount) return `+${bonus.amount} ${bonus.stat.toUpperCase()}`;
  if (bonus.xpPct) return `+${bonus.xpPct}% XP`;
  if (bonus.goldPct) return `+${bonus.goldPct}% gold`;
  return '';
}

export const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};
