<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import RuleAbilityCard from '../components/RuleAbilityCard.vue'
import CharacteristicIcon from '../components/CharacteristicIcon.vue'
import { getArmy } from '../data/armies'
import { prototypeUnitsForArmy, type ProfileKey, type PrototypeEquipmentOption, type PrototypeUnit, type PrototypeWeapon, type RuleTone } from '../data/builderPrototype'
import { loadLiveUnitProfileProgressively } from '../data/liveBuilderUnits'
import { loadArmyData } from '../services/armyData'
import { fetchRuleDocument } from '../services/ruleContent'
import { extractMechanicalRuleText } from '../services/ruleText'
import { findBuilderRosterSelection, loadBuilderRoster, updateBuilderRosterSelection, type BuilderRosterMagicItem } from '../services/builderRoster'
import { isFavoriteUnit, setFavoriteUnit } from '../services/favorites'
import { getSavedArmyList } from '../services/savedLists'
import {
  isPerModelEquipmentSelection,
  isPerModelWeaponSelection,
  normalizeEquipmentCounts as normalizeDomainEquipmentCounts,
  normalizeWeaponAllocation,
  unitSelectionPointBreakdown,
  weaponAllocationGroup,
  weaponIsEquipped as domainWeaponIsEquipped,
  weaponIsOptionalChoice as domainWeaponIsOptionalChoice,
} from '../domain/loadout'
import { applyMagicalMaelstromSelections, magicalMaelstromWizardLevel, wizardLevelFromName, wizardLevelGroupId } from '../domain/wizard'
import { magicItemPointLimit as resolveMagicItemPointLimit } from '../domain/magicItems'
import { equipmentRequirementsMet, normalizeUnitSelections, selectExclusiveEquipment, selectExclusiveWeapon } from '../domain/selection'
import { applyProfileEffects, incrementCharacteristic, isMountProfileName, normalizedModelName } from '../domain/profileEffects'
import { ruleDisplayName } from '../domain/rulePresentation'
import { reportAppError } from '../services/appErrors'

const route = useRoute()
const army = computed(() => getArmy(String(route.params.armySlug)))
const unitId = computed(() => String(route.params.unitSlug || ''))
const liveUnit = ref<PrototypeUnit | null>(null)
const liveLoading = ref(false)
const liveReferenceLoading = ref(false)
const liveError = ref('')
const favourite = ref(false)
const modelCount = ref(1)
const weaponCounts = ref(new Map<string, number>())
const equipmentCounts = ref(new Map<string, number>())

const backPath = computed(() => {
  const candidate = String(route.query.return || '')
  return candidate.startsWith('/lists/builder') ? candidate : (army.value ? `/army/${army.value.slug}` : '/lists')
})
const compositionId = computed(() => {
  const direct = String(route.query.composition || '')
  if (direct) return direct
  const candidate = String(route.query.return || '')
  try { return new URL(candidate, window.location.origin).searchParams.get('composition') || army.value?.compositions[0]?.id || '' } catch { return army.value?.compositions[0]?.id || '' }
})
const compositionRuleId = computed(() => {
  const direct = String(route.query.rule || route.query.compositionRule || '')
  if (direct) return direct
  const candidate = String(route.query.return || '')
  try { return new URL(candidate, window.location.origin).searchParams.get('rule') || '' } catch { return '' }
})
const compositionOptionIds = computed(() => {
  const ids = new Set(String(route.query.options || '').split(',').map((value) => value.trim()).filter(Boolean))
  const candidate = String(route.query.return || '')
  try { new URL(candidate, window.location.origin).searchParams.get('options')?.split(',').map((value) => value.trim()).filter(Boolean).forEach((value) => ids.add(value)) } catch { /* direct route options remain available */ }
  return ids
})
const battleMarchMagicEnabled = computed(() => compositionRuleId.value === 'battle-march' || compositionOptionIds.value.has('battle-march-magical-items'))
const magicItemPointLimit = computed(() => resolveMagicItemPointLimit(compositionOptionIds.value))
const magicalMaelstromEnabled = computed(() => compositionOptionIds.value.has('magical-maelstrom'))
const instanceId = computed(() => String(route.query.instance || ''))
const pageMode = computed(() => String(route.query.mode || 'view'))
const builderListId = computed(() => {
  if (!backPath.value.startsWith('/lists/builder')) return ''
  try { return new URL(backPath.value, window.location.origin).searchParams.get('list') || '' } catch { return '' }
})
const builderListLocked = computed(() => { const list = getSavedArmyList(builderListId.value); return Boolean(list?.locked || list?.enemyRoster) })
const isEditing = computed(() => pageMode.value === 'edit' && Boolean(instanceId.value) && backPath.value.startsWith('/lists/builder') && !builderListLocked.value)
const isReadOnly = computed(() => !isEditing.value)
const hydratedFromRoster = ref(false)
const prototypeUnit = computed(() => liveUnit.value || prototypeUnitsForArmy(army.value?.slug || '').find((unit) => unit.id === unitId.value) || null)
const prettyUnitName = computed(() => prototypeUnit.value?.name || unitId.value.split('-').filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '))
const statOrder: ProfileKey[] = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld', 'Sv', 'Ward', 'Rn']
const showBuilderCharacteristicIcons = computed(() => backPath.value.startsWith('/lists/builder'))
function statsForProfile(profile: Record<ProfileKey, string>) {
  return statOrder.filter((stat) => {
    if (stat === 'Ward') return Boolean(profile.Ward && profile.Ward !== '—')
    if (stat === 'Rn') return Boolean(profile.Rn && profile.Rn !== '—')
    return true
  })
}
function statLabel(stat: ProfileKey) { return stat === 'Ward' ? 'Wd' : stat }

let liveLoadToken = 0
async function loadLiveUnit() {
  if (!army.value) return
  const token = ++liveLoadToken
  liveLoading.value = true
  liveReferenceLoading.value = false
  liveError.value = ''
  liveUnit.value = null
  try {
    const result = await loadLiveUnitProfileProgressively(army.value.dataKey, army.value.name, unitId.value, compositionId.value, {
      onBase: (unit) => {
        if (token !== liveLoadToken) return
        liveUnit.value = unit
        liveLoading.value = false
        liveReferenceLoading.value = true
      },
      onEnriched: (unit) => {
        if (token !== liveLoadToken) return
        liveUnit.value = unit
        liveReferenceLoading.value = false
      },
    })
    if (token !== liveLoadToken) return
    if (!result && !liveUnit.value) {
      liveError.value = 'This unit is not available in the current army data.'
      liveReferenceLoading.value = false
    }
  } catch (error) {
    if (token !== liveLoadToken) return
    reportAppError(error, 'UNIT_PROFILE_LOAD', { unitId: unitId.value, army: army.value?.slug })
    liveError.value = error instanceof Error ? error.message : 'The live unit profile could not be loaded.'
    liveReferenceLoading.value = false
  } finally {
    if (token === liveLoadToken) liveLoading.value = false
  }
}
watch(() => [army.value?.slug, unitId.value, compositionId.value], () => {
  favourite.value = army.value ? isFavoriteUnit(army.value.slug, unitId.value) : false
  void loadLiveUnit()
}, { immediate: true })

const selectedWeaponIds = ref(new Set<string>())
const selectedEquipmentIds = ref(new Set<string>())

type MagicItem = { id: string; baseId: string; ownerId: string; ownerLabel: string; poolMaxPoints: number; name: string; points: number; type: 'weapon' | 'armor' | 'talisman' | 'enchanted-item' | 'arcane-item' | 'banner'; source: string; stackable: boolean; maximum?: number; onePerArmy: boolean; slug: string; fluff?: string }
type MagicItemDetail = { kind?: 'melee' | 'missile'; range?: string; strength?: string; ap?: string; rules?: string[]; summary?: string; fluff?: string; profileOverride?: Partial<Record<ProfileKey, string>>; shield?: boolean }

const magicItems = ref<MagicItem[]>([])
const magicLoading = ref(false)
const magicError = ref('')
const selectedMagicCounts = ref(new Map<string, number>())
const magicItemDetails = ref(new Map<string, MagicItemDetail>())
const selectedMagicPoolId = ref('')
const selectedLores = ref(new Set<string>())
const magicPickerOpen = ref(false)
const magicPickerTab = ref<MagicItem['type'] | ''>('')
const magicPickerCounts = ref(new Map<string, number>())
const magicPickerExpanded = ref(new Set<string>())

function selectionHas(id: string) { return selectedEquipmentIds.value.has(id) || selectedWeaponIds.value.has(id) }
function isWizardParentOption(option: PrototypeEquipmentOption) { return /^Wizard$/i.test(String(option.name || '').trim()) }
function isWizardLevelOption(option: PrototypeEquipmentOption) { return wizardLevelFromName(option.name) > 0 }
function isLoreEquipmentOption(option: PrototypeEquipmentOption) { return /^(?:The\s+)?Lore\s+of\b/i.test(String(option.name || '').trim()) }
function isWizardMagicEquipmentOption(option: PrototypeEquipmentOption) { return isLoreEquipmentOption(option) || /\b(?:spell|prayer|wizard)\b/i.test(String(option.name || '').trim()) }
function formatHandWeaponCountLabel(value: string) {
  const text = String(value || '').trim()
  const match = text.match(/^Hand weapons?\s*(?:[×x]\s*)?\(?\s*(\d+)\s*\)?$/i)
  return match ? `${Number(match[1])} – (Hand Weapon)` : text
}
function displayOptionName(option: PrototypeEquipmentOption) {
  const level = wizardLevelFromName(option.name)
  return level ? `Wizard Level ${level}` : formatHandWeaponCountLabel(option.name)
}

function rosterRowHasGeneral(row: { options?: string[] }) {
  return (row.options || []).some((value) => /^General$/i.test(String(value).replace(/\s*[×x]\d+\s*$/, '').trim()))
}
const otherGeneralName = computed(() => {
  if (!backPath.value.startsWith('/lists/builder')) return ''
  const row = loadBuilderRoster(backPath.value).find((candidate) => candidate.instanceId !== instanceId.value && rosterRowHasGeneral(candidate))
  return row?.name || ''
})
function contextualOptionName(option: PrototypeEquipmentOption) {
  const label = displayOptionName(option)
  if (!/^General$/i.test(option.name.trim()) || selectedEquipmentIds.value.has(option.id) || !otherGeneralName.value) return label
  return `${label} - ${otherGeneralName.value}`
}
function showOtherGeneralCurrent(option: PrototypeEquipmentOption) {
  return /^General$/i.test(option.name.trim()) && !selectedEquipmentIds.value.has(option.id) && Boolean(otherGeneralName.value)
}

const wizardLevelOptions = computed(() => (prototypeUnit.value?.equipmentOptions || []).filter(isWizardLevelOption).sort((a, b) => wizardLevelFromName(a.name) - wizardLevelFromName(b.name)))
const startingWizardLevel = computed(() => {
  const configured = Math.max(0, Number(prototypeUnit.value?.baseWizardLevel || 0))
  if (configured && wizardLevelOptions.value.some((option) => wizardLevelFromName(option.name) === configured)) return configured
  const included = wizardLevelOptions.value.find((option) => option.default || option.locked)
  return included ? wizardLevelFromName(included.name) : 0
})
function wizardLevelGroup(option: PrototypeEquipmentOption) { return wizardLevelGroupId(option) }

function isStartingWizardLevelOption(option: PrototypeEquipmentOption) {
  return isWizardLevelOption(option) && Boolean(option.default && option.locked)
}
function equipmentOptionEffectivelyLocked(option: PrototypeEquipmentOption) {
  if (isWizardLevelOption(option)) {
    const group = wizardLevelGroup(option)
    const selectedOtherLevel = wizardLevelOptions.value.some((candidate) => candidate.id !== option.id && wizardLevelGroup(candidate) === group && selectedEquipmentIds.value.has(candidate.id))
    return isStartingWizardLevelOption(option) && selectedEquipmentIds.value.has(option.id) && !selectedOtherLevel
  }
  return Boolean(option.default && option.locked && selectedEquipmentIds.value.has(option.id))
}
function weaponEffectivelyLocked(weapon: PrototypeWeapon) { return Boolean(weapon.default && weapon.locked && selectedWeaponIds.value.has(weapon.id)) }
async function resetSelections() {
  const unit = prototypeUnit.value
  if (!unit) return
  hydratedFromRoster.value = false
  const saved = instanceId.value && backPath.value.startsWith('/lists/builder') ? findBuilderRosterSelection(backPath.value, instanceId.value) : null
  const minimum = Math.max(1, Number(unit.minimumModels || 1))
  const maximum = Number(unit.maximumModels || 0) > 0 ? Number(unit.maximumModels) : Number.POSITIVE_INFINITY
  modelCount.value = Math.min(maximum, Math.max(minimum, Number(saved?.modelCount || minimum)))
  weaponCounts.value = new Map(Object.entries(saved?.weaponCounts || {}).map(([id, count]) => [id, Math.max(0, Number(count) || 0)]))
  equipmentCounts.value = new Map(Object.entries(saved?.equipmentCounts || {}).map(([id, count]) => [id, Math.max(0, Number(count) || 0)]))
  const defaultWeapons = unit.weapons.filter((weapon) => weapon.default).map((weapon) => weapon.id)
  const defaultEquipment = unit.equipmentOptions.filter((option) => option.default).map((option) => option.id)
  const knownWeaponIds = new Set(unit.weapons.map((weapon) => weapon.id))
  const savedWeaponIds = (saved?.weaponIds || []).filter((id) => knownWeaponIds.has(id))
  // Saved selections are authoritative. Do not blindly union locked defaults
  // into a saved exclusive group (that was re-selecting the starting Wizard
  // level beside a purchased higher level). normalizeSelections() restores any
  // included default that is not legitimately displaced by a saved alternative.
  selectedWeaponIds.value = new Set(saved?.weaponIds?.length ? savedWeaponIds : unit.weapons.filter((weapon) => defaultWeapons.includes(weapon.id) || saved?.options?.includes(weapon.name)).map((weapon) => weapon.id))
  const knownEquipmentIds = new Set(unit.equipmentOptions.map((option) => option.id))
  const savedEquipmentIds = (saved?.equipmentIds || []).filter((id) => knownEquipmentIds.has(id))
  selectedEquipmentIds.value = new Set(saved?.equipmentIds?.length ? savedEquipmentIds : unit.equipmentOptions.filter((option) => defaultEquipment.includes(option.id) || saved?.options?.includes(option.name)).map((option) => option.id))
  if (!saved?.equipmentCounts) unit.equipmentOptions.filter((option) => isPerModelEquipmentSelection(option) && selectedEquipmentIds.value.has(option.id)).forEach((option) => equipmentCounts.value.set(option.id, modelCount.value))
  normalizeEquipmentCounts()
  if (!saved?.weaponCounts) {
    const groups = new Map<string, PrototypeWeapon[]>()
    unit.weapons.filter((weapon) => isPerModelWeaponSelection(weapon) && selectedWeaponIds.value.has(weapon.id)).forEach((weapon) => {
      const group = weaponAllocationGroup(weapon)
      const rows = groups.get(group) || []
      rows.push(weapon)
      groups.set(group, rows)
    })
    groups.forEach((rows) => { if (rows.length === 1) weaponCounts.value.set(rows[0].id, modelCount.value) })
  }
  selectedMagicCounts.value = new Map()
  magicItemDetails.value = new Map()
  selectedMagicPoolId.value = ''
  selectedLores.value = new Set((saved?.loreSelections || []).filter((lore) => (unit.lores || []).includes(lore)))
  magicPickerOpen.value = false
  magicPickerCounts.value = new Map()
  magicPickerExpanded.value = new Set()
  await loadMagicItemChoices()
  if (saved?.magicItems?.length) {
    const merged = new Map(magicItems.value.map((item) => [item.id, item]))
    for (const entry of saved.magicItems) {
      const ownerId = entry.ownerId || 'unit'
      const match = magicItems.value.find((item) => item.ownerId === ownerId && (item.baseId === (entry.baseId || entry.id) || (item.name === entry.name && item.type === entry.type && item.source === entry.source)))
      const item: MagicItem = match || { ...entry, baseId: entry.baseId || entry.id, ownerId, ownerLabel: entry.ownerLabel || prettyUnitName.value, poolMaxPoints: entry.poolMaxPoints || prototypeUnit.value?.magicAllowance?.maxPoints || entry.points, id: `${ownerId}::${entry.baseId || entry.id}` }
      merged.set(item.id, item)
      selectedMagicCounts.value.set(item.id, Math.max(1, Number(entry.count) || 1))
      await loadMagicItemDetail(item)
    }
    magicItems.value = [...merged.values()]
  }
  normalizeSelections()
  normalizeWeaponCounts()
  applyMagicSupersession()
  hydratedFromRoster.value = true
}
watch(() => [prototypeUnit.value?.id, instanceId.value, pageMode.value], () => { void resetSelections() })

const selectedWeapons = computed(() => prototypeUnit.value?.weapons.filter((weapon) => selectedWeaponIds.value.has(weapon.id)) || [])
const selectedEquipment = computed(() => prototypeUnit.value?.equipmentOptions.filter((option) => selectedEquipmentIds.value.has(option.id)) || [])
type MagicPool = { id: string; label: string; maxPoints: number; types: MagicItem['type'][] }
const wizardLevel = computed(() => {
  const unit = prototypeUnit.value
  const levels = selectedEquipment.value.map((option) => wizardLevelFromName(option.name)).filter((level) => level > 0)
  const normal = levels.length ? Math.max(...levels) : selectedEquipment.value.some(isWizardParentOption) ? Math.max(1, Number(unit?.baseWizardLevel || 0)) : Math.max(0, Number(unit?.baseWizardLevel || 0))
  if (!magicalMaelstromEnabled.value || normal <= 0 || !unit) return normal
  return magicalMaelstromWizardLevel(unit.equipmentOptions, normal)
})
const isWizard = computed(() => wizardLevel.value > 0)
function legalMagicTypes(types: MagicItem['type'][], owner?: PrototypeEquipmentOption) {
  let allowed = [...new Set(types)]
  const label = String(owner?.name || '')
  if (/standard bearer|battle standard bearer|\bbsb\b/i.test(label)) return allowed.filter((type) => type === 'banner')
  if (/champion|boss|champ/i.test(label)) {
    allowed = allowed.filter((type) => type !== 'banner')
    if (!/wizard/i.test(label)) allowed = allowed.filter((type) => type !== 'arcane-item')
    return allowed
  }
  if (!isWizard.value) allowed = allowed.filter((type) => type !== 'arcane-item')
  return allowed
}
const activeMagicPools = computed<MagicPool[]>(() => {
  const unit = prototypeUnit.value
  if (!unit) return []
  const pools: MagicPool[] = []
  if (unit.magicAllowance) {
    const zeroPointGrants = selectedEquipment.value.filter((option) => option.magicAllowance && option.magicAllowance.maxPoints === 0)
    const extraTypes = zeroPointGrants.flatMap((option) => option.magicAllowance?.types || [])
    let types = legalMagicTypes([...unit.magicAllowance.types, ...extraTypes])
    const bannerGranted = zeroPointGrants.some((option) => option.magicAllowance?.types.includes('banner'))
    if (!bannerGranted) types = types.filter((type) => type !== 'banner')
    if (unit.magicAllowance.maxPoints > 0 && types.length) pools.push({ id: 'unit', label: unit.name, maxPoints: unit.magicAllowance.maxPoints, types })
  }
  selectedEquipment.value.forEach((option) => {
    const allowance = option.magicAllowance
    if (!allowance || allowance.maxPoints <= 0) return
    const types = legalMagicTypes([...allowance.types], option)
    if (!types.length) return
    pools.push({ id: option.id, label: displayOptionName(option).replace(/\s*\(champion\)\s*/i, '').trim(), maxPoints: allowance.maxPoints, types })
  })
  return pools
})
const selectedMagicPool = computed(() => activeMagicPools.value.find((pool) => pool.id === selectedMagicPoolId.value) || activeMagicPools.value[0] || null)
function selectMagicPool(id: string) {
  if (!activeMagicPools.value.some((pool) => pool.id === id)) return
  selectedMagicPoolId.value = id
}
const selectedMagicEntries = computed(() => {
  const rows: Array<{ item: MagicItem; count: number }> = []
  for (const [id, count] of selectedMagicCounts.value.entries()) {
    const item = magicItems.value.find((candidate) => candidate.id === id)
    if (item && count > 0) rows.push({ item, count })
  }
  return rows
})
function magicPoolPoints(ownerId: string) { return selectedMagicEntries.value.filter(({ item }) => item.ownerId === ownerId).reduce((sum, entry) => sum + entry.item.points * entry.count, 0) }
const magicPoints = computed(() => selectedMagicEntries.value.reduce((sum, entry) => sum + entry.item.points * entry.count, 0))
const pointBreakdown = computed(() => prototypeUnit.value ? unitSelectionPointBreakdown({
  unit: prototypeUnit.value,
  modelCount: modelCount.value,
  selectedWeapons: selectedWeapons.value,
  selectedEquipment: selectedEquipment.value,
  weaponCounts: weaponCounts.value,
  equipmentCounts: equipmentCounts.value,
  magicPoints: magicPoints.value,
  magicalMaelstrom: magicalMaelstromEnabled.value,
}) : { basePoints: 0, weaponPoints: 0, equipmentPoints: 0, magicPoints: 0, optionPoints: 0, totalPoints: 0 })
const baseUnitPoints = computed(() => pointBreakdown.value.basePoints)
const optionPoints = computed(() => pointBreakdown.value.optionPoints)
const totalPoints = computed(() => pointBreakdown.value.totalPoints)
const selectedMagicWeapons = computed(() => selectedMagicEntries.value.filter(({ item }) => item.type === 'weapon'))

function magicWeaponDisplay(entry: { item: MagicItem; count: number }) {
  const detail = magicItemDetails.value.get(entry.item.id) || {}
  const ownerPrefix = entry.item.ownerId === 'unit' ? '' : `${entry.item.ownerLabel} — `
  const rules = [...new Set(['Magic Weapon', ...(detail.rules || [])].filter(Boolean))]
  return { id: `magic-${entry.item.id}`, name: ownerPrefix + (entry.count > 1 ? `${entry.item.name} ×${entry.count}` : entry.item.name), kind: detail.kind || 'melee', range: detail.range || (detail.kind === 'missile' ? 'See rule' : 'Combat'), strength: detail.strength || 'See rule', ap: detail.ap || 'See rule', rules, points: entry.item.points * entry.count, default: true, locked: true, path: `/magic-item/${entry.item.slug}`, hasUniqueRule: true } satisfies PrototypeWeapon
}
function weaponOwnerAvailable(weapon: PrototypeWeapon) { return !weapon.requiresSelection || selectionHas(weapon.requiresSelection) }
function weaponIsEquipped(weapon: PrototypeWeapon) { return prototypeUnit.value ? domainWeaponIsEquipped(prototypeUnit.value, weapon, selectedWeaponIds.value, weaponCounts.value) : false }
function weaponIsOptionalChoice(weapon: PrototypeWeapon) { return prototypeUnit.value ? domainWeaponIsOptionalChoice(prototypeUnit.value, weapon) : false }
const baseMeleeWeapons = computed(() => prototypeUnit.value?.weapons.filter((weapon) => weapon.kind === 'melee' && weaponOwnerAvailable(weapon) && weaponIsEquipped(weapon)) || [])
const baseRangedWeapons = computed(() => prototypeUnit.value?.weapons.filter((weapon) => weapon.kind === 'missile' && weaponOwnerAvailable(weapon) && weaponIsEquipped(weapon)) || [])
type WeaponRow = { source: 'base' | 'magic'; weapon: PrototypeWeapon }
function weaponDisplayKey(weapon: PrototypeWeapon) { return weapon.name.toLowerCase().replace(/\bweapons\b/g, 'weapon').replace(/\s+/g, ' ').trim() }
function dedupeWeaponRows(rows: WeaponRow[]) {
  const map = new Map<string, WeaponRow>()
  rows.forEach((row) => {
    const key = `${row.weapon.kind}:${weaponDisplayKey(row.weapon)}`
    const existing = map.get(key)
    if (!existing || (row.source === 'magic' && existing.source !== 'magic') || (row.source === 'base' && selectedWeaponIds.value.has(row.weapon.id) && !selectedWeaponIds.value.has(existing.weapon.id))) map.set(key, row)
  })
  return [...map.values()]
}
const meleeWeapons = computed(() => dedupeWeaponRows([...selectedMagicWeapons.value.map((entry) => ({ source: 'magic' as const, weapon: magicWeaponDisplay(entry) })).filter((row) => row.weapon.kind === 'melee'), ...baseMeleeWeapons.value.map((weapon) => ({ source: 'base' as const, weapon }))]))
const rangedWeapons = computed(() => dedupeWeaponRows([...selectedMagicWeapons.value.map((entry) => ({ source: 'magic' as const, weapon: magicWeaponDisplay(entry) })).filter((row) => row.weapon.kind === 'missile'), ...baseRangedWeapons.value.map((weapon) => ({ source: 'base' as const, weapon }))]))
function specialRulePath(name: string) {
  const clean = String(name || '').replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase().replace(/[’']/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return clean ? `/special-rules/${clean}` : '/special-rules'
}
function weaponRuleLabels(weapon: PrototypeWeapon) {
  // Prefer the authoritative link supplied by the weapon/profile source. This
  // avoids rendering a second generic special-rules link for the same label.
  const linkedLabels = new Set((weapon.ruleLinks || []).map((row) => row.label.trim().toLowerCase()))
  const rows = [
    ...(weapon.rules || []).filter(Boolean).filter((label) => !linkedLabels.has(label.trim().toLowerCase())).map((label) => ({ label, path: specialRulePath(label) })),
    ...(weapon.ruleLinks || []),
  ]
  // A weapon-specific rule should identify the weapon itself rather than use a
  // generic "Weapon Rule" placeholder. Universal special rules remain listed
  // individually above, while this pill opens the weapon/magic-item rule page.
  if (weapon.hasUniqueRule && weapon.path) rows.push({ label: weapon.name.replace(/^.*? — /, '').replace(/\s+×\d+$/, ''), path: weapon.path })
  const seen = new Set<string>()
  return rows.filter((row) => { const key = `${row.label.toLowerCase()}:${row.path}`; if (seen.has(key)) return false; seen.add(key); return true })
}


function armourBaneValue(label: string) {
  const match = String(label || '').match(/Armou?r Bane\s*\(\s*(\d+)\s*\)/i)
  return match ? Math.max(0, Number(match[1]) || 0) : 0
}
function weaponBaseApMagnitude(weapon: PrototypeWeapon) {
  const raw = String(weapon.ap || '').trim()
  const match = raw.match(/-?\s*(\d+)/)
  return match ? Math.max(0, Number(match[1]) || 0) : 0
}
function externalWeaponApBonus(row: WeaponRow) {
  const weapon = row.weapon
  let bonus = activeSpecialRules.value.reduce((sum, rule) => sum + armourBaneValue(rule.name), 0)
  if (row.source === 'base' && weapon.kind === 'melee' && activeSpecialRules.value.some((rule) => /^Choppas(?:\s|$)/i.test(rule.name))) bonus += 1
  if (row.source === 'base' && /^Hand weapons?$/i.test(weapon.name.trim()) && activeSpecialRules.value.some((rule) => /^Ensorcelled Weapons?(?:\s|$)/i.test(rule.name))) bonus = Math.max(bonus, 1)
  return bonus
}
function weaponApDisplay(row: WeaponRow) {
  const bonus = externalWeaponApBonus(row)
  const base = weaponBaseApMagnitude(row.weapon)
  if (bonus <= 0) {
    const raw = String(row.weapon.ap || '').trim()
    if (/^\d+$/.test(raw)) return `-${raw}`
    return raw || '—'
  }
  if (base <= 0) return `-${bonus}*`
  return `-${base}(+${bonus})`
}

function mundaneWeaponSuperseded(_weapon: PrototypeWeapon) { return false }
function mundaneEquipmentSuperseded(_option: PrototypeEquipmentOption) { return false }
function applyMagicSupersession() { normalizeSelections() }

const selectedMountOption = computed(() => selectedEquipment.value.find((option) => option.kind === 'mount' && !/^On foot$/i.test(option.name)))
const isMounted = computed(() => {
  const troopType = prototypeUnit.value?.details.troopType || ''
  return Boolean(selectedMountOption.value) || /cavalry|chariot/i.test(troopType)
})
function weaponUnavailable(weapon: PrototypeWeapon) { return Boolean(weapon.requiresMounted && !isMounted.value) }

const availableEquipmentOptions = computed(() => {
  const unit = prototypeUnit.value
  const all = unit?.equipmentOptions || []
  const state = { equipmentIds: selectedEquipmentIds.value, weaponIds: selectedWeaponIds.value }
  return all.filter((option) => {
    if (!String(option.name || '').trim() || !/[A-Za-z0-9]/.test(String(option.name || ''))) return false
    if (isWizardParentOption(option)) return false
    if (option.default && Number(option.points || 0) === 0 && ['armour', 'equipment', 'mount'].includes(option.kind || '')) {
      const hasAlternative = all.some((candidate) => candidate.id !== option.id && candidate.kind === option.kind && !candidate.default && !candidate.locked)
      if (!hasAlternative) return false
    }
    return equipmentRequirementsMet(option, state, isMounted.value)
  })
})
const optionalWeaponOptions = computed(() => (prototypeUnit.value?.weapons || []).filter((weapon) => weaponOwnerAvailable(weapon) && weaponIsOptionalChoice(weapon)))
const equipmentGroups = computed(() => {
  const options = availableEquipmentOptions.value
  return [
    { key: 'equipment', title: 'Armour & Equipment', options: options.filter((option) => ['equipment', 'armour'].includes(option.kind || 'equipment')) },
    { key: 'role', title: 'Command & Role', options: options.filter((option) => option.kind === 'role') },
    { key: 'mount', title: 'Mount', options: options.filter((option) => option.kind === 'mount') },
    { key: 'mount-option', title: 'Mount Options', options: options.filter((option) => option.kind === 'mount-option') },
    { key: 'special', title: 'Special Rules & Upgrades', options: options.filter((option) => option.kind === 'special' && !isWizardLevelOption(option) && !isWizardMagicEquipmentOption(option)) },
  ].filter((group) => group.options.length)
})
const loreEquipmentOptions = computed(() => availableEquipmentOptions.value.filter(isLoreEquipmentOption))
const wizardMagicEquipmentOptions = computed(() => availableEquipmentOptions.value.filter((option) => isWizardMagicEquipmentOption(option) && !isLoreEquipmentOption(option) && !isWizardLevelOption(option)))
const loreChoices = computed(() => [...new Set((prototypeUnit.value?.lores || []).map((lore) => String(lore).trim()).filter(Boolean))].filter((lore) => !loreEquipmentOptions.value.some((option) => formatLoreName(option.name) === formatLoreName(lore))))
const isPrayerCaster = computed(() => {
  const unit = prototypeUnit.value
  if (!unit) return false
  const source = [unit.name, ...unit.specialRules.map((rule) => rule.name), ...loreChoices.value].join(' ')
  return /\b(?:priest|prayer|prayers|blessing|blessings)\b/i.test(source)
})
const showWizardLoreGroup = computed(() => wizardLevelOptions.value.length > 0 || loreEquipmentOptions.value.length > 0 || wizardMagicEquipmentOptions.value.length > 0 || loreChoices.value.length > 0)
const loreSelectionEnabled = computed(() => isWizard.value || isPrayerCaster.value)
function toggleLore(lore: string, selected: boolean) {
  if (isReadOnly.value || !loreSelectionEnabled.value) return
  const next = new Set(selectedLores.value)
  if (selected) next.add(lore); else next.delete(lore)
  selectedLores.value = next
}
function handleLoreCheckbox(lore: string, event: Event) {
  toggleLore(lore, Boolean((event.target as HTMLInputElement | null)?.checked))
}
function formatLoreName(value: string) {
  const words = String(value || '').trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').split(' ').filter(Boolean)
  return words.map((word, index) => {
    const lower = word.toLowerCase()
    if (index > 0 && ['of', 'the', 'and'].includes(lower)) return lower
    return lower ? lower.charAt(0).toUpperCase() + lower.slice(1) : ''
  }).join(' ')
}
function loreRulePath(_lore: string) { return '/the-lores-of-magic' }
const activeLoreNames = computed(() => [...new Set([...selectedLores.value, ...selectedEquipment.value.filter(isLoreEquipmentOption).map((option) => option.name)])])
const selectedLoreRules = computed<PrototypeUnit['specialRules']>(() => activeLoreNames.value.map((lore) => {
  const displayLore = formatLoreName(lore)
  const prayer = /prayer/i.test(lore) || isPrayerCaster.value && !isWizard.value
  return {
    name: displayLore,
    path: loreRulePath(lore),
    timing: prayer ? 'Prayer Lore' : 'Winds of Magic',
    tone: 'magic' as RuleTone,
    summary: prayer ? `Selected prayer lore for ${prettyUnitName.value}.` : `Selected spell lore for ${prettyUnitName.value}.`,
    keywords: [{ label: prayer ? `Prayer Lore: ${displayLore}` : `Spell Lore: ${displayLore}`, path: '/the-lores-of-magic' }],
  }
}))
watch([isWizard, isPrayerCaster], ([wizard, priest]) => {
  if (!wizard && !priest && selectedLores.value.size) selectedLores.value = new Set()
})

const bigUnsSelected = computed(() => selectedEquipment.value.some((option) => /^Big [’']Uns$/i.test(option.name)))
function magicProfileOverridesFor(profileName: string) {
  const override: Partial<Record<ProfileKey, string>> = {}
  const profileKey = normalizedModelName(profileName)
  const mountProfile = isMountProfileName(profileName)
  selectedMagicEntries.value.forEach(({ item }) => {
    const detail = magicItemDetails.value.get(item.id)
    if (!detail?.profileOverride) return
    if (item.ownerId === 'unit') {
      if (!mountProfile) Object.assign(override, detail.profileOverride)
      return
    }
    const ownerKey = normalizedModelName(item.ownerLabel)
    if (ownerKey && (profileKey.includes(ownerKey) || ownerKey.includes(profileKey))) Object.assign(override, detail.profileOverride)
  })
  return override
}
function effectiveProfileFor(baseProfile: Record<ProfileKey, string>, profileName: string, optionalSelectionId?: string, applyBigUns = true) {
  const unit = prototypeUnit.value
  if (!unit) return { ...baseProfile }
  const selectedMount = selectedMountOption.value
  const selectedMountProfile = Boolean(selectedMount && optionalSelectionId === selectedMount.id)
  return applyProfileEffects({
    baseProfile,
    profileName,
    unit,
    selectedEquipment: selectedEquipment.value,
    equipmentCount,
    modelCount: modelCount.value,
    activeRules: activeSpecialRules.value,
    bigUnsSelected: bigUnsSelected.value && applyBigUns,
    magicOverride: magicProfileOverridesFor(profileName),
    mountedRider: { active: Boolean(selectedMount) && !selectedMountProfile, modifiers: selectedMount?.riderProfileModifiers },
  })
}
function equipmentDisplayName(option: PrototypeEquipmentOption) {
  const name = displayOptionName(option)
  if (!isPerModelEquipmentSelection(option) || equipmentCount(option) <= 1) return name
  return `${name} ×${equipmentCount(option)}`
}
function formattedWeaponName(weapon: PrototypeWeapon) {
  const count = isPerModelWeaponSelection(weapon) ? (weaponCounts.value.get(weapon.id) || 0) : 0
  if (/^Hand weapons?$/i.test(weapon.name.trim()) && count > 0 && count !== modelCount.value) return `${count} – (Hand Weapon)`
  return formatHandWeaponCountLabel(count > 0 && count !== modelCount.value ? `${weapon.name} ×${count}` : weapon.name)
}
function weaponOwnerOption(weapon: PrototypeWeapon) {
  if (!weapon.requiresSelection) return undefined
  return prototypeUnit.value?.equipmentOptions.find((option) => option.id === weapon.requiresSelection && Boolean(option.addsProfile || option.kind === 'mount'))
}
function baseProfileWeapons() { return selectedWeapons.value.filter((weapon) => !weaponOwnerOption(weapon)) }
function sharedProfileLoadout() {
  const weapons = baseProfileWeapons().filter((weapon) => !isWarMachineArmament(weapon.name)).map(formattedWeaponName)
  const equipment = selectedEquipment.value.filter((option) => option.kind !== 'role' && option.kind !== 'mount' && option.kind !== 'mount-option' && !option.addsProfile && !isWizardParentOption(option) && !isWizardLevelOption(option)).map(equipmentDisplayName)
  const magic = selectedMagicEntries.value.filter(({ item }) => item.ownerId === 'unit').map(({ item, count }) => count > 1 ? `${item.name} ×${count}` : item.name)
  return [...new Set([...weapons, ...equipment, ...magic])]
}
function isCrewProfile(name: string) { return /\bcrew\b/i.test(name) }
function isWarMachineArmament(name: string) { return /\b(?:bolt thrower|stone thrower|rock lobber|doom diver|cannon|great cannon|mortar|catapult|ballista|trebuchet)\b/i.test(name) }
function profileSpecificBaseWeapons(profileName: string, allNames: string[]) {
  const hasCrew = allNames.some(isCrewProfile)
  if (!hasCrew) return null
  const weapons = baseProfileWeapons()
  if (isCrewProfile(profileName)) return weapons.filter((weapon) => weapon.kind === 'melee' && !isWarMachineArmament(weapon.name)).map(formattedWeaponName)
  return []
}
function ownerMagicForProfile(profileName: string, allNames: string[], profileIndex: number) {
  const rows: string[] = []
  const normalized = normalizedModelName(profileName)
  const mount = isMountProfileName(profileName)
  selectedMagicEntries.value.filter(({ item }) => item.ownerId !== 'unit').forEach(({ item, count }) => {
    const owner = normalizedModelName(item.ownerLabel)
    const ownerHasProfile = allNames.some((name) => normalizedModelName(name).includes(owner) || owner.includes(normalizedModelName(name)))
    const belongsHere = owner && (normalized.includes(owner) || owner.includes(normalized))
    if (belongsHere || (!ownerHasProfile && !mount && profileIndex === allNames.findIndex((name) => !isMountProfileName(name)))) rows.push(`${belongsHere ? '' : `${item.ownerLabel}: `}${count > 1 ? `${item.name} ×${count}` : item.name}`)
  })
  return rows
}
function ensureHandWeapon(rows: string[], _profileName: string, _allNames: string[], _optionalSelectionId?: string) {
  if (prototypeUnit.value?.assumesHandWeapon === false || rows.some((item) => /hand weapons?/i.test(item))) return rows
  rows.unshift('Hand weapon')
  return rows
}
function loadoutForProfile(profileName: string, profileIndex: number, allNames: string[], optionalEquipment?: string[], optionalSelectionId?: string) {
  const mount = isMountProfileName(profileName)
  const specificWeapons = profileSpecificBaseWeapons(profileName, allNames)
  const ownerWeapons = optionalSelectionId ? selectedWeapons.value.filter((weapon) => weapon.requiresSelection === optionalSelectionId).map(formattedWeaponName) : []
  const childEquipment = optionalSelectionId ? selectedEquipment.value.filter((option) => option.requiresSelection === optionalSelectionId && option.kind !== 'role' && !isWizardParentOption(option) && !isWizardLevelOption(option)).map(equipmentDisplayName) : []
  const rows = optionalEquipment?.length
    ? [...optionalEquipment, ...ownerWeapons, ...childEquipment]
    : mount
      ? [...ownerWeapons, ...selectedEquipment.value.filter((option) => option.kind === 'mount-option' && (!optionalSelectionId || option.requiresSelection === optionalSelectionId)).map((option) => option.name)]
      : specificWeapons
        ? [...specificWeapons, ...selectedEquipment.value.filter((option) => option.kind !== 'role' && option.kind !== 'mount' && option.kind !== 'mount-option' && !option.addsProfile && !isWizardParentOption(option) && !isWizardLevelOption(option)).map(equipmentDisplayName)]
        : sharedProfileLoadout()
  rows.push(...ownerMagicForProfile(profileName, allNames, profileIndex))
  return [...new Set(ensureHandWeapon(rows, profileName, allNames, optionalSelectionId))]
}
const profileRows = computed(() => {
  const unit = prototypeUnit.value
  if (!unit) return []
  let baseProfiles = (unit.profiles?.length ? unit.profiles : [{ name: unit.name, profile: unit.profile }]).map((row) => ({ ...row, optionalEquipment: undefined as string[] | undefined, selectionId: undefined as string | undefined }))
  const optional = (unit.optionalProfiles || []).filter((row) => selectedEquipmentIds.value.has(row.selectionId)).map((row) => ({ name: row.name, profile: row.profile, optionalEquipment: row.equipment, selectionId: row.selectionId }))

  // Reference pages can contain both the ordinary model and an upgraded model
  // profile (Big 'Uns is the common example). Show only the version actually
  // selected instead of presenting both characteristic rows at once.
  const explicitBigUns = baseProfiles.some((row) => /\bBig\s*[’']?Uns?\b/i.test(row.name || ''))
  if (explicitBigUns) {
    if (bigUnsSelected.value) {
      baseProfiles = baseProfiles.filter((row) => {
        const name = row.name || unit.name
        return /\bBig\s*[’']?Uns?\b/i.test(name) || isMountProfileName(name) || /\b(?:champion|boss|captain|sergeant|champ|musician|standard bearer)\b/i.test(name)
      })
    } else {
      baseProfiles = baseProfiles.filter((row) => !/\bBig\s*[’']?Uns?\b/i.test(row.name || ''))
    }
  }

  const profiles = [...baseProfiles, ...optional]
    .map((row, index) => ({ ...row, originalIndex: index }))
    .sort((a, b) => {
      const weight = (row: typeof a) => {
        const name = row.name || unit.name
        if (isMountProfileName(name)) return 3
        if (row.selectionId) return 2
        if (/\b(?:champion|boss|captain|sergeant|champ)\b/i.test(name) && normalizedModelName(name) !== normalizedModelName(unit.name)) return 1
        return 0
      }
      return weight(a) - weight(b) || a.originalIndex - b.originalIndex
    })
  const names = profiles.map((row) => row.name || unit.name)
  return profiles.map((row, index) => {
    const sourceName = row.name || unit.name
    const explicitUpgradeRow = /\bBig\s*[’']?Uns?\b/i.test(sourceName)
    const bigUns = bigUnsSelected.value && !explicitBigUns && !isMountProfileName(sourceName)
    const profile = effectiveProfileFor(row.profile, sourceName, row.selectionId, !explicitUpgradeRow)
    if (isMountProfileName(sourceName)) {
      const save = Number.parseInt(profile.Sv, 10)
      const contribution = Number.isFinite(save) ? Math.max(0, 7 - save) : 0
      profile.Sv = contribution > 0 ? `+${contribution}` : '—'
    }
    return { name: `${sourceName}${bigUns && !explicitUpgradeRow ? " - Big 'Uns" : ''}`, sourceName, profile, loadout: loadoutForProfile(sourceName, index, names, row.optionalEquipment, row.selectionId) }
  })
})

function displayStat(profile: Record<ProfileKey, string>, stat: ProfileKey) { return profile[stat] || '—' }

const selectedWizardLevelOption = computed(() => {
  const levels = selectedEquipment.value.filter(isWizardLevelOption).sort((a, b) => wizardLevelFromName(b.name) - wizardLevelFromName(a.name))
  if (magicalMaelstromEnabled.value) return levels[0]
  return levels.find((option) => wizardLevelFromName(option.name) === wizardLevel.value)
})
const includedRosterLabels = computed(() => {
  const rows = [
    ...selectedWeapons.value.filter((weapon) => weapon.default || weapon.locked).map(formattedWeaponName),
    ...selectedEquipment.value.filter((option) => !isWizardLevelOption(option) && (option.default || option.locked)).map(equipmentDisplayName),
  ]
  if (wizardLevel.value > 0 && (magicalMaelstromEnabled.value || selectedWizardLevelOption.value?.default || selectedWizardLevelOption.value?.locked)) rows.push(`Wizard Level ${wizardLevel.value}`)
  if (magicalMaelstromEnabled.value && wizardLevel.value > 0) rows.push('Magical Maelstrom')
  return [...new Set(rows)]
})
const optionalRosterLabels = computed(() => {
  const rows = [
    ...selectedWeapons.value.filter((weapon) => !weapon.default && !weapon.locked).map(formattedWeaponName),
    ...selectedEquipment.value.filter((option) => !isWizardLevelOption(option) && !option.default && !option.locked).map(equipmentDisplayName),
    ...selectedMagicEntries.value.map(({ item, count }) => count > 1 ? `${item.name} ×${count}` : item.name),
    ...selectedLores.value,
  ]
  if (!magicalMaelstromEnabled.value && wizardLevel.value > 0 && selectedWizardLevelOption.value && !selectedWizardLevelOption.value.default && !selectedWizardLevelOption.value.locked) rows.push(`Wizard Level ${wizardLevel.value}`)
  return [...new Set(rows)]
})
const rosterOptionLabels = computed(() => [...new Set([...includedRosterLabels.value, ...optionalRosterLabels.value])])
const activeSpecialRules = computed(() => {
  const unit = prototypeUnit.value
  if (!unit) return []
  const sourceRules = unit.specialRules.filter((rule) => (!rule.requiresSelection || selectionHas(rule.requiresSelection)) && (!rule.requiresAnySelection?.length || rule.requiresAnySelection.some(selectionHas)))
  return [...sourceRules, ...selectedLoreRules.value]
})
const magicItemCards = computed(() => selectedMagicEntries.value.map(({ item, count }) => {
  const detail = magicItemDetails.value.get(item.id)
  return { item, count, rule: { name: `${item.ownerId === 'unit' ? '' : `${item.ownerLabel} — `}${count > 1 ? `${item.name} ×${count}` : item.name}`, path: `/magic-item/${item.slug}`, timing: magicTypeLabel(item.type), tone: 'magic' as RuleTone, summary: detail?.summary || (magicItemDetails.value.has(item.id) ? 'Open this magical item for its full rule text.' : ''), fluff: detail?.fluff, keywords: [{ label: item.name, path: `/magic-item/${item.slug}` }, { label: 'Magic Items', path: '/magic-items' }] } }
}))
const packedSpecialRules = computed(() => [...activeSpecialRules.value].sort((a, b) => (b.summary.length + b.name.length * 2) - (a.summary.length + a.name.length * 2)))
const canAdjustModelCount = computed(() => isEditing.value && Boolean(prototypeUnit.value) && prototypeUnit.value?.unitSize !== '1 model' && (Number(prototypeUnit.value?.maximumModels || 0) !== 1 || Number(prototypeUnit.value?.minimumModels || 1) !== 1))
function formatUnitSize() { return `${modelCount.value} ${modelCount.value === 1 ? 'model' : 'models'}` }
function startingUnitSize() {
  const minimum = Math.max(1, Number(prototypeUnit.value?.minimumModels || 1))
  const maximum = Number(prototypeUnit.value?.maximumModels || 0)
  if (maximum > 0 && maximum === minimum) return `${minimum} ${minimum === 1 ? 'model' : 'models'}`
  return `${minimum}+ models`
}
function adjustModelCount(delta: number) {
  if (!canAdjustModelCount.value) return
  const minimum = Math.max(1, Number(prototypeUnit.value?.minimumModels || 1))
  const maximum = Number(prototypeUnit.value?.maximumModels || 0) > 0 ? Number(prototypeUnit.value?.maximumModels) : 999
  modelCount.value = Math.min(maximum, Math.max(minimum, modelCount.value + delta))
  normalizeWeaponCounts()
  normalizeEquipmentCounts()
}
function setModelCount(value: number) {
  if (!canAdjustModelCount.value) return
  const minimum = Math.max(1, Number(prototypeUnit.value?.minimumModels || 1))
  const maximum = Number(prototypeUnit.value?.maximumModels || 0) > 0 ? Number(prototypeUnit.value?.maximumModels) : 999
  modelCount.value = Math.min(maximum, Math.max(minimum, Number(value) || minimum))
  normalizeWeaponCounts()
  normalizeEquipmentCounts()
}
function handleModelCountEvent(event: Event) { setModelCount(Number((event.target as HTMLInputElement | null)?.value || 0)) }
function weaponCount(weapon: PrototypeWeapon) { return Math.max(0, weaponCounts.value.get(weapon.id) || 0) }
function weaponOptionSelected(weapon: PrototypeWeapon) { return isPerModelWeaponSelection(weapon) ? weaponCount(weapon) > 0 : selectedWeaponIds.value.has(weapon.id) }
function weaponGroupAllocated(weapon: PrototypeWeapon) {
  const group = weaponAllocationGroup(weapon)
  return (prototypeUnit.value?.weapons || [])
    .filter((candidate) => candidate.id !== weapon.id && isPerModelWeaponSelection(candidate) && weaponAllocationGroup(candidate) === group)
    .reduce((sum, candidate) => sum + weaponCount(candidate), 0)
}
function weaponCountMaximum(weapon: PrototypeWeapon) {
  const capacity = modelCount.value - weaponGroupAllocated(weapon)
  return Math.max(0, Math.min(weapon.maximum || modelCount.value, capacity))
}
function normalizeWeaponCounts() {
  if (!prototypeUnit.value) return
  const normalized = normalizeWeaponAllocation(prototypeUnit.value, selectedWeaponIds.value, weaponCounts.value, modelCount.value)
  weaponCounts.value = normalized.counts
  selectedWeaponIds.value = normalized.selectedIds
}
function adjustWeaponCount(weapon: PrototypeWeapon, delta: number) {
  if (isReadOnly.value || !isPerModelWeaponSelection(weapon)) return
  restoreScrollAfterMutation(() => {
    const next = new Map(weaponCounts.value)
    const value = Math.max(0, Math.min(weaponCountMaximum(weapon), weaponCount(weapon) + delta))
    if (value > 0) next.set(weapon.id, value); else next.delete(weapon.id)
    weaponCounts.value = next
    const selected = new Set(selectedWeaponIds.value)
    if (value > 0) selected.add(weapon.id); else if (!weapon.default && !weapon.locked) selected.delete(weapon.id)
    selectedWeaponIds.value = selected
    normalizeWeaponCounts()
  })
}
const unitKeywordLinks = computed(() => {
  const unit = prototypeUnit.value
  if (!unit) return []
  const wizardLinks = isWizard.value ? [{ label: 'Wizard', path: '/characters/wizards' }, { label: `Wizard Level ${wizardLevel.value}`, path: '/characters/wizards' }] : []
  const sourceKeywords = unit.keywords.filter((row) => !/^(?:Level\s*\d+\s*Wizard|Wizard\s*Level\s*\d+)$/i.test(String(row.label || '').trim()))
  const sourceRules = activeSpecialRules.value.filter((rule) => !/^(?:Level\s*\d+\s*Wizard|Wizard\s*Level\s*\d+)$/i.test(String(rule.name || '').trim()))
  const hasMagicalAttacks = selectedMagicWeapons.value.length > 0 || [...meleeWeapons.value, ...rangedWeapons.value].some(({ weapon }) => weaponRuleLabels(weapon).some((rule) => /^Magical Attacks$/i.test(rule.label)))
  const magicalAttackLink = hasMagicalAttacks ? [{ label: 'Magical Attacks', path: '/special-rules/magical-attacks' }] : []
  const rows = [...sourceKeywords, ...wizardLinks, ...sourceRules.map((rule) => ({ label: ruleDisplayName(rule.name), path: rule.path || rule.keywords[0]?.path || '/' })), ...selectedMagicEntries.value.map(({ item }) => ({ label: item.name, path: `/magic-item/${item.slug}` })), ...magicalAttackLink]
  const seen = new Set<string>()
  return rows.filter((row) => { const key = row.label.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true })
})

function equipmentCount(option: PrototypeEquipmentOption) { return Math.max(0, equipmentCounts.value.get(option.id) || 0) }
function equipmentCountMaximum(option: PrototypeEquipmentOption) { return Math.max(0, Math.min(option.maximum || modelCount.value, modelCount.value)) }
function normalizeEquipmentCounts() {
  if (!prototypeUnit.value) return
  const normalized = normalizeDomainEquipmentCounts(prototypeUnit.value, selectedEquipmentIds.value, equipmentCounts.value, modelCount.value)
  equipmentCounts.value = normalized.counts
  selectedEquipmentIds.value = normalized.selectedIds
}
function adjustEquipmentCount(option: PrototypeEquipmentOption, delta: number) {
  if (isReadOnly.value || !isPerModelEquipmentSelection(option)) return
  restoreScrollAfterMutation(() => {
    const next = new Map(equipmentCounts.value)
    const current = equipmentCount(option)
    const value = Math.max(0, Math.min(equipmentCountMaximum(option), current + delta))
    if (value > 0) next.set(option.id, value); else next.delete(option.id)
    equipmentCounts.value = next
    const selected = new Set(selectedEquipmentIds.value)
    if (value > 0) selected.add(option.id); else if (!option.locked) selected.delete(option.id)
    selectedEquipmentIds.value = selected
    normalizeEquipmentCounts()
    normalizeSelections()
  })
}

function normalizeSelections() {
  const unit = prototypeUnit.value
  if (!unit) return
  const normalized = normalizeUnitSelections(unit, selectedEquipmentIds.value, selectedWeaponIds.value, {
    startingWizardLevel: startingWizardLevel.value,
    mounted: isMounted.value,
  })
  selectedEquipmentIds.value = magicalMaelstromEnabled.value ? applyMagicalMaelstromSelections(unit.equipmentOptions, normalized.equipmentIds) : normalized.equipmentIds
  selectedWeaponIds.value = normalized.weaponIds
}
function restoreScrollAfterMutation(mutator: () => void) {
  if (isReadOnly.value) return
  const x = window.scrollX
  const y = window.scrollY
  mutator()
  restoreScrollPosition(x, y)
}
function restoreScrollPosition(x = window.scrollX, y = window.scrollY) {
  void nextTick(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ left: x, top: y, behavior: 'auto' })
      // Dynamic characteristics (Ward/Regeneration/mount bonuses) can change
      // layout again on the following frame. Re-assert the user's position so
      // the profile panel never becomes an unintended scroll target.
      window.requestAnimationFrame(() => window.scrollTo({ left: x, top: y, behavior: 'auto' }))
    })
  })
}
function setWeaponSelected(weapon: PrototypeWeapon, selected: boolean) {
  if (isReadOnly.value || mundaneWeaponSuperseded(weapon) || weaponUnavailable(weapon) || weaponEffectivelyLocked(weapon)) return
  if (isPerModelWeaponSelection(weapon)) {
    if (weapon.default && weapon.locked) return
    const current = weaponCount(weapon)
    if (selected && current <= 0) adjustWeaponCount(weapon, 1)
    else if (!selected && current > 0) adjustWeaponCount(weapon, -current)
    return
  }
  restoreScrollAfterMutation(() => {
    const unit = prototypeUnit.value
    if (!unit) return
    const next = selected ? selectExclusiveWeapon(unit, selectedWeaponIds.value, weapon) : new Set(selectedWeaponIds.value)
    if (!selected) next.delete(weapon.id)
    selectedWeaponIds.value = next
    normalizeSelections()
  })
}
function handleWeaponCheckbox(row: { source: 'base' | 'magic'; weapon: PrototypeWeapon }, event: Event) {
  if (row.source !== 'base') return
  setWeaponSelected(row.weapon, Boolean((event.target as HTMLInputElement | null)?.checked))
}
function setEquipmentSelected(option: PrototypeEquipmentOption, selected: boolean) {
  if (isReadOnly.value || mundaneEquipmentSuperseded(option)) return
  const currentlySelected = selectedEquipmentIds.value.has(option.id)
  if (equipmentOptionEffectivelyLocked(option) && !selected) return
  if (!selected && isLoreEquipmentOption(option) && option.exclusiveGroup) {
    const hasAlternative = (prototypeUnit.value?.equipmentOptions || []).some((candidate) => candidate.id !== option.id && candidate.exclusiveGroup === option.exclusiveGroup && selectedEquipmentIds.value.has(candidate.id))
    if (!hasAlternative) return
  }
  if (isPerModelEquipmentSelection(option)) {
    if (selected && !currentlySelected) adjustEquipmentCount(option, Math.max(1, option.minimum || 1))
    else if (!selected && currentlySelected) adjustEquipmentCount(option, -equipmentCount(option))
    return
  }
  restoreScrollAfterMutation(() => {
    const unit = prototypeUnit.value
    if (!unit) return
    const next = selected ? selectExclusiveEquipment(unit, selectedEquipmentIds.value, option) : new Set(selectedEquipmentIds.value)
    if (!selected) next.delete(option.id)
    selectedEquipmentIds.value = next
    normalizeSelections()
  })
}
function handleEquipmentCheckbox(option: PrototypeEquipmentOption, event: Event) {
  setEquipmentSelected(option, Boolean((event.target as HTMLInputElement | null)?.checked))
}
function optionCost(points: number) { return points > 0 ? `+${points} pts` : '' }

const magicTypeOrder: MagicItem['type'][] = ['weapon', 'armor', 'talisman', 'enchanted-item', 'arcane-item', 'banner']
function magicTypeLabel(type: MagicItem['type']) { return ({ weapon: 'Magic Weapon', armor: 'Magic Armour', talisman: 'Talisman', 'enchanted-item': 'Enchanted Item', 'arcane-item': 'Arcane Item', banner: 'Magic Banner' } as const)[type] }
function magicSlug(name: string) { return name.toLowerCase().replace(/\*/g, '').replace(/[’']/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
function fallbackMagicItemText(html: string, itemName: string) {
  const dom = new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html')
  dom.querySelectorAll('script,style,nav,header,footer,table').forEach((node) => node.remove())
  const wanted = itemName.toLowerCase().trim()
  const rows = Array.from(dom.querySelectorAll('p, li'))
    .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() || '')
    .filter((value) => value.length >= 18 && value.toLowerCase() !== wanted && !/^(publication|source|page)\b/i.test(value))
  const seen = new Set<string>()
  return rows.filter((value) => { const key = value.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true }).slice(0, 4).join(' ').slice(0, 1800)
}
const magicPickerPool = computed(() => selectedMagicPool.value)
const magicPickerTabs = computed(() => magicTypeOrder.filter((type) => magicPickerPool.value?.types.includes(type)))
const magicPickerItems = computed(() => {
  const pool = magicPickerPool.value
  if (!pool || !magicPickerTab.value) return []
  return magicItems.value.filter((item) => item.ownerId === pool.id && item.type === magicPickerTab.value)
})
function magicPickerCount(id: string) { return magicPickerCounts.value.get(id) || 0 }
function magicPickerSpent() {
  const pool = magicPickerPool.value
  if (!pool) return 0
  return magicItems.value.filter((item) => item.ownerId === pool.id).reduce((sum, item) => sum + item.points * magicPickerCount(item.id), 0)
}
function magicPickerRemaining() { return Math.max(0, Number(magicPickerPool.value?.maxPoints || 0) - magicPickerSpent()) }
function magicPickerDetail(item: MagicItem) { return magicItemDetails.value.get(item.id) }
function magicPickerCanSelect(item: MagicItem) {
  if (magicPickerCount(item.id) > 0) return true
  return item.points <= magicPickerRemaining()
}
async function preloadMagicPickerDetails() {
  const rows = magicPickerItems.value.filter((item) => !magicItemDetails.value.has(item.id))
  if (!rows.length) return
  await Promise.allSettled(rows.map((item) => loadMagicItemDetail(item)))
}
function openMagicPicker() {
  const pool = selectedMagicPool.value
  if (!isEditing.value || !pool) return
  const next = new Map<string, number>()
  selectedMagicEntries.value.filter(({ item }) => item.ownerId === pool.id).forEach(({ item, count }) => next.set(item.id, count))
  magicPickerCounts.value = next
  magicPickerExpanded.value = new Set()
  magicPickerTab.value = pool.types.find((type) => magicItems.value.some((item) => item.ownerId === pool.id && item.type === type)) || pool.types[0] || ''
  magicPickerOpen.value = true
  void preloadMagicPickerDetails()
}
function cancelMagicPicker() {
  magicPickerOpen.value = false
  magicPickerCounts.value = new Map()
  magicPickerExpanded.value = new Set()
}
function toggleMagicPickerItem(item: MagicItem, selected: boolean) {
  if (!selected && magicPickerCount(item.id) <= 0) return
  if (selected && !magicPickerCanSelect(item)) return
  const next = new Map(magicPickerCounts.value)
  if (selected) next.set(item.id, Math.max(1, next.get(item.id) || 1)); else next.delete(item.id)
  magicPickerCounts.value = next
}
function handleMagicPickerCheckbox(item: MagicItem, event: Event) {
  toggleMagicPickerItem(item, Boolean((event.target as HTMLInputElement | null)?.checked))
}
function adjustMagicPickerCount(item: MagicItem, delta: number) {
  const current = magicPickerCount(item.id)
  const maximum = maxMagicCopies(item)
  const nextCount = Math.max(0, Math.min(maximum, current + delta))
  if (nextCount > current && item.points > magicPickerRemaining()) return
  const next = new Map(magicPickerCounts.value)
  if (nextCount > 0) next.set(item.id, nextCount); else next.delete(item.id)
  magicPickerCounts.value = next
}
async function toggleMagicPickerDescription(item: MagicItem) {
  const next = new Set(magicPickerExpanded.value)
  if (next.has(item.id)) next.delete(item.id); else { next.add(item.id); await loadMagicItemDetail(item) }
  magicPickerExpanded.value = next
}
async function finishMagicPicker() {
  const pool = magicPickerPool.value
  if (!pool) return
  const next = new Map(selectedMagicCounts.value)
  magicItems.value.filter((item) => item.ownerId === pool.id).forEach((item) => next.delete(item.id))
  for (const [id, count] of magicPickerCounts.value) {
    if (count <= 0) continue
    next.set(id, count)
    const item = magicItems.value.find((candidate) => candidate.id === id)
    if (item) await loadMagicItemDetail(item)
  }
  selectedMagicCounts.value = next
  magicPickerOpen.value = false
  magicPickerExpanded.value = new Set()
  applyMagicSupersession()
}

async function loadMagicItemChoices() {
  const activePools = activeMagicPools.value
  if (!activePools.length || !army.value) { magicItems.value = []; return }
  magicLoading.value = true; magicError.value = ''
  try {
    const data = await loadArmyData('magic-items') as Record<string, Array<Record<string, unknown>>>
    const sourcePools = [{ source: 'Common Magic Items', rows: Array.isArray(data.general) ? data.general : [] }, { source: `${army.value.name} Magic Items`, rows: Array.isArray(data[army.value.dataKey]) ? data[army.value.dataKey] : (Array.isArray(data[army.value.slug]) ? data[army.value.slug] : []) }]
    const rows: MagicItem[] = []
    sourcePools.forEach(({ source, rows: sourceRows }) => sourceRows.forEach((raw) => {
      const type = String(raw.type || '') as MagicItem['type']
      if (!magicTypeOrder.includes(type)) return
      const itemComposition = String(raw.compositionRule || '')
      if (itemComposition === 'battle-march' && !battleMarchMagicEnabled.value) return
      if (itemComposition && itemComposition !== 'battle-march' && itemComposition !== compositionRuleId.value) return
      const name = String(raw.name_en || raw.name || '').trim(); if (!name) return
      const itemPoints = Number(raw.points || 0)
      if (itemPoints > magicItemPointLimit.value) return
      const baseId = `${source}:${type}:${name}`.toLowerCase().replace(/\s+/g, '-')
      activePools.filter((pool) => pool.types.includes(type)).forEach((pool) => rows.push({
        id: `${pool.id}::${baseId}`, baseId, ownerId: pool.id, ownerLabel: pool.label, poolMaxPoints: pool.maxPoints,
        name, points: itemPoints, type, source, stackable: Boolean(raw.stackable), maximum: Number(raw.maximum || 0) > 0 ? Number(raw.maximum) : undefined,
        onePerArmy: raw.onePerArmy !== false, slug: magicSlug(String(raw.name || name)),
        fluff: String(raw.fluff_en || raw.fluff || raw.flavour_en || raw.flavour || raw.flavor_en || raw.flavor || '').replace(/\s+/g, ' ').trim() || undefined,
      }))
    }))
    const selectedBefore = selectedMagicEntries.value.map(({ item }) => item)
    const seen = new Set<string>()
    const fresh = rows.filter((item) => { const key = item.id.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true })
    selectedBefore.forEach((item) => { if (activePools.some((pool) => pool.id === item.ownerId) && !fresh.some((candidate) => candidate.id === item.id)) fresh.push(item) })
    magicItems.value = fresh.sort((a, b) => a.ownerLabel.localeCompare(b.ownerLabel) || a.type.localeCompare(b.type) || b.points - a.points || a.name.localeCompare(b.name))
    if (!activePools.some((pool) => pool.id === selectedMagicPoolId.value)) selectedMagicPoolId.value = activePools[0]?.id || ''
  } catch (error) { reportAppError(error, 'MAGIC_ITEM_CATALOG', { unitId: unitId.value }); magicError.value = error instanceof Error ? error.message : 'Magic item data could not be loaded.' } finally { magicLoading.value = false }
}
function selectedMagicCount(id: string) { return selectedMagicCounts.value.get(id) || 0 }
function maxMagicCopies(item: MagicItem) { if (!item.stackable) return 1; if (item.maximum) return item.maximum; if (item.points <= 0) return 99; return Math.max(1, Math.floor(item.poolMaxPoints / item.points)) }
function canAddMagicItem(item: MagicItem) {
  if (!activeMagicPools.value.some((pool) => pool.id === item.ownerId && pool.types.includes(item.type))) return false
  if (selectedMagicCount(item.id) >= maxMagicCopies(item)) return false
  return magicPoolPoints(item.ownerId) + item.points <= item.poolMaxPoints
}

async function loadMagicItemDetail(item: MagicItem) {
  if (magicItemDetails.value.has(item.id)) return
  try {
    const document = await fetchRuleDocument(`/magic-item/${item.slug}`)
    const dom = new DOMParser().parseFromString(`<main>${document.html}</main>`, 'text/html')
    const rows = Array.from(dom.querySelectorAll('table tr')).slice(1)
    const cells = rows.map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() || '')).find((row) => row.length >= 4)
    const detail: MagicItemDetail = { summary: extractMechanicalRuleText(document.html) || fallbackMagicItemText(document.html, item.name), fluff: item.fluff }
    const fluffNode = dom.querySelector<HTMLElement>('.fluff, .flavour, .flavor, p em, p i')
    const fluffText = fluffNode?.textContent?.replace(/\s+/g, ' ').trim() || ''
    if (fluffText && fluffText !== detail.summary && fluffText.length > 12) detail.fluff = fluffText
    if (item.type === 'weapon' && cells) { detail.range = cells[0] || 'Combat'; detail.strength = cells[1] || 'See rule'; detail.ap = cells[2] || 'See rule'; detail.rules = cells[3] && !/^[-—]$/.test(cells[3]) ? cells[3].split(/,\s*/).filter(Boolean) : ['Magic Weapon']; detail.kind = detail.range.toLowerCase() === 'combat' ? 'melee' : 'missile' }
    const body = dom.body.textContent?.replace(/\s+/g, ' ').trim() || ''
    const override: Partial<Record<ProfileKey, string>> = {}
    if (item.type === 'armor') {
      detail.shield = /\bshield\b/i.test(item.name) || /\bshield\b/i.test(body)
      if (/full plate armour/i.test(body)) override.Sv = '4+'; else if (/heavy armour/i.test(body)) override.Sv = '5+'; else if (/light armour/i.test(body)) override.Sv = '6+'
    }
    const ward = body.match(/(?:Ward\s+save(?:\s+of)?\s*\(?\s*(2\+|3\+|4\+|5\+|6\+)\s*\)?|(2\+|3\+|4\+|5\+|6\+)\s+Ward\s+save)/i); if (ward) override.Ward = ward[1] || ward[2]
    const regeneration = body.match(/Regeneration\s*\(?\s*([2-6]\+)\s*\)?/i); if (regeneration) override.Rn = regeneration[1]
    ;[[/Toughness(?: characteristic)?(?: by)? \+?1/i, 'T'], [/Wounds?(?: characteristic)?(?: by)? \+?1/i, 'W'], [/Initiative(?: characteristic)?(?: by)? \+?1/i, 'I'], [/Attacks?(?: characteristic)?(?: by)? \+?1/i, 'A'], [/Leadership(?: characteristic)?(?: by)? \+?1/i, 'Ld']].forEach(([pattern, key]) => { if ((pattern as RegExp).test(body)) override[key as ProfileKey] = incrementCharacteristic(prototypeUnit.value?.profile[key as ProfileKey] || '—', 1) })
    if (Object.keys(override).length) detail.profileOverride = override
    magicItemDetails.value = new Map(magicItemDetails.value).set(item.id, detail)
  } catch (error) { reportAppError(error, 'MAGIC_ITEM_DETAIL', { itemId: item.id, unitId: unitId.value }); magicItemDetails.value = new Map(magicItemDetails.value).set(item.id, { fluff: item.fluff }) }
}
watch(() => [magicPickerOpen.value, magicPickerTab.value, magicPickerItems.value.map((item) => item.id).join('|')], () => {
  if (magicPickerOpen.value) void preloadMagicPickerDetails()
})

async function adjustMagicItem(id: string, delta: number) {
  if (isReadOnly.value) return
  const item = magicItems.value.find((candidate) => candidate.id === id); if (!item) return
  const scrollX = window.scrollX; const scrollY = window.scrollY; const current = selectedMagicCount(id); if (delta > 0 && !canAddMagicItem(item)) return
  const next = new Map(selectedMagicCounts.value); const count = Math.max(0, current + delta); if (!count) next.delete(id); else next.set(id, count); selectedMagicCounts.value = next
  if (count) await loadMagicItemDetail(item); applyMagicSupersession(); restoreScrollPosition(scrollX, scrollY)
}

watch(() => activeMagicPools.value.map((pool) => `${pool.id}:${pool.maxPoints}:${pool.types.join(',')}`).join('|'), async () => {
  if (!hydratedFromRoster.value) return
  const pools = new Map(activeMagicPools.value.map((pool) => [pool.id, pool]))
  const next = new Map(selectedMagicCounts.value)
  for (const [id] of next) {
    const item = magicItems.value.find((candidate) => candidate.id === id)
    const pool = item ? pools.get(item.ownerId) : null
    if (!item || !pool || !pool.types.includes(item.type)) next.delete(id)
  }
  selectedMagicCounts.value = next
  if (!activeMagicPools.value.some((pool) => pool.id === selectedMagicPoolId.value)) selectedMagicPoolId.value = activeMagicPools.value[0]?.id || ''
  await loadMagicItemChoices()
  applyMagicSupersession()
})

function rosterMagicItems(): BuilderRosterMagicItem[] {
  return selectedMagicEntries.value.map(({ item, count }) => ({ ...item, count }))
}
function saveCurrentRosterConfiguration() {
  if (!isEditing.value || !hydratedFromRoster.value || !instanceId.value) return
  // Autosave must be a pure snapshot. Mutating the watched selection refs here
  // creates a reactive feedback loop because normalization replaces Sets/Maps.
  updateBuilderRosterSelection(backPath.value, instanceId.value, {
    totalPoints: totalPoints.value,
    basePoints: baseUnitPoints.value,
    unitSize: formatUnitSize(),
    modelCount: modelCount.value,
    maximumModels: prototypeUnit.value?.maximumModels,
    named: prototypeUnit.value?.named,
    mustBeGeneral: prototypeUnit.value?.mustBeGeneral,
    cannotBeGeneral: prototypeUnit.value?.cannotBeGeneral,
    troopType: prototypeUnit.value?.details.troopType,
    leadership: Number.parseInt(profileRows.value[0]?.profile.Ld || '', 10) || undefined,
    generalEligible: Boolean(prototypeUnit.value?.equipmentOptions.some((option) => option.kind === 'role' && /^General$/i.test(option.name))),
    hierophantEligible: Boolean(prototypeUnit.value?.equipmentOptions.some((option) => option.kind === 'role' && /^The Hierophant$/i.test(option.name))),
    options: rosterOptionLabels.value,
    includedEquipment: includedRosterLabels.value,
    optionalSelections: optionalRosterLabels.value,
    specialRules: activeSpecialRules.value.map((rule) => ({ label: ruleDisplayName(rule.name), path: rule.path || rule.keywords[0]?.path || '/special-rules/what-are-special-rules' })),
    keywords: unitKeywordLinks.value,
    weaponIds: [...selectedWeaponIds.value],
    equipmentIds: [...selectedEquipmentIds.value],
    magicItems: rosterMagicItems(),
    magicPools: activeMagicPools.value.map((pool) => ({ ownerId: pool.id, ownerLabel: pool.label, maxPoints: pool.maxPoints })),
    weaponCounts: Object.fromEntries(weaponCounts.value),
    equipmentCounts: Object.fromEntries(equipmentCounts.value),
    loreSelections: activeLoreNames.value,
  })
}
let rosterSaveQueued = false
function queueRosterSave() {
  if (!isEditing.value || !hydratedFromRoster.value || rosterSaveQueued) return
  rosterSaveQueued = true
  void nextTick(() => {
    rosterSaveQueued = false
    saveCurrentRosterConfiguration()
  })
}
watch([selectedWeaponIds, selectedEquipmentIds, selectedMagicCounts, magicItemDetails, selectedLores, modelCount, weaponCounts, equipmentCounts], queueRosterSave)

function toggleFavourite() { if (!army.value) return; favourite.value = setFavoriteUnit(army.value.slug, unitId.value, !favourite.value) }

onMounted(() => { if (prototypeUnit.value) void resetSelections() })
</script>

<template>
  <main class="page unit-page warscroll-page" :class="{ 'unit-view-readonly': isReadOnly, 'unit-view-editing': isEditing }">
    <AppHeader compact :back-to="backPath" />

    <section v-if="liveLoading && !prototypeUnit" class="empty-state card-surface"><h1>Loading unit profile…</h1><p>Retrieving the current army data and rule profile.</p></section>
    <section v-else-if="liveError && !prototypeUnit" class="empty-state card-surface"><h1>Unit profile unavailable</h1><p>{{ liveError }}</p></section>

    <template v-if="prototypeUnit">
      <section class="warscroll-hero card-surface">
        <div class="warscroll-hero-actions">
          <button class="favourite-button warscroll-favourite" type="button" :aria-pressed="favourite" @click="toggleFavourite" aria-label="Favorite unit">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 17.03l-5.5 2.89 1.05-6.12L3.1 9.47l6.15-.9L12 3Z" /></svg>
          </button>
        </div>
        <p class="eyebrow">{{ army?.name || 'OLD WORLD UNIT' }}</p>
        <h1>{{ prettyUnitName }}</h1>
        <span class="warscroll-points-badge">{{ totalPoints }} pts</span>
        <div class="warscroll-unit-size" aria-label="Unit size">
          <span class="warscroll-unit-size-label">Unit Size</span>
          <strong>{{ formatUnitSize() }}</strong>
          <div v-if="canAdjustModelCount" class="unit-size-controls">
            <button type="button" :disabled="modelCount <= (prototypeUnit.minimumModels || 1)" @click="adjustModelCount(-1)">−</button>
            <input :value="modelCount" type="number" inputmode="numeric" :min="prototypeUnit.minimumModels || 1" :max="prototypeUnit.maximumModels || 999" @change="handleModelCountEvent" />
            <button type="button" :disabled="Boolean(prototypeUnit.maximumModels && modelCount >= prototypeUnit.maximumModels)" @click="adjustModelCount(1)">+</button>
          </div>
          <small v-if="canAdjustModelCount">Minimum {{ prototypeUnit.minimumModels || 1 }}<template v-if="prototypeUnit.maximumModels"> · Maximum {{ prototypeUnit.maximumModels }}</template></small>
          <small v-else>{{ startingUnitSize() }}</small>
        </div>
      </section>


      <section v-if="liveReferenceLoading" class="unit-reference-loading card-surface" aria-live="polite"><p><strong>Loading reference details…</strong> Showing the Builder profile now while special rules, weapons, and optional profiles finish loading in the background.</p></section>

      <section class="old-world-profile" aria-label="Unit characteristics">
        <div v-for="row in profileRows" :key="row.name" class="model-profile-row">
          <h2 v-if="profileRows.length > 1">{{ row.name }}</h2>
          <div class="warscroll-stat-grid">
            <div v-for="stat in statsForProfile(row.profile)" :key="stat" class="warscroll-stat-circle" :class="{ 'save-stat': stat === 'Sv' || stat === 'Ward' || stat === 'Rn' }">
              <CharacteristicIcon v-if="showBuilderCharacteristicIcons" :stat="stat" />
              <span class="warscroll-stat-label">{{ statLabel(stat) }}</span>
              <strong>{{ displayStat(row.profile, stat) }}</strong>
            </div>
          </div>
          <div v-if="row.loadout.length" class="profile-loadout" :aria-label="`${row.sourceName} equipped items`"><span class="profile-loadout-label">Equipped</span><span v-for="item in row.loadout" :key="item" class="profile-loadout-chip">{{ item }}</span></div>
        </div>
      </section>

      <div class="warscroll-section-stack static-unit-stack">
        <section v-if="meleeWeapons.length" class="unit-card-section static-unit-section weapons-panel"><h2>Melee Weapons</h2><div class="weapon-table-wrap warscroll-table-wrap"><table class="weapon-table old-world-weapon-table"><thead><tr><th>Name</th><th>Range</th><th>Strength</th><th>AP</th><th>Special Rules</th></tr></thead><tbody><tr v-for="row in meleeWeapons" :key="`${row.source}-${row.weapon.id}`"><td><span>{{ formatHandWeaponCountLabel(row.weapon.name) }}</span><small v-if="row.weapon.note" class="weapon-note">{{ row.weapon.note }}</small></td><td>{{ row.weapon.range }}</td><td>{{ row.weapon.strength }}</td><td class="weapon-ap-cell">{{ weaponApDisplay(row) }}</td><td><div v-if="weaponRuleLabels(row.weapon).length" class="weapon-rule-labels"><RouterLink v-for="link in weaponRuleLabels(row.weapon)" :key="`${link.label}-${link.path}`" :to="`/rules/read${link.path}`" class="weapon-rule-label">{{ link.label }}</RouterLink></div><span v-else>—</span></td></tr></tbody></table></div></section>

        <section v-if="rangedWeapons.length" class="unit-card-section static-unit-section weapons-panel"><h2>Range Weapons</h2><div class="weapon-table-wrap warscroll-table-wrap"><table class="weapon-table old-world-weapon-table"><thead><tr><th>Name</th><th>Range</th><th>Strength</th><th>AP</th><th>Special Rules</th></tr></thead><tbody><tr v-for="row in rangedWeapons" :key="`${row.source}-${row.weapon.id}`"><td><span>{{ formatHandWeaponCountLabel(row.weapon.name) }}</span><small v-if="row.weapon.note" class="weapon-note">{{ row.weapon.note }}</small></td><td>{{ row.weapon.range }}</td><td>{{ row.weapon.strength }}</td><td class="weapon-ap-cell">{{ weaponApDisplay(row) }}</td><td><div v-if="weaponRuleLabels(row.weapon).length" class="weapon-rule-labels"><RouterLink v-for="link in weaponRuleLabels(row.weapon)" :key="`${link.label}-${link.path}`" :to="`/rules/read${link.path}`" class="weapon-rule-label">{{ link.label }}</RouterLink></div><span v-else>—</span></td></tr></tbody></table></div></section>

        <section v-if="optionalWeaponOptions.length || equipmentGroups.length || showWizardLoreGroup" class="unit-card-section static-unit-section equipment-panel">
          <h2>Equipment & Options</h2>
          <div class="equipment-group-stack">
            <section v-if="optionalWeaponOptions.length" class="equipment-option-group">
              <h3>Weapons</h3>
              <div class="prototype-option-grid equipment-option-grid weapon-option-grid">
                <template v-for="weapon in optionalWeaponOptions" :key="weapon.id">
                  <div v-if="isPerModelWeaponSelection(weapon)" class="weapon-equipment-option count-option-card" :class="{ selected: weaponOptionSelected(weapon), unavailable: weaponUnavailable(weapon) }">
                    <span class="option-name">{{ formatHandWeaponCountLabel(weapon.name) }}</span>
                    <small v-if="weapon.note" class="option-effect">{{ weapon.note }}</small>
                    <strong v-if="weapon.points > 0" class="option-cost">{{ optionCost(weapon.points) }} / model</strong>
                    <span class="equipment-quantity-controls option-stepper weapon-option-quantity">
                      <button type="button" aria-label="Remove one model" :disabled="isReadOnly || weaponUnavailable(weapon) || weaponCount(weapon) <= 0" @click="adjustWeaponCount(weapon, -1)">−</button>
                      <strong>{{ weaponCount(weapon) }}</strong>
                      <button type="button" aria-label="Add one model" :disabled="isReadOnly || weaponUnavailable(weapon) || weaponCount(weapon) >= weaponCountMaximum(weapon)" @click="adjustWeaponCount(weapon, 1)">+</button>
                      <small>models</small>
                    </span>
                  </div>
                  <label v-else :class="{ selected: selectedWeaponIds.has(weapon.id), superseded: mundaneWeaponSuperseded(weapon), unavailable: weaponUnavailable(weapon) }">
                    <input type="checkbox" :checked="selectedWeaponIds.has(weapon.id)" :disabled="isReadOnly || mundaneWeaponSuperseded(weapon) || weaponUnavailable(weapon)" @change="handleWeaponCheckbox({ source: 'base', weapon }, $event)" />
                    <span class="option-name">{{ formatHandWeaponCountLabel(weapon.name) }}</span>
                    <small v-if="weapon.note" class="option-effect">{{ weapon.note }}</small>
                    <strong v-if="weapon.points > 0" class="option-cost">{{ optionCost(weapon.points) }}<small v-if="weapon.costMode === 'per-model' || weapon.perModel"> / model</small></strong>
                  </label>
                </template>
              </div>
            </section>
            <section v-for="group in equipmentGroups" :key="group.key" class="equipment-option-group">
              <div class="equipment-group-heading"><h3>{{ group.title }}</h3><span v-if="group.key === 'wizard' && magicalMaelstromEnabled && isWizard" class="rule-kind-pill magical-maelstrom-pill">Magical Maelstrom</span></div>
              <div class="prototype-option-grid equipment-option-grid">
                <template v-for="option in group.options" :key="option.id">
                  <div v-if="isPerModelEquipmentSelection(option)" class="weapon-equipment-option count-option-card" :class="{ selected: selectedEquipmentIds.has(option.id), superseded: mundaneEquipmentSuperseded(option) }">
                    <span class="option-name">{{ contextualOptionName(option) }}<small v-if="showOtherGeneralCurrent(option)" class="current-general-note"> (Current)</small></span>
                    <small v-if="option.note" class="option-effect">{{ option.note }}</small>
                    <strong v-if="option.points > 0" class="option-cost">{{ optionCost(option.points) }} / model</strong>
                    <span class="equipment-quantity-controls option-stepper">
                      <button type="button" aria-label="Remove one model" :disabled="isReadOnly || equipmentCount(option) <= 0" @click="adjustEquipmentCount(option, -1)">−</button>
                      <strong>{{ equipmentCount(option) }}</strong>
                      <button type="button" aria-label="Add one model" :disabled="isReadOnly || equipmentCount(option) >= equipmentCountMaximum(option)" @click="adjustEquipmentCount(option, 1)">+</button>
                      <small>models</small>
                    </span>
                  </div>
                  <label v-else :class="{ selected: selectedEquipmentIds.has(option.id), locked: equipmentOptionEffectivelyLocked(option), superseded: mundaneEquipmentSuperseded(option) }">
                    <input type="checkbox" :checked="selectedEquipmentIds.has(option.id)" :disabled="isReadOnly || equipmentOptionEffectivelyLocked(option) || mundaneEquipmentSuperseded(option) || (magicalMaelstromEnabled && isWizardLevelOption(option))" @change="handleEquipmentCheckbox(option, $event)" />
                    <span class="option-name">{{ contextualOptionName(option) }}<small v-if="showOtherGeneralCurrent(option)" class="current-general-note"> (Current)</small></span>
                    <small v-if="option.note" class="option-effect">{{ option.note }}</small>
                    <strong v-if="option.points > 0 || (magicalMaelstromEnabled && isWizardLevelOption(option))" class="option-cost">{{ magicalMaelstromEnabled && isWizardLevelOption(option) ? 'Free' : optionCost(option.points) }}<small v-if="!magicalMaelstromEnabled && (option.costMode === 'per-model' || option.perModel)"> / model</small></strong>
                  </label>
                </template>
              </div>
            </section>
            <section v-if="showWizardLoreGroup" class="equipment-option-group wizard-lore-group">
              <div class="equipment-group-heading"><h3>Wizards &amp; Magic</h3><span v-if="magicalMaelstromEnabled && isWizard" class="rule-kind-pill magical-maelstrom-pill">Magical Maelstrom</span></div>
              <div v-if="wizardLevelOptions.length" class="prototype-option-grid equipment-option-grid wizard-level-grid">
                <label v-for="option in wizardLevelOptions" :key="option.id" :class="{ selected: selectedEquipmentIds.has(option.id), locked: equipmentOptionEffectivelyLocked(option) }">
                  <input type="checkbox" :checked="selectedEquipmentIds.has(option.id)" :disabled="isReadOnly || equipmentOptionEffectivelyLocked(option) || (magicalMaelstromEnabled && isWizardLevelOption(option))" @change="handleEquipmentCheckbox(option, $event)" />
                  <span class="option-name">{{ displayOptionName(option) }}</span>
                  <small v-if="option.note" class="option-effect">{{ option.note }}</small>
                  <strong v-if="option.points > 0 || magicalMaelstromEnabled" class="option-cost">{{ magicalMaelstromEnabled ? 'Free' : optionCost(option.points) }}</strong>
                </label>
              </div>
              <div v-if="wizardMagicEquipmentOptions.length" class="prototype-option-grid equipment-option-grid wizard-magic-option-grid">
                <label v-for="option in wizardMagicEquipmentOptions" :key="option.id" :class="{ selected: selectedEquipmentIds.has(option.id), locked: equipmentOptionEffectivelyLocked(option) }">
                  <input type="checkbox" :checked="selectedEquipmentIds.has(option.id)" :disabled="isReadOnly || equipmentOptionEffectivelyLocked(option)" @change="handleEquipmentCheckbox(option, $event)" />
                  <span class="option-name">{{ displayOptionName(option) }}</span>
                  <small v-if="option.note" class="option-effect">{{ option.note }}</small>
                  <strong v-if="option.points > 0" class="option-cost">{{ optionCost(option.points) }}</strong>
                </label>
              </div>
              <div v-if="loreEquipmentOptions.length" class="prototype-option-grid equipment-option-grid lore-source-option-grid">
                <label v-for="option in loreEquipmentOptions" :key="option.id" :class="{ selected: selectedEquipmentIds.has(option.id), locked: equipmentOptionEffectivelyLocked(option) }">
                  <input type="checkbox" :checked="selectedEquipmentIds.has(option.id)" :disabled="isReadOnly || equipmentOptionEffectivelyLocked(option)" @change="handleEquipmentCheckbox(option, $event)" />
                  <span class="option-name">{{ formatLoreName(option.name) }}</span>
                  <strong v-if="option.points > 0" class="option-cost">{{ optionCost(option.points) }}</strong>
                </label>
              </div>
              <div v-if="loreChoices.length" class="lore-choice-grid" :class="{ unavailable: !loreSelectionEnabled }">
                <label v-for="lore in loreChoices" :key="lore" :class="{ selected: selectedLores.has(lore) }">
                  <input type="checkbox" :checked="selectedLores.has(lore)" :disabled="isReadOnly || !loreSelectionEnabled" @change="handleLoreCheckbox(lore, $event)" />
                  <span><strong>{{ formatLoreName(lore) }}</strong><small>{{ loreSelectionEnabled ? 'Add this lore to the model profile.' : 'Select a Wizard or Priest option first.' }}</small></span>
                </label>
              </div>
            </section>
          </div>
        </section>

        <section v-if="activeMagicPools.length" class="unit-card-section static-unit-section magic-items-section">
          <h2>Magical Items</h2>
          <div class="magic-pool-summaries" role="group" aria-label="Magic item allowance owner">
            <button v-for="pool in activeMagicPools" :key="pool.id" type="button" class="magic-purchase-head magic-pool-card" :class="{ active: selectedMagicPool?.id === pool.id }" :disabled="!isEditing" @click="selectMagicPool(pool.id)"><div><span class="magic-allowance-label">{{ pool.label }}</span><strong>{{ magicPoolPoints(pool.id) }} / {{ pool.maxPoints }} pts</strong></div><span>{{ Math.max(0, pool.maxPoints - magicPoolPoints(pool.id)) }} pts remaining</span></button>
          </div>
          <div v-if="isEditing" class="magic-add-row magic-picker-launch-row"><button class="secondary-button magic-picker-launch" type="button" :disabled="magicLoading || !selectedMagicPool" @click="openMagicPicker">{{ magicLoading ? 'Loading magical items…' : 'Choose Magical Items' }}</button></div>
          <p v-if="magicError" class="magic-error">{{ magicError }}</p>
          <div v-if="magicItemCards.length" class="magic-item-card-grid">
            <div v-for="entry in magicItemCards" :key="entry.item.id" class="selected-magic-rule-card">
              <RuleAbilityCard :rule="entry.rule" kind-label="Magical Item" />
              <div class="magic-item-card-actions">
                <span>{{ entry.item.ownerLabel }} · {{ entry.item.points * entry.count }} pts</span>
                <div v-if="isEditing && maxMagicCopies(entry.item) > 1" class="magic-quantity-controls option-stepper"><button type="button" aria-label="Remove one copy" @click="adjustMagicItem(entry.item.id, -1)">−</button><strong>{{ entry.count }}</strong><button type="button" aria-label="Add one copy" :disabled="!canAddMagicItem(entry.item)" @click="adjustMagicItem(entry.item.id, 1)">+</button></div>
                <button v-else-if="isEditing" type="button" class="magic-remove-button" @click="adjustMagicItem(entry.item.id, -entry.count)">Remove</button>
                <strong v-else-if="entry.count > 1" class="magic-view-quantity">×{{ entry.count }}</strong>
              </div>
            </div>
          </div>
        </section>

        <div v-if="magicPickerOpen" class="unit-picker-backdrop magic-picker-backdrop" @click.self="cancelMagicPicker">
          <section class="magic-picker-panel card-surface" role="dialog" aria-modal="true" aria-label="Select magical items">
            <div class="unit-picker-heading magic-picker-heading"><div><p class="eyebrow">MAGICAL ITEMS</p><h2>{{ magicPickerPool?.label }}</h2><small>{{ magicPickerSpent() }} / {{ magicPickerPool?.maxPoints }} pts · {{ magicPickerRemaining() }} remaining</small></div><button type="button" class="picker-close" @click="cancelMagicPicker" aria-label="Cancel magical item changes">×</button></div>
            <div class="magic-picker-tabs" role="tablist" aria-label="Magical item types"><button v-for="type in magicPickerTabs" :key="type" type="button" role="tab" :aria-selected="magicPickerTab === type" :class="{ active: magicPickerTab === type }" @click="magicPickerTab = type">{{ magicTypeLabel(type) }}</button></div>
            <div class="magic-picker-list">
              <article v-for="item in magicPickerItems" :key="item.id" class="magic-picker-item" :class="{ selected: magicPickerCount(item.id) > 0, unaffordable: !magicPickerCanSelect(item) }">
                <div class="magic-picker-item-main" @click="toggleMagicPickerDescription(item)">
                  <input type="checkbox" :checked="magicPickerCount(item.id) > 0" :disabled="!magicPickerCanSelect(item)" @click.stop @change="handleMagicPickerCheckbox(item, $event)" />
                  <span><strong>{{ item.name }}</strong><small>{{ magicPickerDetail(item)?.summary || magicPickerDetail(item)?.fluff || item.source }}</small></span>
                  <b>{{ item.points }} pts</b>
                  <span class="magic-picker-chevron" :class="{ open: magicPickerExpanded.has(item.id) }">⌄</span>
                </div>
                <div v-if="magicPickerExpanded.has(item.id)" class="magic-picker-description">
                  <p v-if="magicPickerDetail(item)?.fluff" class="magic-picker-fluff">{{ magicPickerDetail(item)?.fluff }}</p>
                  <p>{{ magicPickerDetail(item)?.summary || magicPickerDetail(item)?.fluff || 'Rule information is still loading.' }}</p>
                  <div v-if="maxMagicCopies(item) > 1 && magicPickerCount(item.id) > 0" class="magic-picker-quantity option-stepper"><button type="button" :disabled="magicPickerCount(item.id) <= 1" @click.stop="adjustMagicPickerCount(item, -1)">−</button><strong>{{ magicPickerCount(item.id) }}</strong><button type="button" :disabled="magicPickerCount(item.id) >= maxMagicCopies(item) || item.points > magicPickerRemaining()" @click.stop="adjustMagicPickerCount(item, 1)">+</button></div>
                </div>
              </article>
              <div v-if="!magicPickerItems.length" class="picker-empty">No items of this type are available to this model.</div>
            </div>
            <div class="unit-picker-batch-bar magic-picker-finish-bar"><span>{{ magicPickerSpent() }} / {{ magicPickerPool?.maxPoints }} pts selected</span><div><button type="button" class="secondary-button" @click="cancelMagicPicker">Cancel</button><button type="button" class="primary-button" @click="finishMagicPicker">Finished</button></div></div>
          </section>
        </div>

        <section class="unit-card-section static-unit-section special-rules-section"><h2>Special Rules</h2><div class="old-rule-grid"><RuleAbilityCard v-for="rule in packedSpecialRules" :key="`${rule.name}-${rule.path}`" :rule="rule" /></div></section>

        <section class="unit-details-panel card-surface"><div class="unit-details-heading-row"><h2>Unit Details</h2></div><div class="unit-details-grid"><div><small>Army</small><strong>{{ prototypeUnit.details.army || army?.name || '—' }}</strong></div><div><small>Unit category</small><strong>{{ prototypeUnit.details.unitCategory || prototypeUnit.category }}</strong></div><div><small>Troop type</small><strong>{{ prototypeUnit.details.troopType || '—' }}</strong></div><div><small>Base size</small><strong>{{ prototypeUnit.details.baseSize || '—' }}</strong></div><div><small>Publication</small><strong>{{ prototypeUnit.details.publication || '—' }}<template v-if="prototypeUnit.details.page">, p. {{ prototypeUnit.details.page }}</template></strong></div><div v-for="detail in prototypeUnit.additionalDetails || []" :key="detail.label"><small>{{ detail.label }}</small><strong>{{ detail.value }}</strong></div></div></section>

        <section class="unit-keywords-section"><div class="unit-keyword-heading"><h2>Keywords</h2></div><div class="unit-keyword-bar"><RouterLink v-for="keyword in unitKeywordLinks" :key="keyword.label" :to="`/rules/read${keyword.path}`">{{ keyword.label }}</RouterLink></div><p class="keyword-helper-note">Old.dex helper links. These are navigation aids, not an official Warhammer: The Old World keyword system.</p></section>
      </div>
    </template>
  </main>
</template>
