export type RawRecord = Record<string, unknown>

export interface RawMagicConfig extends RawRecord {
  maxPoints?: unknown
  maximum?: unknown
  points?: unknown
  types?: unknown
}

export interface RawBuilderItem extends RawRecord {
  id?: unknown
  name_en?: unknown
  name?: unknown
  text_en?: unknown
  text?: unknown
  points?: unknown
  active?: unknown
  alwaysActive?: unknown
  equippedDefault?: unknown
  perModel?: unknown
  stackable?: unknown
  perModelSelection?: unknown
  mixedAllocation?: unknown
  mixed?: unknown
  allocationGroup?: unknown
  group?: unknown
  minimum?: unknown
  maximum?: unknown
  exclusive?: unknown
  notes?: unknown
  magic?: unknown
  options?: RawBuilderItem[]
  profile?: unknown
}

export interface RawBuilderUnit extends RawBuilderItem {
  equipment?: RawBuilderItem[]
  armor?: RawBuilderItem[]
  command?: RawBuilderItem[]
  mounts?: RawBuilderItem[]
  items?: RawBuilderItem[]
  lores?: unknown[]
  specialRules?: unknown
  armyComposition?: unknown
  noHandWeapon?: unknown
  handWeapon?: unknown
  profiles?: unknown
  unitProfiles?: unknown
}

export type ArmyDataDocument = Record<string, unknown>
export type MagicItemDataDocument = Record<string, RawRecord[]>
