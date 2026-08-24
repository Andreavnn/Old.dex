import type { BuilderCategory } from '../data/builderPrototype'

export type BuilderRosterRule = { label: string; path: string }

export type BuilderRosterMagicItem = {
  id: string
  name: string
  points: number
  type: 'weapon' | 'armor' | 'talisman' | 'enchanted-item' | 'arcane-item' | 'banner'
  source: string
  stackable: boolean
  maximum?: number
  onePerArmy: boolean
  slug: string
  count: number
  baseId?: string
  ownerId?: string
  ownerLabel?: string
  poolMaxPoints?: number
  magicStandardLimit?: { maxUnits: number; perPoints: number }
}

export type BuilderRosterSelection = {
  instanceId: string
  unitId: string
  name: string
  category: BuilderCategory
  totalPoints: number
  basePoints: number
  unitSize: string
  modelCount?: number
  maximumModels?: number
  named?: boolean
  custom?: boolean
  mustBeGeneral?: boolean
  cannotBeGeneral?: boolean
  troopType?: string
  leadership?: number
  /** Effective movement snapshot used by match tools such as maximum charge range. */
  movement?: number
  generalEligible?: boolean
  hierophantEligible?: boolean
  options: string[]
  includedEquipment?: string[]
  optionalSelections?: string[]
  specialRules: BuilderRosterRule[]
  keywords: BuilderRosterRule[]
  weaponIds?: string[]
  equipmentIds?: string[]
  magicItems?: BuilderRosterMagicItem[]
  magicPools?: Array<{ ownerId: string; ownerLabel: string; maxPoints: number }>
  weaponCounts?: Record<string, number>
  equipmentCounts?: Record<string, number>
  loreSelections?: string[]
}
