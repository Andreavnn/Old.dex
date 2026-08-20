export type BuilderCategory = 'General' | 'Characters' | 'Core' | 'Special' | 'Rare' | 'Mercenaries' | 'Allies' | 'Custom Units'
export type RuleTone = 'strategy' | 'movement' | 'shooting' | 'combat' | 'magic' | 'passive' | 'reaction'
export type ProfileKey = 'M' | 'WS' | 'BS' | 'S' | 'T' | 'W' | 'I' | 'A' | 'Ld' | 'Sv' | 'Ward' | 'Rn'
export type SelectionMode = 'unit-toggle' | 'per-model-count'
export type CostMode = 'flat' | 'per-model'

export type PrototypeWeapon = {
  id: string
  name: string
  kind: 'melee' | 'missile'
  range: string
  strength: string
  ap: string
  rules: string[]
  points: number
  default: boolean
  /** Pricing scope. Kept separate from how the option is selected. */
  costMode?: CostMode
  /** UI/roster selection scope. Shields and armour are always unit-toggle. */
  selectionMode?: SelectionMode
  /** Optional allocation bucket for mixed-model weapon choices. */
  allocationGroup?: string
  /** Legacy source flags retained only for migration/diagnostics. */
  perModel?: boolean
  stackable?: boolean
  minimum?: number
  maximum?: number
  rawId?: string
  locked?: boolean
  alwaysIncluded?: boolean
  exclusiveGroup?: string
  requiresSelection?: string
  requiresMounted?: boolean
  note?: string
  path?: string
  ruleLinks?: Array<{ label: string; path: string }>
  hasUniqueRule?: boolean
}

export type PrototypeEquipmentOption = {
  id: string
  name: string
  points: number
  default: boolean
  /** Pricing scope. Kept separate from how the option is selected. */
  costMode?: CostMode
  /** UI/roster selection scope. */
  selectionMode?: SelectionMode
  allocationGroup?: string
  /** Legacy source flags retained only for migration/diagnostics. */
  perModel?: boolean
  stackable?: boolean
  minimum?: number
  maximum?: number
  rawId?: string
  locked?: boolean
  alwaysIncluded?: boolean
  profileOverride?: Partial<Record<ProfileKey, string>>
  saveModifier?: number
  exclusiveGroup?: string
  replaces?: string[]
  requiresSelection?: string
  /** Additional prerequisites that must all be active. */
  requiresAllSelections?: string[]
  /** Alternative prerequisites where at least one must be active. */
  requiresAnySelection?: string[]
  /** Selections that make this option unavailable. */
  forbidsSelection?: string[]
  /** Option is only available while an actual mount is selected. */
  requiresMounted?: boolean
  /** Characteristic bonuses granted to the rider by this mount. */
  riderProfileModifiers?: Partial<Record<ProfileKey, number>>
  kind?: 'equipment' | 'armour' | 'special' | 'mount' | 'mount-option' | 'role'
  note?: string
  magicAllowance?: PrototypeMagicAllowance
  addsProfile?: string
  profileEquipment?: string[]
}

export type PrototypeMagicAllowance = {
  maxPoints: number
  types: Array<'weapon' | 'armor' | 'talisman' | 'enchanted-item' | 'arcane-item' | 'banner'>
}

export type PrototypeUnit = {
  id: string
  name: string
  category: BuilderCategory
  points: number
  unitSize: string
  profile: Record<ProfileKey, string>
  weapons: PrototypeWeapon[]
  equipmentOptions: PrototypeEquipmentOption[]
  magicAllowance?: PrototypeMagicAllowance
  details: {
    troopType: string
    baseSize: string
    publication: string
    page?: number
    army?: string
    unitCategory?: string
    notes?: string
  }
  specialRules: Array<{
    name: string
    path: string
    timing: string
    tone: RuleTone
    summary: string
    keywords: Array<{ label: string; path: string }>
    requiresSelection?: string
    requiresAnySelection?: string[]
  }>
  keywords: Array<{ label: string; path: string }>
  profiles?: Array<{ name: string; profile: Record<ProfileKey, string> }>
  optionalProfiles?: Array<{ selectionId: string; name: string; profile: Record<ProfileKey, string>; equipment?: string[] }>
  minimumModels?: number
  maximumModels?: number
  basePointsPerModel?: number
  named?: boolean
  mustBeGeneral?: boolean
  cannotBeGeneral?: boolean
  compositionNotes?: string[]
  lores?: string[]
  baseWizardLevel?: number
  additionalDetails?: Array<{ label: string; value: string }>
  mixedWeaponAllocation?: boolean
  assumesHandWeapon?: boolean
  sourceKind?: 'prototype' | 'live'
}

const dwarfProfile: Record<ProfileKey, string> = { M: '3', WS: '6', BS: '4', S: '4', T: '5', W: '3', I: '3', A: '4', Ld: '10', Sv: '4+', Ward: '—', Rn: '—' }
const infantryProfile: Record<ProfileKey, string> = { M: '4', WS: '4', BS: '3', S: '3', T: '3', W: '1', I: '3', A: '1', Ld: '8', Sv: '5+', Ward: '—', Rn: '—' }
const orcProfile: Record<ProfileKey, string> = { M: '4', WS: '6', BS: '2', S: '5', T: '5', W: '3', I: '5', A: '4', Ld: '8', Sv: '6+', Ward: '—', Rn: '—' }

const handWeapon = (): PrototypeWeapon => ({ id: 'hand-weapon', name: 'Hand weapon', kind: 'melee', range: 'Combat', strength: 'S', ap: '—', rules: [], points: 0, default: true, locked: true })

export const prototypeUnits: PrototypeUnit[] = [
  {
    id: 'king', name: 'King', category: 'Characters', points: 125, unitSize: '1 model', profile: dwarfProfile,
    weapons: [
      handWeapon(),
      { id: 'great-weapon', name: 'Great weapon', kind: 'melee', range: 'Combat', strength: 'S+2', ap: '2', rules: ['Requires Two Hands', 'Strike Last'], points: 6, default: false },
      { id: 'handgun', name: 'Handgun', kind: 'missile', range: '24"', strength: '4', ap: '1', rules: ['Armour Bane (1)', 'Move or Shoot'], points: 8, default: false },
    ],
    equipmentOptions: [
      { id: 'full-plate', name: 'Full plate armour', points: 0, default: true, locked: true, profileOverride: { Sv: '4+' } },
      { id: 'shield', name: 'Shield', points: 3, default: false, profileOverride: { Sv: '3+' } },
      { id: 'rune-upgrade', name: 'Runic heirloom', points: 10, default: false, profileOverride: { Ward: '6+' } },
    ],
    details: { troopType: 'Regular Infantry (Character)', baseSize: '25 × 25 mm', publication: 'Forces of Fantasy' },
    specialRules: [
      { name: 'Rallying Cry', path: '/special-rules/rallying-cry', timing: 'Strategy Phase', tone: 'strategy', summary: 'A command-focused rule presented here as a phase-coloured reference card.', keywords: [{ label: 'Strategy Phase', path: '/the-strategy-phase/the-strategy-phase-sequence' }, { label: 'Rally', path: '/the-strategy-phase/rally-fleeing-units' }] },
      { name: 'Resolute', path: '/model-profiles/leadership-ld', timing: 'Passive', tone: 'passive', summary: 'A persistent unit rule. Passive effects use a neutral treatment so phase-specific rules stand out.', keywords: [{ label: 'Leadership', path: '/model-profiles/leadership-ld' }, { label: 'Combat Result', path: '/the-combat-phase/calculate-combat-result' }] },
      { name: 'Ancestral Grudge', path: '/special-rules/hatred', timing: 'Combat', tone: 'combat', summary: 'A combat-facing example showing how Old.dex can group rules by the phase in which they matter.', keywords: [{ label: 'Combat Phase', path: '/the-combat-phase/the-combat-phase-sequence' }, { label: 'Hatred', path: '/special-rules/hatred' }] },
    ],
    keywords: [{ label: 'Character', path: '/characters/characters' }, { label: 'Infantry', path: '/model-profiles/troop-type' }, { label: 'General', path: '/characters/the-general' }],
  },
  {
    id: 'dwarf-warriors', name: 'Dwarf Warriors', category: 'Core', points: 90, unitSize: '10+ models', profile: { ...infantryProfile, M: '3', WS: '4', T: '4', Ld: '9', Sv: '5+' },
    weapons: [
      handWeapon(),
      { id: 'great-weapons', name: 'Great weapons', kind: 'melee', range: 'Combat', strength: 'S+2', ap: '2', rules: ['Requires Two Hands', 'Strike Last'], points: 20, default: false },
      { id: 'crossbows', name: 'Crossbows', kind: 'missile', range: '30"', strength: '4', ap: '1', rules: [], points: 20, default: false },
    ],
    equipmentOptions: [
      { id: 'heavy-armour', name: 'Heavy armour', points: 0, default: true, locked: true, profileOverride: { Sv: '5+' } },
      { id: 'shields', name: 'Shields', points: 10, default: false, profileOverride: { Sv: '4+' } },
      { id: 'full-command', name: 'Full command', points: 15, default: false },
    ],
    details: { troopType: 'Heavy Infantry', baseSize: '25 × 25 mm', publication: 'Forces of Fantasy' },
    specialRules: [
      { name: 'Close Order', path: '/special-rules/close-order', timing: 'Passive', tone: 'passive', summary: 'Formation-related rules can carry direct helper links to the relevant formation reference.', keywords: [{ label: 'Close Order', path: '/forming-units/close-order-formation' }, { label: 'Ranks', path: '/forming-units/ranks' }] },
      { name: 'Shieldwall', path: '/special-rules/shieldwall', timing: 'Combat Reaction', tone: 'reaction', summary: 'Reaction and conditional effects use their own colour so they remain visually distinct from normal combat rules.', keywords: [{ label: 'Combat Phase', path: '/the-combat-phase/the-combat-phase-sequence' }, { label: 'Give Ground', path: '/the-combat-phase/loser-gives-ground' }] },
    ],
    keywords: [{ label: 'Infantry', path: '/model-profiles/troop-type' }, { label: 'Close Order', path: '/forming-units/close-order-formation' }],
  },
  {
    id: 'quarrellers', name: 'Quarrellers', category: 'Core', points: 100, unitSize: '10+ models', profile: { ...infantryProfile, M: '3', WS: '4', BS: '3', T: '4', Ld: '9', Sv: '5+' },
    weapons: [
      handWeapon(),
      { id: 'crossbow', name: 'Crossbow', kind: 'missile', range: '30"', strength: '4', ap: '1', rules: ['Armour Bane (1)'], points: 0, default: true, locked: true },
      { id: 'great-weapons', name: 'Great weapons', kind: 'melee', range: 'Combat', strength: 'S+2', ap: '2', rules: ['Requires Two Hands', 'Strike Last'], points: 20, default: false },
    ],
    equipmentOptions: [
      { id: 'heavy-armour', name: 'Heavy armour', points: 0, default: true, locked: true, profileOverride: { Sv: '5+' } },
      { id: 'shields', name: 'Shields', points: 10, default: false, profileOverride: { Sv: '4+' } },
      { id: 'full-command', name: 'Full command', points: 15, default: false },
    ],
    details: { troopType: 'Heavy Infantry', baseSize: '25 × 25 mm', publication: 'Forces of Fantasy' },
    specialRules: [
      { name: 'Dwarf Crafted', path: '/the-shooting-phase/roll-to-hit', timing: 'Shooting', tone: 'shooting', summary: 'Shooting-facing rules are colour coded separately from combat and strategy effects.', keywords: [{ label: 'Shooting Phase', path: '/the-shooting-phase/the-shooting-phase-sequence' }, { label: 'Roll To Hit', path: '/the-shooting-phase/roll-to-hit' }] },
    ],
    keywords: [{ label: 'Infantry', path: '/model-profiles/troop-type' }, { label: 'Missile Weapon', path: '/weapons-of-war/missile-weapons' }],
  },
  {
    id: 'ironbreakers', name: 'Ironbreakers', category: 'Special', points: 150, unitSize: '10+ models', profile: { ...infantryProfile, M: '3', WS: '5', T: '4', Ld: '9', Sv: '3+' },
    weapons: [
      handWeapon(),
      { id: 'great-weapons', name: 'Great weapons', kind: 'melee', range: 'Combat', strength: 'S+2', ap: '2', rules: ['Requires Two Hands', 'Strike Last'], points: 25, default: false },
    ],
    equipmentOptions: [
      { id: 'full-plate', name: 'Full plate armour', points: 0, default: true, locked: true, profileOverride: { Sv: '4+' } },
      { id: 'shields', name: 'Shields', points: 0, default: true, locked: true, profileOverride: { Sv: '3+' } },
      { id: 'full-command', name: 'Full command', points: 15, default: false },
    ],
    details: { troopType: 'Heavy Infantry', baseSize: '25 × 25 mm', publication: 'Forces of Fantasy' },
    specialRules: [
      { name: 'Gromril Armour', path: '/weapons-of-war/armour', timing: 'Passive', tone: 'passive', summary: 'Armour and always-on profile modifications use the passive presentation.', keywords: [{ label: 'Armour Saves', path: '/the-combat-phase/make-armour-saves-combat' }, { label: 'Armour', path: '/weapons-of-war/armour' }] },
    ],
    keywords: [{ label: 'Infantry', path: '/model-profiles/troop-type' }, { label: 'Armoured', path: '/weapons-of-war/armour' }],
  },
  {
    id: 'orc-warboss', name: 'Orc Warboss', category: 'Characters', points: 110, unitSize: '1 model', profile: orcProfile,
    weapons: [
      handWeapon(),
      { id: 'additional-hand-weapon', name: 'Additional hand weapon', kind: 'melee', range: 'Combat', strength: 'S', ap: '—', rules: ['Extra Attacks (+1)'], points: 3, default: false, exclusiveGroup: 'warboss-weapon' },
      { id: 'great-weapon', name: 'Great weapon', kind: 'melee', range: 'Combat', strength: 'S+2', ap: '2', rules: ['Requires Two Hands', 'Strike Last'], points: 4, default: false, exclusiveGroup: 'warboss-weapon' },
      { id: 'cavalry-spear', name: 'Cavalry spear', kind: 'melee', range: 'Combat', strength: 'S+1 on charge', ap: '1 on charge', rules: [], points: 2, default: false, exclusiveGroup: 'warboss-weapon', requiresSelection: 'mount-war-boar', note: 'If appropriately mounted' },
    ],
    equipmentOptions: [
      { id: 'general', name: 'General', points: 0, default: false, kind: 'role', note: 'Army role' },
      { id: 'light-armour', name: 'Light armour', points: 0, default: true, locked: true, kind: 'armour', profileOverride: { Sv: '6+' } },
      { id: 'heavy-armour', name: 'Heavy armour', points: 3, default: false, kind: 'armour', exclusiveGroup: 'warboss-armour', replaces: ['light-armour'], profileOverride: { Sv: '5+' } },
      { id: 'frenzy', name: 'Frenzy', points: 3, default: false, kind: 'special', exclusiveGroup: 'warboss-armour', replaces: ['light-armour'], note: '0-1 per 1,000 points; replaces light armour' },
      { id: 'shield', name: 'Shield', points: 2, default: false, kind: 'equipment' },
      { id: 'warpaint', name: 'Warpaint', points: 5, default: false, kind: 'special', requiresSelection: 'frenzy', profileOverride: { Ward: '6+' }, note: 'Only if Frenzied; cannot wear armour' },
      { id: 'mount-on-foot', name: 'On foot', points: 0, default: true, locked: true, kind: 'mount', exclusiveGroup: 'warboss-mount' },
      { id: 'mount-war-boar', name: 'War Boar', points: 16, default: false, kind: 'mount', exclusiveGroup: 'warboss-mount' },
      { id: 'mount-boar-chariot', name: 'Boar Chariot', points: 90, default: false, kind: 'mount', exclusiveGroup: 'warboss-mount' },
      { id: 'mount-wyvern', name: 'Wyvern', points: 130, default: false, kind: 'mount', exclusiveGroup: 'warboss-mount' },
      { id: 'chariot-third-crew', name: 'Third Orc crew member', points: 5, default: false, kind: 'mount-option', requiresSelection: 'mount-boar-chariot' },
      { id: 'chariot-frenzy-2', name: 'Boar Chariot: Frenzy (2 crew)', points: 4, default: false, kind: 'mount-option', requiresSelection: 'mount-boar-chariot', exclusiveGroup: 'chariot-frenzy', note: '0-1 per 1,000 points' },
      { id: 'chariot-frenzy-3', name: 'Boar Chariot: Frenzy (3 crew)', points: 6, default: false, kind: 'mount-option', requiresSelection: 'chariot-third-crew', exclusiveGroup: 'chariot-frenzy', note: '0-1 per 1,000 points' },
      { id: 'chariot-warpaint', name: 'Boar Chariot: Warpaint', points: 10, default: false, kind: 'mount-option', requiresAnySelection: ['chariot-frenzy-2', 'chariot-frenzy-3'], note: 'Only if the chariot is Frenzied' },
    ],
    magicAllowance: { maxPoints: 100, types: ['weapon', 'armor', 'talisman', 'enchanted-item'] },
    details: { troopType: 'Regular Infantry (Character)', baseSize: '30 × 30 mm', publication: 'Ravening Hordes', page: 13, army: 'Orc & Goblin Tribes', unitCategory: 'Character' },
    specialRules: [
      { name: 'Choppas', path: '/special-rules/choppas', timing: 'Combat / Charge', tone: 'combat', summary: 'When this model charges, its non-magical weapons become more effective at wounding and piercing armour.', keywords: [{ label: 'Charge', path: '/the-movement-phase/charge-moves' }, { label: 'Armour Piercing', path: '/the-shooting-phase/armour-piercing' }] },
      { name: 'Furious Charge', path: '/special-rules/furious-charge', timing: 'Combat / Charge', tone: 'combat', summary: 'After a charge move of 3 inches or more, this model gains an Attacks modifier for that turn. This does not apply to its mount.', keywords: [{ label: 'Charge Moves', path: '/the-movement-phase/charge-moves' }, { label: 'Attacks', path: '/model-profiles/attacks-a' }] },
      { name: 'Ignore Goblin Panic', path: '/special-rules/ignore-goblin-panic', timing: 'Panic Reaction', tone: 'reaction', summary: 'This model ignores specific Panic tests caused by nearby friendly Goblin units being destroyed, fleeing combat, or fleeing through it.', keywords: [{ label: 'Panic Tests', path: '/the-psychology-of-war/panic-tests' }, { label: 'Fled Through', path: '/the-psychology-of-war/fled-through' }] },
      { name: 'Impetuous', path: '/special-rules/impetuous', timing: 'Movement / Charges', tone: 'movement', summary: 'When able to declare a charge, an Impetuous unit may have to test Leadership or be forced to charge.', keywords: [{ label: 'Declare Charges', path: '/the-movement-phase/declare-charges-and-charge-reactions' }, { label: 'Leadership Test', path: '/model-profiles/leadership-tests' }] },
      { name: 'Rallying Cry', path: '/special-rules/rallying-cry', timing: 'Strategy / Command', tone: 'strategy', summary: 'During the Command sub-phase, this character can attempt to rally a nearby fleeing friendly unit.', keywords: [{ label: 'Command', path: '/the-strategy-phase/command' }, { label: 'Rally', path: '/the-strategy-phase/rally-fleeing-units' }] },
      { name: 'Waaagh!', path: '/special-rules/waaagh', timing: 'Strategy / Command', tone: 'strategy', summary: 'Once per game in the Command sub-phase, this character may invoke a Waaagh! to improve the fighting performance of itself and eligible Orc allies.', keywords: [{ label: 'Command', path: '/the-strategy-phase/command' }, { label: 'Combat Result', path: '/the-combat-phase/calculate-combat-result' }] },
      { name: 'Warband', path: '/special-rules/warband', timing: 'Passive', tone: 'passive', summary: 'Warband modifies Leadership using rank bonus in many situations and can improve charge reliability.', keywords: [{ label: 'Rank Bonus', path: '/the-combat-phase/rank-bonus' }, { label: 'Charge', path: '/the-movement-phase/charge-moves' }] },
      { name: 'Frenzy', path: '/special-rules/frenzy', timing: 'Combat / Charge', tone: 'combat', summary: 'Frenzy can increase Attacks after charging or following up, affects psychology and charge behaviour, and can be lost after losing combat.', keywords: [{ label: 'Declare Charges', path: '/the-movement-phase/declare-charges-and-charge-reactions' }, { label: 'Fear', path: '/special-rules/fear' }, { label: 'Panic', path: '/the-psychology-of-war/panic-tests' }], requiresSelection: 'frenzy' },
      { name: 'Warpaint', path: '/special-rules/warpaint', timing: 'Passive', tone: 'passive', summary: 'Warpaint grants a Ward save but prevents the model from wearing armour; a shield is still allowed.', keywords: [{ label: 'Ward Saves', path: '/the-shooting-phase/ward-saves' }, { label: 'Shield', path: '/weapons-of-war/shield' }], requiresSelection: 'warpaint' },
      { name: 'Armoured Hide (1)', path: '/special-rules/armoured-hide-x', timing: 'Passive — War Boar', tone: 'passive', summary: 'The selected War Boar mount has Armoured Hide (1).', keywords: [{ label: 'Armour', path: '/weapons-of-war/armour' }], requiresSelection: 'mount-war-boar' },
      { name: 'Counter Charge', path: '/special-rules/counter-charge', timing: 'Charge Reaction — War Boar', tone: 'reaction', summary: 'The selected War Boar mount can use the Counter Charge special rule.', keywords: [{ label: 'Charge Reactions', path: '/the-movement-phase/charge-reactions' }], requiresSelection: 'mount-war-boar' },
      { name: 'Swiftstride', path: '/special-rules/swiftstride', timing: 'Movement — War Boar', tone: 'movement', summary: 'The selected War Boar mount has Swiftstride.', keywords: [{ label: 'Movement Phase', path: '/the-movement-phase/the-movement-phase-sequence' }], requiresSelection: 'mount-war-boar' },
      { name: 'Tusker Charge', path: '/special-rules/tusker-charge', timing: 'Combat / Charge — War Boar', tone: 'combat', summary: 'The selected War Boar mount gains the Tusker Charge special rule.', keywords: [{ label: 'Charge', path: '/the-movement-phase/charge-moves' }], requiresSelection: 'mount-war-boar' },
      { name: 'Close Order', path: '/special-rules/close-order', timing: 'Passive — Boar Chariot', tone: 'passive', summary: 'The selected Boar Chariot mount uses Close Order.', keywords: [{ label: 'Close Order', path: '/forming-units/close-order-formation' }], requiresSelection: 'mount-boar-chariot' },
      { name: 'First Charge', path: '/special-rules/first-charge', timing: 'Combat / Charge — Boar Chariot', tone: 'combat', summary: 'The selected Boar Chariot mount has First Charge.', keywords: [{ label: 'Charge', path: '/the-movement-phase/charge-moves' }], requiresSelection: 'mount-boar-chariot' },
      { name: 'Impact Hits (D6+1)', path: '/special-rules/impact-hits-x', timing: 'Combat / Charge — Boar Chariot', tone: 'combat', summary: 'The selected Boar Chariot inflicts Impact Hits (D6+1).', keywords: [{ label: 'Combat Phase', path: '/the-combat-phase/the-combat-phase-sequence' }], requiresSelection: 'mount-boar-chariot' },
      { name: 'Tusker Charge (Chariot)', path: '/special-rules/tusker-charge', timing: 'Combat / Charge — Boar Chariot', tone: 'combat', summary: 'The War Boars drawing the chariot have Tusker Charge.', keywords: [{ label: 'Charge', path: '/the-movement-phase/charge-moves' }], requiresSelection: 'mount-boar-chariot' },
      { name: 'Frenzy (Boar Chariot)', path: '/special-rules/frenzy', timing: 'Combat / Charge — Boar Chariot', tone: 'combat', summary: 'The Boar Chariot has purchased Frenzy.', keywords: [{ label: 'Frenzy', path: '/special-rules/frenzy' }], requiresAnySelection: ['chariot-frenzy-2', 'chariot-frenzy-3'] },
      { name: 'Warpaint (Boar Chariot)', path: '/special-rules/warpaint', timing: 'Passive — Boar Chariot', tone: 'passive', summary: 'The Frenzied Boar Chariot has purchased Warpaint.', keywords: [{ label: 'Warpaint', path: '/special-rules/warpaint' }], requiresSelection: 'chariot-warpaint' },
      { name: 'Close Order (Wyvern)', path: '/special-rules/close-order', timing: 'Passive — Wyvern', tone: 'passive', summary: 'The selected Wyvern mount uses Close Order.', keywords: [{ label: 'Close Order', path: '/forming-units/close-order-formation' }], requiresSelection: 'mount-wyvern' },
      { name: 'Fly (9)', path: '/special-rules/fly-x', timing: 'Movement — Wyvern', tone: 'movement', summary: 'The selected Wyvern has Fly (9).', keywords: [{ label: 'Movement', path: '/movement-in-detail/basic-movement' }], requiresSelection: 'mount-wyvern' },
      { name: 'Large Target', path: '/special-rules/large-target', timing: 'Passive — Wyvern', tone: 'passive', summary: 'The selected Wyvern has the Large Target special rule.', keywords: [{ label: 'Line of Sight', path: '/model-and-unit-facing/line-of-sight' }], requiresSelection: 'mount-wyvern' },
      { name: 'Stomp Attacks (D3)', path: '/special-rules/stomp-attacks-x', timing: 'Combat — Wyvern', tone: 'combat', summary: 'The selected Wyvern makes Stomp Attacks (D3).', keywords: [{ label: 'Combat Phase', path: '/the-combat-phase/the-combat-phase-sequence' }], requiresSelection: 'mount-wyvern' },
      { name: 'Swiftstride (Wyvern)', path: '/special-rules/swiftstride', timing: 'Movement — Wyvern', tone: 'movement', summary: 'The selected Wyvern has Swiftstride.', keywords: [{ label: 'Movement Phase', path: '/the-movement-phase/the-movement-phase-sequence' }], requiresSelection: 'mount-wyvern' },
      { name: 'Terror', path: '/special-rules/terror', timing: 'Psychology — Wyvern', tone: 'reaction', summary: 'The selected Wyvern causes Terror.', keywords: [{ label: 'Psychology', path: '/the-psychology-of-war/panic-tests' }], requiresSelection: 'mount-wyvern' },
    ],
    keywords: [{ label: 'Character', path: '/characters/characters' }, { label: 'Regular Infantry', path: '/troop-types-in-detail/regular-infantry' }, { label: 'Orc', path: '/army/orc-and-goblin-tribes' }],
  },
  {
    id: 'prototype-commander', name: 'Army Commander', category: 'Characters', points: 100, unitSize: '1 model', profile: { ...infantryProfile, WS: '5', BS: '4', S: '4', T: '4', W: '3', I: '4', A: '3', Ld: '9', Sv: '5+' },
    weapons: [handWeapon(), { id: 'great-weapon', name: 'Great weapon', kind: 'melee', range: 'Combat', strength: 'S+2', ap: '2', rules: ['Requires Two Hands', 'Strike Last'], points: 6, default: false }, { id: 'bow', name: 'Bow', kind: 'missile', range: '24"', strength: '3', ap: '—', rules: [], points: 5, default: false }],
    equipmentOptions: [{ id: 'armour', name: 'Armour', points: 0, default: true, locked: true, profileOverride: { Sv: '5+' } }, { id: 'shield', name: 'Shield', points: 3, default: false, profileOverride: { Sv: '4+' } }],
    details: { troopType: 'Character', baseSize: '25 × 25 mm', publication: 'Army publication' },
    specialRules: [{ name: 'Command Ability', path: '/the-strategy-phase/command', timing: 'Strategy Phase', tone: 'strategy', summary: 'Prototype phase-coloured special rule for this army. Live unit rules will replace this sample.', keywords: [{ label: 'Strategy Phase', path: '/the-strategy-phase/the-strategy-phase-sequence' }, { label: 'Command', path: '/the-strategy-phase/command' }] }],
    keywords: [{ label: 'Character', path: '/characters/characters' }],
  },
  {
    id: 'prototype-core', name: 'Core Regiment', category: 'Core', points: 100, unitSize: '10+ models', profile: { ...infantryProfile, Sv: '6+' },
    weapons: [handWeapon(), { id: 'spears', name: 'Spears', kind: 'melee', range: 'Combat', strength: 'S', ap: '—', rules: ['Fight in Extra Rank'], points: 10, default: false }, { id: 'bows', name: 'Bows', kind: 'missile', range: '24"', strength: '3', ap: '—', rules: [], points: 10, default: false }],
    equipmentOptions: [{ id: 'armour', name: 'Armour', points: 0, default: true, locked: true, profileOverride: { Sv: '6+' } }, { id: 'shields', name: 'Shields', points: 10, default: false, profileOverride: { Sv: '5+' } }, { id: 'full-command', name: 'Full command', points: 15, default: false }],
    details: { troopType: 'Regular Infantry', baseSize: '25 × 25 mm', publication: 'Army publication' },
    specialRules: [{ name: 'Formation Rule', path: '/forming-units/close-order-formation', timing: 'Passive', tone: 'passive', summary: 'Prototype passive rule showing the intended presentation for live unit data.', keywords: [{ label: 'Close Order', path: '/forming-units/close-order-formation' }] }],
    keywords: [{ label: 'Infantry', path: '/model-profiles/troop-type' }],
  },
  {
    id: 'prototype-special', name: 'Elite Regiment', category: 'Special', points: 150, unitSize: '5+ models', profile: { ...infantryProfile, WS: '5', S: '4', T: '4', I: '4', Ld: '8', Sv: '5+' },
    weapons: [handWeapon(), { id: 'halberds', name: 'Halberds', kind: 'melee', range: 'Combat', strength: 'S+1', ap: '1', rules: ['Requires Two Hands'], points: 15, default: false }],
    equipmentOptions: [{ id: 'heavy-armour', name: 'Heavy armour', points: 0, default: true, locked: true, profileOverride: { Sv: '5+' } }, { id: 'full-command', name: 'Full command', points: 15, default: false }],
    details: { troopType: 'Heavy Infantry', baseSize: '25 × 25 mm', publication: 'Army publication' },
    specialRules: [{ name: 'Elite Training', path: '/the-combat-phase/choose-and-fight-combat', timing: 'Combat Phase', tone: 'combat', summary: 'Prototype combat-phase rule. Live army data will replace this sample.', keywords: [{ label: 'Combat Phase', path: '/the-combat-phase/the-combat-phase-sequence' }] }],
    keywords: [{ label: 'Infantry', path: '/model-profiles/troop-type' }],
  },
  {
    id: 'prototype-rare', name: 'Rare Support', category: 'Rare', points: 175, unitSize: '1 model', profile: { ...infantryProfile, WS: '3', BS: '4', S: '4', T: '5', W: '3', I: '2', A: '2', Ld: '8', Sv: '5+' },
    weapons: [handWeapon(), { id: 'special-weapon', name: 'Special weapon', kind: 'missile', range: '24"', strength: '4', ap: '1', rules: [], points: 0, default: true, locked: true }],
    equipmentOptions: [{ id: 'special-equipment', name: 'Special equipment', points: 0, default: true, locked: true, profileOverride: { Sv: '5+' } }],
    details: { troopType: 'Support', baseSize: 'Variable', publication: 'Army publication' },
    specialRules: [{ name: 'Specialist', path: '/the-shooting-phase/the-shooting-phase-sequence', timing: 'Shooting Phase', tone: 'shooting', summary: 'Prototype shooting-phase rule. Live army data will replace this sample.', keywords: [{ label: 'Shooting Phase', path: '/the-shooting-phase/the-shooting-phase-sequence' }] }],
    keywords: [{ label: 'Support', path: '/model-profiles/troop-type' }],
  },
]

export function prototypeUnitsForArmy(armySlug: string): PrototypeUnit[] {
  if (armySlug === 'orc-and-goblin-tribes') return prototypeUnits.filter((unit) => unit.id === 'orc-warboss')
  if (armySlug === 'dwarfen-mountain-holds') return prototypeUnits.filter((unit) => ['king', 'dwarf-warriors', 'quarrellers', 'ironbreakers'].includes(unit.id))
  return prototypeUnits.filter((unit) => unit.id.startsWith('prototype-'))
}
