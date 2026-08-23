import type { ProfileKey, PrototypeEquipmentOption, PrototypeUnit } from '../data/builderPrototype'
import { isPerModelEquipmentSelection, isShieldName } from './loadout'
import { saveOnlyProfileOverride } from './canonicalProfiles'

export function improveSaveBy(value: string, amount = 1) {
  const parsed = Number.parseInt(value, 10)
  const base = Number.isFinite(parsed) ? parsed : 7
  return `${Math.max(2, base - Math.max(0, amount))}+`
}

export function incrementCharacteristic(value: string, amount: number) {
  const numeric = Number.parseInt(value, 10)
  return Number.isFinite(numeric) ? String(numeric + amount) : value
}

function characteristicEffectiveNumber(value: string) {
  const parenthesized = value.match(/\((-?\d+)\)\s*$/)
  if (parenthesized) return Number(parenthesized[1])
  const numeric = Number.parseInt(value, 10)
  return Number.isFinite(numeric) ? numeric : null
}

export function formatCharacteristicBonus(value: string, amount: number) {
  const current = characteristicEffectiveNumber(value)
  if (current === null || !amount) return value
  const base = value.replace(/\s*\(-?\d+\)\s*$/, '').trim()
  return `${base}(${current + amount})`
}

export function normalizedModelName(value: string) {
  return value.toLowerCase().replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()
}

export function isMountProfileName(name: string) {
  return /\b(boar|horse|steed|wolf|spider|squig|dragon|wyvern|griffon|griffin|pegasus|eagle|unicorn|manticore|chariot|carpet|throne|palanquin|stag|cold one|demigryph|warhawk)\b/i.test(name)
}

export function optionAppliesToProfile(unit: PrototypeUnit, option: PrototypeEquipmentOption, profileName: string) {
  const mountProfile = isMountProfileName(profileName)
  if (option.kind === 'mount-option') return mountProfile
  if (mountProfile) return false
  if (!option.requiresSelection) return true
  const owner = unit.equipmentOptions.find((candidate) => candidate.id === option.requiresSelection)
  if (!owner?.addsProfile) return true
  const profileKey = normalizedModelName(profileName)
  const ownerKey = normalizedModelName(owner.addsProfile)
  return Boolean(ownerKey && (profileKey.includes(ownerKey) || ownerKey.includes(profileKey)))
}

function ruleAppliesToProfile(unit: PrototypeUnit, rule: PrototypeUnit['specialRules'][number], profileName: string) {
  if (!rule.requiresSelection) return true
  const source = unit.equipmentOptions.find((option) => option.id === rule.requiresSelection)
  return !source || optionAppliesToProfile(unit, source, profileName)
}

function armouredHideBonus(unit: PrototypeUnit, rules: PrototypeUnit['specialRules'], profileName: string) {
  return rules.reduce((best, rule) => {
    if (!ruleAppliesToProfile(unit, rule, profileName)) return best
    const match = rule.name.match(/Armou?red Hide\s*\((\d+)\)/i)
    return match ? Math.max(best, Number(match[1]) || 0) : best
  }, 0)
}

function regenerationSave(unit: PrototypeUnit, rules: PrototypeUnit['specialRules'], profileName: string) {
  const values = rules.flatMap((rule) => {
    if (!ruleAppliesToProfile(unit, rule, profileName)) return []
    const match = rule.name.match(/Regeneration\s*\((\d+)\+\)/i)
    return match ? [Number(match[1])] : []
  }).filter((value) => Number.isFinite(value) && value > 0)
  return values.length ? `${Math.min(...values)}+` : '—'
}

function wardSaveFromRules(unit: PrototypeUnit, rules: PrototypeUnit['specialRules'], profileName: string) {
  const values = rules.flatMap((rule) => {
    if (!ruleAppliesToProfile(unit, rule, profileName)) return []
    const source = `${rule.name} ${rule.summary || ''}`
    const match = source.match(/(?:Ward\s+save(?:\s+of)?\s*\(?\s*(\d+)\+\s*\)?|(\d+)\+\s+Ward\s+save)/i)
    return match ? [Number(match[1] || match[2])] : []
  }).filter((value) => Number.isFinite(value) && value > 0)
  return values.length ? `${Math.min(...values)}+` : ''
}

export type ProfileEffectInput = {
  baseProfile: Record<ProfileKey, string>
  profileName: string
  unit: PrototypeUnit
  selectedEquipment: PrototypeEquipmentOption[]
  equipmentCount: (option: PrototypeEquipmentOption) => number
  modelCount: number
  activeRules: PrototypeUnit['specialRules']
  bigUnsSelected: boolean
  magicOverride?: Partial<Record<ProfileKey, string>>
  magicSaveModifier?: number
  mountedRider?: {
    active: boolean
    modifiers?: Partial<Record<ProfileKey, number>>
  }
}

export function applyProfileEffects(input: ProfileEffectInput) {
  const profile = { ...input.baseProfile }
  const applicableEquipment = input.selectedEquipment.filter((option) => {
    if (!optionAppliesToProfile(input.unit, option, input.profileName)) return false
    return !isPerModelEquipmentSelection(option) || input.equipmentCount(option) >= input.modelCount
  })

  // Armour replacements establish the model's base Armour Save first. A shield
  // is always an additive +1 save modifier, even when older prototype data gave
  // the shield an absolute Sv profileOverride. Treating shields additively makes
  // the displayed save react correctly in both directions when the checkbox is
  // added or removed.
  let saveModifier = 0
  for (const option of applicableEquipment) {
    const shield = isShieldName(option.sourceName || option.name)
    if (!shield) {
      for (const [key, value] of Object.entries(saveOnlyProfileOverride(option.profileOverride))) profile[key as ProfileKey] = String(value)
    }
    if (shield) saveModifier += Math.max(1, Number(option.saveModifier) || 0)
    else saveModifier += Math.max(0, Number(option.saveModifier) || 0)
  }

  if (input.bigUnsSelected && !isMountProfileName(input.profileName)) profile.S = incrementCharacteristic(profile.S, 1)
  // Magic armour can replace the mundane armour value, but a legal mundane
  // shield still improves that resulting save. Therefore resolve magic save
  // replacements before applying the accumulated shield/save modifier.
  for (const [key, value] of Object.entries(input.magicOverride || {})) if (value !== undefined) profile[key as ProfileKey] = String(value)
  const totalSaveModifier = saveModifier + Math.max(0, Number(input.magicSaveModifier) || 0)
  if (totalSaveModifier > 0) profile.Sv = improveSaveBy(profile.Sv, totalSaveModifier)
  const hide = armouredHideBonus(input.unit, input.activeRules, input.profileName)
  if (hide > 0) profile.Sv = improveSaveBy(profile.Sv, hide)
  const ruleWard = wardSaveFromRules(input.unit, input.activeRules, input.profileName)
  if (ruleWard && (!profile.Ward || profile.Ward === '—')) profile.Ward = ruleWard
  const ruleRegeneration = regenerationSave(input.unit, input.activeRules, input.profileName)
  if (ruleRegeneration !== '—') profile.Rn = ruleRegeneration

  // Optional mounts replace the rider's Movement with the mount's Movement.
  // Keep the mount profile's own characteristics untouched and display rider
  // bonuses as base(modified), e.g. T 4 with +1 Toughness becomes 4(5).
  if (input.mountedRider?.active && !isMountProfileName(input.profileName)) {
    for (const [key, amount] of Object.entries(input.mountedRider.modifiers || {})) {
      if (key === 'M' || !Number.isFinite(Number(amount))) continue
      profile[key as ProfileKey] = formatCharacteristicBonus(profile[key as ProfileKey], Number(amount))
    }
    profile.M = '—'
  }
  return profile
}
