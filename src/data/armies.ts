export type ArmyFamily = 'Forces of Fantasy' | 'Powers of Chaos' | 'Legions of Undead' | 'Ravening Hordes' | 'Legends of Legacy'

export type ArmyComposition = {
  id: string
  name: string
}

export type Army = {
  slug: string
  name: string
  family: ArmyFamily
  dataKey: string
  compositions: ArmyComposition[]
  sampleUnits?: Array<{ name: string; category: string }>
  /** Games Workshop Legacy PDF army. Kept separate from the currently supported army set. */
  legacy?: boolean
  /** Some data identities remain addressable for compatibility but are not standalone faction choices. */
  selectable?: boolean
}

// These are compact Old.dex navigation families only. They do not alter or imply game rules.
export const armies: Army[] = [
  {
    slug: 'dwarfen-mountain-holds', name: 'Dwarfen Mountain Holds', family: 'Forces of Fantasy', dataKey: 'dwarfen-mountain-holds',
    compositions: [
      { id: 'dwarfen-mountain-holds', name: 'Grand Army' },
      { id: 'royal-clan', name: 'Royal Clan' },
      { id: 'expeditionary-force', name: 'Expeditionary Force' },
      { id: 'slayer-host', name: 'Slayer Host' },
    ],
  },
  {
    slug: 'empire-of-man', name: 'Empire of Man', family: 'Forces of Fantasy', dataKey: 'empire-of-man',
    compositions: [
      { id: 'empire-of-man', name: 'Grand Army' },
      { id: 'city-state-of-nuln', name: 'City-State of Nuln' },
      { id: 'knightly-order-panther', name: 'Order of the Knights Panther' },
      { id: 'knightly-order-white-wolf', name: 'Order of the White Wolf' },
      { id: 'knightly-order-blazing-sun', name: 'Order of the Blazing Sun' },
      { id: 'knightly-order-morr', name: 'Order of the Knights of Morr' },
      { id: 'knightly-order-fiery-heart', name: 'Order of the Fiery Heart' },
    ],
    sampleUnits: [
      { name: 'Empire Character', category: 'Characters' },
      { name: 'State Troops', category: 'Core' },
      { name: 'Empire Special Unit', category: 'Special' },
      { name: 'Empire Rare Unit', category: 'Rare' },
    ],
  },
  {
    slug: 'grand-cathay', name: 'Grand Cathay', family: 'Forces of Fantasy', dataKey: 'grand-cathay',
    compositions: [
      { id: 'grand-cathay', name: 'Grand Army' },
      { id: 'jade-fleet', name: 'Jade Fleet' },
      { id: 'warriors-of-wind-and-field', name: 'Warriors of Wind & Field' },
    ],
  },
  {
    slug: 'high-elf-realms', name: 'High Elf Realms', family: 'Forces of Fantasy', dataKey: 'high-elf-realms',
    compositions: [
      { id: 'high-elf-realms', name: 'Grand Army' },
      { id: 'the-chracian-warhost', name: 'The Chracian Warhost' },
      { id: 'sea-guard-garrison', name: 'Sea Guard Garrison' },
    ],
  },
  {
    slug: 'kingdom-of-bretonnia', name: 'Kingdom of Bretonnia', family: 'Forces of Fantasy', dataKey: 'kingdom-of-bretonnia',
    compositions: [
      { id: 'kingdom-of-bretonnia', name: 'Grand Army' },
      { id: 'errantry-crusades', name: 'Errantry Crusades' },
      { id: 'bretonnian-exiles', name: 'Bretonnian Exiles' },
    ],
  },
  {
    slug: 'lizardmen', name: 'Lizardmen', family: 'Legends of Legacy', dataKey: 'lizardmen', legacy: true,
    compositions: [
      { id: 'lizardmen', name: 'Grand Army' },
      { id: 'lm-renegade', name: 'Renegade' },
    ],
  },
  {
    slug: 'wood-elf-realms', name: 'Wood Elf Realms', family: 'Forces of Fantasy', dataKey: 'wood-elf-realms',
    compositions: [
      { id: 'wood-elf-realms', name: 'Grand Army' },
      { id: 'orions-wild-hunt', name: "Orion's Wild Hunt" },
      { id: 'host-of-talsyn', name: 'Host of Talsyn' },
    ],
  },
  {
    slug: 'dark-elves', name: 'Dark Elves', family: 'Legends of Legacy', dataKey: 'dark-elves', legacy: true,
    compositions: [
      { id: 'dark-elves', name: 'Grand Army' },
      { id: 'de-renegade', name: 'Renegade' },
    ],
  },

  {
    slug: 'beastmen-brayherds', name: 'Beastmen Brayherds', family: 'Powers of Chaos', dataKey: 'beastmen-brayherds',
    compositions: [
      { id: 'beastmen-brayherds', name: 'Grand Army' },
      { id: 'minotaur-blood-herd', name: 'Minotaur Blood Herd' },
      { id: 'wild-herd', name: 'Wild Herd' },
    ],
  },
  {
    slug: 'chaos-dwarfs', name: 'Chaos Dwarfs', family: 'Legends of Legacy', dataKey: 'chaos-dwarfs', legacy: true,
    compositions: [
      { id: 'chaos-dwarfs', name: 'Grand Army' },
      { id: 'cd-renegade', name: 'Renegade' },
    ],
  },
  {
    slug: 'daemons-of-chaos', name: 'Daemons of Chaos', family: 'Legends of Legacy', dataKey: 'daemons-of-chaos', legacy: true,
    compositions: [
      { id: 'daemons-of-chaos', name: 'Grand Army' },
      { id: 'doc-renegade', name: 'Renegade' },
    ],
  },
  {
    slug: 'renegade-crowns', name: 'Renegade Crowns', family: 'Powers of Chaos', dataKey: 'renegade-crowns', selectable: false,
    compositions: [
      { id: 'renegade-crowns', name: 'Grand Army' },
    ],
  },
  {
    slug: 'skaven', name: 'Skaven', family: 'Legends of Legacy', dataKey: 'skaven', legacy: true,
    compositions: [
      { id: 'skaven', name: 'Grand Army' },
      { id: 'sk-renegade', name: 'Renegade' },
    ],
  },
  {
    slug: 'warriors-of-chaos', name: 'Warriors of Chaos', family: 'Powers of Chaos', dataKey: 'warriors-of-chaos',
    compositions: [
      { id: 'warriors-of-chaos', name: 'Grand Army' },
      { id: 'wolves-of-the-sea', name: 'Wolves of the Sea' },
      { id: 'heralds-of-darkness', name: 'Heralds of Darkness' },
    ],
  },

  {
    slug: 'tomb-kings-of-khemri', name: 'Tomb Kings of Khemri', family: 'Legions of Undead', dataKey: 'tomb-kings-of-khemri',
    compositions: [
      { id: 'tomb-kings-of-khemri', name: 'Grand Army' },
      { id: 'nehekharan-royal-hosts', name: 'Nehekharan Royal Hosts' },
      { id: 'mortuary-cults', name: 'Mortuary Cults' },
    ],
  },
  {
    slug: 'vampire-counts', name: 'Vampire Counts', family: 'Legends of Legacy', dataKey: 'vampire-counts', legacy: true,
    compositions: [
      { id: 'vampire-counts', name: 'Grand Army' },
      { id: 'vc-renegade', name: 'Renegade' },
    ],
  },

  {
    slug: 'ogre-kingdoms', name: 'Ogre Kingdoms', family: 'Legends of Legacy', dataKey: 'ogre-kingdoms', legacy: true,
    compositions: [
      { id: 'ogre-kingdoms', name: 'Grand Army' },
      { id: 'ok-renegade', name: 'Renegade' },
    ],
  },
  {
    slug: 'orc-and-goblin-tribes', name: 'Orc & Goblin Tribes', family: 'Ravening Hordes', dataKey: 'orc-and-goblin-tribes',
    compositions: [
      { id: 'orc-and-goblin-tribes', name: 'Grand Army' },
      { id: 'nomadic-waaagh', name: 'Nomadic Waaagh!' },
      { id: 'troll-horde', name: 'Troll Horde' },
    ],
    sampleUnits: [
      { name: 'Orc & Goblin Character', category: 'Characters' },
      { name: 'Orc & Goblin Core Unit', category: 'Core' },
      { name: 'Orc & Goblin Special Unit', category: 'Special' },
      { name: 'Orc & Goblin Rare Unit', category: 'Rare' },
    ],
  },
]

export const armyFamilyOrder: ArmyFamily[] = ['Forces of Fantasy', 'Powers of Chaos', 'Legions of Undead', 'Ravening Hordes', 'Legends of Legacy']
export const selectableArmies = armies.filter((army) => army.selectable !== false)
export const officialArmies = selectableArmies.filter((army) => !army.legacy)
export const legacyArmies = selectableArmies.filter((army) => army.legacy)

export function getArmy(slug: string) {
  return armies.find((army) => army.slug === slug)
}

export function isLegacyArmy(slug: string) {
  return Boolean(getArmy(slug)?.legacy)
}
