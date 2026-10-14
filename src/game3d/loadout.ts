import { rarityRank } from '@/domain/game/balance';
import type { Hero, HeroClass, Item, Rarity } from '@/domain/types';
import { rarityColors } from '@/theme';

/** Every prop mesh on each KayKit hero; only the ones in the loadout are shown. */
const PROP_MESHES: Record<HeroClass, string[]> = {
  knight: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword', 'Knight_Helmet', 'Knight_Cape'],
  barbarian: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug', 'Barbarian_Hat', 'Barbarian_Cape'],
  mage: ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff', 'Mage_Hat', 'Mage_Cape'],
  rogue: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable', 'Rogue_Cape'],
};

export interface Loadout {
  visible: Set<string>;
  twoHanded: boolean;
  weaponMeshes: string[];
  weaponRarity: Rarity | null;
  auraColor: string | null;
  idle: string;
  attacks: string[];
  finisher: string;
}

function equippedItem(hero: Hero, slot: Item['slot']): Item | undefined {
  const id = hero.equipped[slot];
  return hero.inventory.find((i) => i.id === id);
}

/**
 * Turns equipped gear into what the 3D hero wears: better weapons become
 * two-handed, armor upgrades the shield, a helm appears once one drops and a
 * legendary item adds a glowing aura.
 */
export function heroLoadout(hero: Hero, options: { resting?: boolean } = {}): Loadout {
  const weapon = equippedItem(hero, 'weapon');
  const armor = equippedItem(hero, 'armor');
  const helm = equippedItem(hero, 'helm');
  const relic = equippedItem(hero, 'relic');
  const twoHanded = Boolean(weapon && rarityRank(weapon.rarity) >= rarityRank('rare'));
  const armorRank = armor ? rarityRank(armor.rarity) : -1;
  const visible = new Set<string>();
  let weaponMeshes: string[] = [];
  let attacks: string[] = ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal'];
  let finisher = '2H_Melee_Attack_Spin';

  switch (hero.heroClass) {
    case 'knight':
      if (twoHanded) weaponMeshes = ['2H_Sword'];
      else {
        weaponMeshes = ['1H_Sword'];
        visible.add(armorRank >= 4 ? 'Spike_Shield' : armorRank >= 3 ? 'Badge_Shield' : armorRank >= 1 ? 'Rectangle_Shield' : 'Round_Shield');
      }
      if (helm) visible.add('Knight_Helmet');
      if (armor) visible.add('Knight_Cape');
      break;
    case 'barbarian':
      if (twoHanded) weaponMeshes = ['2H_Axe'];
      else {
        weaponMeshes = ['1H_Axe'];
        visible.add(armorRank >= 3 ? '1H_Axe_Offhand' : 'Barbarian_Round_Shield');
      }
      if (options.resting) {
        visible.delete('Barbarian_Round_Shield');
        visible.add('Mug');
      }
      if (helm) visible.add('Barbarian_Hat');
      if (armor) visible.add('Barbarian_Cape');
      break;
    case 'mage':
      weaponMeshes = twoHanded ? ['2H_Staff'] : ['1H_Wand'];
      if (!twoHanded) visible.add(relic ? 'Spellbook_open' : 'Spellbook');
      if (helm) visible.add('Mage_Hat');
      if (armor) visible.add('Mage_Cape');
      attacks = ['Spellcast_Shoot', 'Spellcast_Long'];
      finisher = 'Spellcast_Raise';
      break;
    case 'rogue':
      weaponMeshes = twoHanded ? ['2H_Crossbow'] : ['Knife'];
      if (!twoHanded) visible.add('Knife_Offhand');
      if (armor) visible.add('Rogue_Cape');
      attacks = twoHanded
        ? ['1H_Ranged_Shoot']
        : ['Dualwield_Melee_Attack_Stab', 'Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Chop'];
      finisher = twoHanded ? '1H_Ranged_Shoot' : 'Dualwield_Melee_Attack_Chop';
      break;
  }
  if (twoHanded && hero.heroClass !== 'mage' && hero.heroClass !== 'rogue') {
    attacks = ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice'];
  }
  for (const mesh of weaponMeshes) visible.add(mesh);

  const legendary = Object.values(hero.equipped)
    .map((id) => hero.inventory.find((i) => i.id === id))
    .find((i) => i?.rarity === 'legendary');

  return {
    visible,
    twoHanded,
    weaponMeshes,
    weaponRarity: weapon?.rarity ?? null,
    auraColor: legendary ? rarityColors.legendary : null,
    idle: twoHanded && hero.heroClass !== 'mage' && hero.heroClass !== 'rogue' ? '2H_Melee_Idle' : 'Idle',
    attacks,
    finisher,
  };
}

export function isPropMesh(heroClass: HeroClass, name: string): boolean {
  return PROP_MESHES[heroClass].includes(name);
}
