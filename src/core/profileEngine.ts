import type { ProfileKey, PrototypeEquipmentOption, PrototypeUnit } from '../data/builderPrototype'
import { isShieldSemanticName } from './sourceSemantics'
import { improveSaveBy, incrementCharacteristic } from './profileMath'
import { isPerModelEquipmentSelection } from '../domain/loadout'
import { saveOnlyProfileOverride } from '../domain/canonicalProfiles'

export { improveSaveBy, incrementCharacteristic } from './profileMath'

export type ProfileRole = 'unit' | 'champion' | 'special' | 'mount'

function characteristicEffectiveNumber(value: string) { const parenthesized = value.match(/\((-?\d+)\)\s*$/); if (parenthesized) return Number(parenthesized[1]); const numeric = Number.parseInt(value, 10); return Number.isFinite(numeric) ? numeric : null }
export function formatCharacteristicBonus(value: string, amount: number) { const current = characteristicEffectiveNumber(value); if (current === null || !amount) return value; const base = value.replace(/\s*\(-?\d+\)\s*$/, '').trim(); return `${base}(${current + amount})` }
export function normalizedModelName(value: string) { return value.toLowerCase().replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim() }
export function isMountProfileName(name: string) { return /\b(boar|horse|steed|wolf|spider|squig|dragon|wyvern|griffon|griffin|pegasus|eagle|unicorn|manticore|chariot|carpet|throne|palanquin|stag|cold one|demigryph|warhawk)\b/i.test(name) }
function isShieldOption(option: PrototypeEquipmentOption) { return isShieldSemanticName(option.sourceName || option.name) || /\/shield(?:$|[?#/])/i.test(String(option.referencePath || '')) }

const championPattern = /\b(?:champion|boss|captain|sergeant|champ|championess)\b/i
const specialModelPattern = /\b(?:musician|standard bearer|crew|bully|handler|master moulder|team|loader|spotter)\b/i

export function profileRoleForName(unit: PrototypeUnit, profileName: string): ProfileRole {
  const normalized = normalizedModelName(profileName)
  const unitName = normalizedModelName(unit.name)
  // Rider/unit names can legitimately contain mount words (for example Orc
  // Boar Boy / Orc Boar Boss). Model-role cues and a sufficiently specific
  // unit-name match therefore take precedence over the mount-word heuristic.
  if (championPattern.test(profileName) && normalized !== unitName) return 'champion'
  if (specialModelPattern.test(profileName) && normalized !== unitName) return 'special'
  const profileWords = normalized.split(' ').filter(Boolean)
  const unitIdentity = normalized === unitName || (profileWords.length >= 3 && (unitName.includes(normalized) || normalized.includes(unitName)))
  if (unitIdentity) return 'unit'
  if (isMountProfileName(profileName)) return 'mount'
  return 'unit'
}

function optionTargetRole(option: PrototypeEquipmentOption): ProfileRole | 'unit-and-champion' | 'all-riders' | null {
  const text = `${option.sourceName || option.name} ${option.note || ''}`
  if (option.kind === 'mount-option') return 'mount'
  if (/\b(?:champion|boss|captain|sergeant|champ)\s+(?:only|alone)\b|\bonly\s+the\s+(?:champion|boss|captain|sergeant|champ)\b/i.test(text)) return 'champion'
  if (/\b(?:crew|bully|handler|musician|standard bearer)\s+(?:only|alone)\b|\bonly\s+the\s+(?:crew|bully|handler|musician|standard bearer)\b/i.test(text)) return 'special'
  if (/\bBig\s*[’']?Uns?\b/i.test(text)) return 'unit-and-champion'
  if (/\b(?:entire|whole)\s+unit\b|\ball models in (?:this|the) unit\b|\bunit may be upgraded\b|\bupgrade the unit\b|\bmodels? in the unit\b/i.test(text)) return 'unit-and-champion'
  if (/\b(?:rider|character)\b/i.test(text) && !/\bmount\b/i.test(text)) return 'all-riders'
  return null
}

export function optionAppliesToProfile(unit: PrototypeUnit, option: PrototypeEquipmentOption, profileName: string) {
  const role = profileRoleForName(unit, profileName)
  if (option.kind === 'mount-option') return role === 'mount'
  if (role === 'mount') return false
  if (option.requiresSelection) {
    const owner = unit.equipmentOptions.find((candidate) => candidate.id === option.requiresSelection)
    if (owner?.addsProfile) {
      const profileKey = normalizedModelName(profileName)
      const ownerKey = normalizedModelName(owner.addsProfile)
      return Boolean(ownerKey && (profileKey.includes(ownerKey) || ownerKey.includes(profileKey)))
    }
  }
  const target = optionTargetRole(option)
  if (target === 'champion' || target === 'special') return role === target
  if (target === 'unit-and-champion') return role === 'unit' || role === 'champion'
  if (target === 'all-riders') return true
  return true
}

function ruleAppliesToProfile(unit: PrototypeUnit, rule: PrototypeUnit['specialRules'][number], profileName: string) { if (!rule.requiresSelection) return true; const source = unit.equipmentOptions.find((option) => option.id === rule.requiresSelection); return !source || optionAppliesToProfile(unit, source, profileName) }
function armouredHideBonus(unit: PrototypeUnit, rules: PrototypeUnit['specialRules'], profileName: string) { return rules.reduce((best, rule) => { if (!ruleAppliesToProfile(unit, rule, profileName)) return best; const match = rule.name.match(/Armou?red Hide\s*\((\d+)\)/i); return match ? Math.max(best, Number(match[1]) || 0) : best }, 0) }
function regenerationSave(unit: PrototypeUnit, rules: PrototypeUnit['specialRules'], profileName: string) { const values = rules.flatMap((rule) => { if (!ruleAppliesToProfile(unit, rule, profileName)) return []; const match = rule.name.match(/Regeneration\s*\((\d+)\+\)/i); return match ? [Number(match[1])] : [] }).filter((value) => Number.isFinite(value) && value > 0); return values.length ? `${Math.min(...values)}+` : '—' }
function wardSaveFromRules(unit: PrototypeUnit, rules: PrototypeUnit['specialRules'], profileName: string) { const values = rules.flatMap((rule) => { if (!ruleAppliesToProfile(unit, rule, profileName)) return []; const source = `${rule.name} ${rule.summary || ''}`; const match = source.match(/(?:Ward\s+save(?:\s+of)?\s*\(?\s*(\d+)\+\s*\)?|(\d+)\+\s+Ward\s+save)/i); return match ? [Number(match[1] || match[2])] : [] }).filter((value) => Number.isFinite(value) && value > 0); return values.length ? `${Math.min(...values)}+` : '' }

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
  mountedRider?: { active: boolean; modifiers?: Partial<Record<ProfileKey, number>> }
}

export function applyProfileEffects(input: ProfileEffectInput) {
  const profile = { ...input.baseProfile }
  const role = profileRoleForName(input.unit, input.profileName)
  const applicableEquipment = input.selectedEquipment.filter((option) => optionAppliesToProfile(input.unit, option, input.profileName) && (!isPerModelEquipmentSelection(option) || input.equipmentCount(option) >= input.modelCount))
  let saveModifier = 0
  for (const option of applicableEquipment) {
    const shield = isShieldOption(option)
    if (!shield) for (const [key, value] of Object.entries(saveOnlyProfileOverride(option.profileOverride))) profile[key as ProfileKey] = String(value)
    if (shield) saveModifier += Math.max(1, Number(option.saveModifier) || 0)
    else saveModifier += Math.max(0, Number(option.saveModifier) || 0)
  }
  if (input.bigUnsSelected && (role === 'unit' || role === 'champion')) profile.S = incrementCharacteristic(profile.S, 1)
  for (const [key, value] of Object.entries(input.magicOverride || {})) if (value !== undefined) profile[key as ProfileKey] = String(value)
  const totalSaveModifier = saveModifier + Math.max(0, Number(input.magicSaveModifier) || 0)
  if (totalSaveModifier > 0) profile.Sv = improveSaveBy(profile.Sv, totalSaveModifier)
  const hide = armouredHideBonus(input.unit, input.activeRules, input.profileName); if (hide > 0) profile.Sv = improveSaveBy(profile.Sv, hide)
  const ruleWard = wardSaveFromRules(input.unit, input.activeRules, input.profileName); if (ruleWard && (!profile.Ward || profile.Ward === '—')) profile.Ward = ruleWard
  const ruleRegeneration = regenerationSave(input.unit, input.activeRules, input.profileName); if (ruleRegeneration !== '—') profile.Rn = ruleRegeneration
  if (input.mountedRider?.active && role !== 'mount') {
    for (const [key, amount] of Object.entries(input.mountedRider.modifiers || {})) { if (key === 'M' || !Number.isFinite(Number(amount))) continue; profile[key as ProfileKey] = formatCharacteristicBonus(profile[key as ProfileKey], Number(amount)) }
    profile.M = '—'
  }
  return profile
}
