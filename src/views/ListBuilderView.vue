<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import BuilderUnitEntry from '../components/BuilderUnitEntry.vue'
import { armies, getArmy } from '../data/armies'
import { battleMarchLockedOptions, compositionOptions, compositionRules, compositionRuleLabel, emptyCompositionOptionState, normalizePointsForRule, pointPresetsForRule, type CompositionOptionId, type CompositionRuleId } from '../data/listBuilder'
import { prototypeUnitsForArmy, type BuilderCategory, type PrototypeUnit } from '../data/builderPrototype'
import { loadLiveArmyCatalog, loadLiveArmyCompositions, loadLiveUnitProfile } from '../data/liveBuilderUnits'
import type { BuilderRosterSelection } from '../services/builderRoster'
import { applyMagicalMaelstromToRosterSelection, createDefaultRosterSelection, removeMagicalMaelstromFromRosterSelection } from '../domain/loadout'
import { useRosterStore } from '../stores/rosterStore'
import { favoriteUnitIdsForArmy, toggleFavoriteUnit } from '../services/favorites'
import { loadCompositionRules, type CompositionRuleCatalog } from '../services/armyData'
import { validateRoster } from '../services/rosterValidation'
import { duplicateSavedArmyList, getSavedArmyList, updateSavedArmyList, savedArmyListRoute } from '../services/savedLists'
import { reportAppError } from '../services/appErrors'

const route = useRoute()
const router = useRouter()
const requestedArmy = computed(() => String(route.query.army || ''))
const selectedArmy = computed(() => getArmy(requestedArmy.value) || armies[0])
const liveCompositions = ref(selectedArmy.value.compositions)
const requestedComposition = computed(() => String(route.query.composition || ''))
const selectedComposition = computed(() => {
  const army = selectedArmy.value
  return liveCompositions.value.find((item) => item.id === requestedComposition.value) || liveCompositions.value[0] || army.compositions[0]
})
const listName = computed(() => String(route.query.name || '').trim() || selectedArmy.value.name)
const description = computed(() => String(route.query.description || '').trim())
const compositionRuleId = computed(() => String(route.query.rule || 'open-war') as CompositionRuleId)
const compositionRule = computed(() => compositionRuleLabel(compositionRuleId.value))
const selectedOptions = computed(() => {
  const ids = new Set(String(route.query.options || '').split(',').map((value) => value.trim()).filter(Boolean))
  return compositionOptions.filter((option) => ids.has(option.value))
})
const points = computed(() => {
  const parsed = Number(route.query.points || 2000)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 2000
})
type DisplayCategory = 'General' | 'Battle Standard Bearer' | Exclude<BuilderCategory, 'General'>
const selectedOptionIds = computed(() => new Set(selectedOptions.value.map((option) => option.value)))
const standardCategories = computed<Array<Exclude<BuilderCategory, 'General'>>>(() => {
  const rows: Array<Exclude<BuilderCategory, 'General'>> = ['Characters', 'Core', 'Special', 'Rare']
  if (selectedOptionIds.value.has('allow-mercenaries')) rows.push('Mercenaries')
  if (selectedOptionIds.value.has('allow-allies')) rows.push('Allies')
  if (selectedOptionIds.value.has('allow-custom-units')) rows.push('Custom Units')
  return rows
})
const builderPath = computed(() => route.fullPath)
const savedListId = computed(() => String(route.query.list || ''))

const pickerCategory = ref<BuilderCategory | null>(null)
const pickerSearch = ref('')
const sortMode = ref<'name' | 'points'>('name')
const favoritesOnly = ref(false)
const favoriteIds = ref(new Set<string>())
const availableUnits = ref<PrototypeUnit[]>([])
const catalogLoading = ref(false)
const catalogError = ref('')
const { rows: roster, persist: persistRoster } = useRosterStore(builderPath)
const compositionRuleData = ref<CompositionRuleCatalog | null>(null)
const validationDataError = ref('')
const settingsOpen = ref(false)
const addingUnitId = ref('')
const pickerSelectedIds = ref(new Set<string>())
const pickerAdding = ref(false)
const listLocked = ref(false)
const settingsName = ref('')
const settingsComposition = ref('')
const settingsRule = ref<CompositionRuleId>('open-war')
const settingsPoints = ref(2000)
const settingsPointPresets = computed(() => pointPresetsForRule(settingsRule.value))
const settingsOptionState = ref<Record<CompositionOptionId, boolean>>(emptyCompositionOptionState())

async function loadCompositions() {
  liveCompositions.value = selectedArmy.value.compositions
  try { liveCompositions.value = await loadLiveArmyCompositions(selectedArmy.value.dataKey, selectedArmy.value.compositions) } catch (error) { reportAppError(error, 'LIST_BUILDER_COMPOSITIONS', { army: selectedArmy.value.slug }) /* static list remains available */ }
}


function applyCompositionEffectsToRoster() {
  if (!availableUnits.value.length || !roster.value.length) return
  const maelstrom = selectedOptionIds.value.has('magical-maelstrom')
  const definitions = new Map(availableUnits.value.map((unit) => [unit.id, unit]))
  const next = roster.value.map((row) => {
    const unit = definitions.get(row.unitId)
    if (!unit) return row
    return maelstrom ? applyMagicalMaelstromToRosterSelection(unit, row) : removeMagicalMaelstromFromRosterSelection(unit, row)
  })
  if (JSON.stringify(next) !== JSON.stringify(roster.value)) roster.value = next
}

async function loadCatalog() {
  catalogLoading.value = true
  catalogError.value = ''
  try {
    availableUnits.value = await loadLiveArmyCatalog(selectedArmy.value.dataKey, selectedArmy.value.name, selectedComposition.value.id)
    if (roster.value.length) {
      const byId = new Map(availableUnits.value.map((unit) => [unit.id, unit]))
      roster.value = roster.value.map((row) => {
        const unit = byId.get(row.unitId)
        return unit && unit.category !== row.category ? { ...row, category: unit.category } : row
      })
      applyCompositionEffectsToRoster()
    }
  } catch (error) {
    reportAppError(error, 'LIST_BUILDER_CATALOG', { army: selectedArmy.value.slug, composition: selectedComposition.value.id })
    catalogError.value = error instanceof Error ? error.message : 'The current army data could not be loaded.'
    availableUnits.value = prototypeUnitsForArmy(selectedArmy.value.slug)
  } finally {
    favoriteIds.value = favoriteUnitIdsForArmy(selectedArmy.value.slug)
    catalogLoading.value = false
  }
}

function loadRosterMetadata() {
  const saved = savedListId.value ? getSavedArmyList(savedListId.value) : null
  listLocked.value = Boolean(saved?.locked)
  const normalized = roster.value.map((row) => row.category === 'General'
    ? { ...row, category: 'Characters' as const, options: [...new Set([...(row.options || []), 'General'])] }
    : row)
  if (normalized.some((row, index) => row !== roster.value[index])) roster.value = normalized
}
watch(builderPath, loadRosterMetadata)
watch(savedListId, loadRosterMetadata)
watch(() => selectedArmy.value.slug, () => { void loadCompositions() })
watch(() => [selectedArmy.value.slug, selectedComposition.value.id], loadCatalog)
watch(() => String(route.query.options || ''), () => applyCompositionEffectsToRoster())
onMounted(() => {
  loadRosterMetadata()
  void loadCompositions()
  void loadCatalog()
  void loadValidationData()
})

const filteredPickerUnits = computed(() => {
  const query = pickerSearch.value.trim().toLowerCase()
  let rows = availableUnits.value.filter((unit) => unit.category === pickerCategory.value)
  if (query) rows = rows.filter((unit) => unit.name.toLowerCase().includes(query))
  if (favoritesOnly.value) rows = rows.filter((unit) => favoriteIds.value.has(unit.id))
  return [...rows].sort((a, b) => sortMode.value === 'points' ? startingUnitPoints(a) - startingUnitPoints(b) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name))
})
function startingUnitPoints(unit: PrototypeUnit) {
  return createDefaultRosterSelection(unit, 'points-preview', { magicalMaelstrom: selectedOptionIds.value.has('magical-maelstrom') }).totalPoints
}
const rosterPoints = computed(() => roster.value.reduce((sum, row) => sum + row.totalPoints, 0))
const remainingPoints = computed(() => points.value - rosterPoints.value)
const rosterPercentUsed = computed(() => points.value > 0 ? Math.round((rosterPoints.value / points.value) * 1000) / 10 : 0)
const remainingPercent = computed(() => points.value > 0 ? Math.round((Math.abs(remainingPoints.value) / points.value) * 1000) / 10 : 0)
const validationIssues = computed(() => {
  const issues = validateRoster({ roster: roster.value, points: points.value, armySlug: selectedArmy.value.slug, compositionId: selectedComposition.value.id, compositionRuleId: compositionRuleId.value, ruleCatalog: compositionRuleData.value, compositionOptionIds: selectedOptions.value.map((option) => option.value) })
  if (!catalogLoading.value && !catalogError.value && availableUnits.value.length) {
    const allowed = new Set(availableUnits.value.map((unit) => unit.id))
    roster.value.filter((row) => !allowed.has(row.unitId)).forEach((row) => issues.push({ severity: 'error', section: row.category, instanceId: row.instanceId, message: `${row.name} is not available in ${selectedComposition.value.name}.` }))
  }
  return issues
})
const validationState = computed(() => rosterPoints.value > points.value ? 'OVER LIMIT' : validationIssues.value.some((issue) => issue.severity === 'error') ? 'INVALID' : rosterPoints.value === 0 ? 'EMPTY' : 'VALID')
const invalidInstanceIds = computed(() => new Set(validationIssues.value.filter((issue) => issue.severity === 'error' && issue.instanceId).map((issue) => String(issue.instanceId))))
function rosterMagicPools(row: BuilderRosterSelection) {
  if (row.magicPools?.length) return row.magicPools.filter((pool) => Number(pool.maxPoints) > 0)
  const unit = availableUnits.value.find((candidate) => candidate.id === row.unitId)
  if (!unit) return []
  const selected = new Set(row.equipmentIds || [])
  const pools: Array<{ ownerId: string; ownerLabel: string; maxPoints: number }> = []
  if (unit.magicAllowance && Number(unit.magicAllowance.maxPoints) > 0) pools.push({ ownerId: 'unit', ownerLabel: unit.name, maxPoints: Number(unit.magicAllowance.maxPoints) })
  unit.equipmentOptions.filter((option) => selected.has(option.id) && option.magicAllowance && Number(option.magicAllowance.maxPoints) > 0).forEach((option) => {
    pools.push({ ownerId: option.id, ownerLabel: option.name, maxPoints: Number(option.magicAllowance?.maxPoints || 0) })
  })
  return pools
}
const untouchedMagicPools = computed(() => roster.value.flatMap((row) => rosterMagicPools(row).filter((pool) => {
  const spent = (row.magicItems || []).filter((item) => (item.ownerId || 'unit') === pool.ownerId).reduce((sum, item) => sum + Number(item.points || 0) * Math.max(1, Number(item.count || 1)), 0)
  return pool.maxPoints > 0 && spent === 0
}).map((pool) => ({ row, pool }))))
const hasMagicAllowanceWarning = computed(() => validationState.value === 'VALID' && untouchedMagicPools.value.length > 0)
async function loadValidationData() {
  validationDataError.value = ''
  try { compositionRuleData.value = await loadCompositionRules() } catch (error) { reportAppError(error, 'LIST_BUILDER_COMPOSITION_RULES'); validationDataError.value = error instanceof Error ? error.message : 'Composition rules could not be loaded.' }
}

function hasRole(row: BuilderRosterSelection, pattern: RegExp) { return (row.options || []).some((option) => pattern.test(option.replace(/\s*[×x]\d+\s*$/, '').trim())) }
function isCharacter(row: BuilderRosterSelection) { return row.category === 'Characters' || row.category === 'General' }
function isGeneral(row: BuilderRosterSelection) { return isCharacter(row) && hasRole(row, /^General$/i) }
function isBattleStandardBearer(row: BuilderRosterSelection) { return isCharacter(row) && hasRole(row, /^Battle Standard Bearer$/i) }
const categories = computed<DisplayCategory[]>(() => {
  const rows: DisplayCategory[] = []
  if (roster.value.some(isGeneral)) rows.push('General')
  if (roster.value.some((row) => !isGeneral(row) && isBattleStandardBearer(row))) rows.push('Battle Standard Bearer')
  rows.push(...standardCategories.value)
  return rows
})
function unitsInCategory(category: DisplayCategory) {
  if (category === 'General') return roster.value.filter(isGeneral)
  if (category === 'Battle Standard Bearer') return roster.value.filter((row) => !isGeneral(row) && isBattleStandardBearer(row))
  if (category === 'Characters') return roster.value.filter((row) => isCharacter(row) && !isGeneral(row) && !isBattleStandardBearer(row))
  return roster.value.filter((row) => row.category === category)
}
function categoryPoints(category: DisplayCategory) {
  if (category === 'Characters') return roster.value.filter(isCharacter).reduce((sum, row) => sum + row.totalPoints, 0)
  return unitsInCategory(category).reduce((sum, row) => sum + row.totalPoints, 0)
}
function isRoleDisplayCategory(category: DisplayCategory) { return category === 'General' || category === 'Battle Standard Bearer' }
function categorySelectedCount(category: DisplayCategory) { return category === 'Characters' ? roster.value.filter(isCharacter).length : unitsInCategory(category).length }
function categoryRuleKey(category: DisplayCategory) { return category === 'Characters' ? 'characters' : category === 'Custom Units' ? 'custom-units' : category.toLowerCase() }
function categoryRulePoints(category: DisplayCategory) {
  if (category === 'Characters') return roster.value.filter(isCharacter).reduce((sum, row) => sum + row.totalPoints, 0)
  return categoryPoints(category)
}
function categoryPercent(category: DisplayCategory) {
  return points.value > 0 ? Math.round((categoryRulePoints(category) / points.value) * 1000) / 10 : 0
}
function categoryAllowance(category: DisplayCategory) {
  if (category === 'General' || category === 'Battle Standard Bearer') return null
  const composition = compositionRuleData.value?.[selectedComposition.value.id] || compositionRuleData.value?.['grand-army']
  const rules = composition?.[categoryRuleKey(category)]
  if (!rules) return null
  const spent = categoryRulePoints(category)
  if (category === 'Core' && typeof rules.minPercent === 'number') {
    const minimum = Math.ceil(points.value * rules.minPercent / 100)
    const toMinimum = Math.max(0, minimum - spent)
    return { text: toMinimum > 0 ? `${toMinimum} pts required — ${rules.minPercent}% minimum` : `${minimum} pts minimum met — ${rules.minPercent}% minimum`, state: toMinimum > 0 ? 'required' : 'met' }
  }
  if (typeof rules.maxPercent === 'number') {
    const maximum = Math.floor(points.value * rules.maxPercent / 100)
    const left = maximum - spent
    return { text: left >= 0 ? `${left} pts left — ${rules.maxPercent}% maximum` : `${Math.abs(left)} pts over — ${rules.maxPercent}% maximum`, state: left >= 0 ? 'left' : 'over' }
  }
  if (typeof rules.minPercent === 'number') {
    const minimum = Math.ceil(points.value * rules.minPercent / 100)
    const toMinimum = Math.max(0, minimum - spent)
    return { text: toMinimum > 0 ? `${toMinimum} pts required — ${rules.minPercent}% minimum` : `${minimum} pts minimum met — ${rules.minPercent}% minimum`, state: toMinimum > 0 ? 'required' : 'met' }
  }
  return null
}
function openPicker(category: DisplayCategory) {
  if (listLocked.value || category === 'General' || category === 'Battle Standard Bearer' || category === 'Custom Units') return
  pickerCategory.value = category
  pickerSearch.value = ''
  pickerSelectedIds.value = new Set()
}
async function closePicker() {
  if (pickerAdding.value) return
  if (pickerSelectedIds.value.size) { await addSelectedUnits(); return }
  pickerCategory.value = null
  pickerSelectedIds.value = new Set()
}
function cancelPicker() {
  if (pickerAdding.value) return
  pickerCategory.value = null
  pickerSelectedIds.value = new Set()
}
function pickerUnitSelected(id: string) { return pickerSelectedIds.value.has(id) }
function togglePickerUnit(id: string) {
  if (pickerAdding.value) return
  const next = new Set(pickerSelectedIds.value)
  if (next.has(id)) next.delete(id); else next.add(id)
  pickerSelectedIds.value = next
}
function defaultRosterSelection(unit: PrototypeUnit): BuilderRosterSelection {
  return createDefaultRosterSelection(unit, `${unit.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, { magicalMaelstrom: selectedOptionIds.value.has('magical-maelstrom') })
}
function removeGeneralRole(row: BuilderRosterSelection) {
  const definition = availableUnits.value.find((unit) => unit.id === row.unitId)
  const generalIds = new Set((definition?.equipmentOptions || []).filter((option) => option.kind === 'role' && /^General$/i.test(option.name)).map((option) => option.id))
  return {
    ...row,
    options: (row.options || []).filter((value) => !/^General$/i.test(String(value).trim())),
    includedEquipment: (row.includedEquipment || []).filter((value) => !/^General$/i.test(String(value).trim())),
    optionalSelections: (row.optionalSelections || []).filter((value) => !/^General$/i.test(String(value).trim())),
    equipmentIds: (row.equipmentIds || []).filter((id) => !generalIds.has(id) && !/(?:^|[-_.])general$/i.test(id)),
  }
}
function appendRosterSelection(selection: BuilderRosterSelection) {
  if (selection.mustBeGeneral) roster.value = [...roster.value.map(removeGeneralRole), selection]
  else roster.value = [...roster.value, selection]
}

async function addUnitToRoster(unit: PrototypeUnit) {
  addingUnitId.value = unit.id
  try {
    const detailed = await loadLiveUnitProfile(selectedArmy.value.dataKey, selectedArmy.value.name, unit.id, selectedComposition.value.id)
    appendRosterSelection(defaultRosterSelection(detailed || unit))
  } catch (error) {
    reportAppError(error, 'LIST_BUILDER_UNIT_DETAIL', { unitId: unit.id, army: selectedArmy.value.slug })
    appendRosterSelection(defaultRosterSelection(unit))
  } finally {
    addingUnitId.value = ''
  }
}
async function addSelectedUnits() {
  if (listLocked.value || pickerAdding.value || !pickerSelectedIds.value.size) return
  const selected = availableUnits.value.filter((unit) => pickerSelectedIds.value.has(unit.id))
  if (!selected.length) return
  pickerAdding.value = true
  try {
    for (const unit of selected) await addUnitToRoster(unit)
    pickerSelectedIds.value = new Set()
    pickerCategory.value = null
  } finally {
    pickerAdding.value = false
    addingUnitId.value = ''
  }
}
function removeUnit(instanceId: string) { if (!listLocked.value) roster.value = roster.value.filter((row) => row.instanceId !== instanceId) }
function duplicateUnit(row: BuilderRosterSelection) { if (!listLocked.value) roster.value = [...roster.value, { ...row, instanceId: `${row.unitId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }] }
function toggleFavorite(id: string) { toggleFavoriteUnit(selectedArmy.value.slug, id); favoriteIds.value = favoriteUnitIdsForArmy(selectedArmy.value.slug) }

function toggleListLock() {
  if (!savedListId.value) return
  listLocked.value = !listLocked.value
  updateSavedArmyList(savedListId.value, { locked: listLocked.value })
  if (listLocked.value) { settingsOpen.value = false; cancelPicker() }
}
async function duplicateCurrentList() {
  if (!savedListId.value) return
  persistRoster()
  const copy = duplicateSavedArmyList(savedListId.value)
  if (copy) await router.push(savedArmyListRoute(copy))
}

function openSettings() {
  if (listLocked.value) return
  settingsName.value = listName.value
  settingsComposition.value = selectedComposition.value.id
  settingsRule.value = compositionRuleId.value
  settingsPoints.value = points.value
  const selected = new Set(selectedOptions.value.map((option) => option.value))
  for (const option of compositionOptions) settingsOptionState.value[option.value] = selected.has(option.value)
  for (const option of battleMarchLockedOptions) settingsOptionState.value[option] = settingsRule.value === 'battle-march'
  normalizeSettingsAvailability()
  settingsOpen.value = true
}
const settingsCompositionRules = computed(() => {
  const direct = compositionRuleData.value?.[settingsComposition.value]
  if (direct) return direct
  const selected = liveCompositions.value.find((item) => item.id === settingsComposition.value)
  return selected?.name === 'Grand Army' ? (compositionRuleData.value?.['grand-army'] || null) : null
})
function settingsOptionAvailable(option: CompositionOptionId) {
  if (option === 'allow-allies') return Boolean(settingsCompositionRules.value?.allies)
  if (option === 'allow-mercenaries') return Boolean(settingsCompositionRules.value?.mercenaries)
  return true
}
function normalizeSettingsAvailability() {
  for (const option of ['allow-allies', 'allow-mercenaries'] as CompositionOptionId[]) if (!settingsOptionAvailable(option)) settingsOptionState.value[option] = false
}
function settingsOptionLocked(option: CompositionOptionId) { return settingsRule.value === 'battle-march' && battleMarchLockedOptions.has(option) }
function settingsOptionDisabled(option: CompositionOptionId) { return settingsOptionLocked(option) || !settingsOptionAvailable(option) }
function toggleSettingsOption(option: CompositionOptionId, checked: boolean) {
  if (settingsOptionDisabled(option)) return
  settingsOptionState.value[option] = checked
  if (checked && option === 'limit-magical-items-75') settingsOptionState.value['limit-magical-items-50'] = false
  if (checked && option === 'limit-magical-items-50') settingsOptionState.value['limit-magical-items-75'] = false
}
function handleSettingsOption(option: CompositionOptionId, event: Event) { toggleSettingsOption(option, Boolean((event.target as HTMLInputElement | null)?.checked)) }
watch(settingsRule, (rule) => {
  settingsPoints.value = normalizePointsForRule(rule, settingsPoints.value)
  for (const option of battleMarchLockedOptions) settingsOptionState.value[option] = rule === 'battle-march'
  normalizeSettingsAvailability()
})
watch(settingsComposition, normalizeSettingsAvailability)
async function applySettings() {
  const composition = liveCompositions.value.find((item) => item.id === settingsComposition.value) || liveCompositions.value[0] || selectedArmy.value.compositions[0]
  const optionIds = compositionOptions.filter((option) => settingsOptionState.value[option.value] && settingsOptionAvailable(option.value)).map((option) => option.value)
  const query: Record<string, string> = {
    army: selectedArmy.value.slug,
    composition: composition.id,
    rule: settingsRule.value,
    points: String(Math.max(0, settingsPoints.value || 0)),
    name: settingsName.value.trim() || selectedArmy.value.name,
  }
  if (savedListId.value) query.list = savedListId.value
  if (description.value) query.description = description.value
  if (optionIds.length) query.options = optionIds.join(',')
  if (savedListId.value) updateSavedArmyList(savedListId.value, { name: String(query.name), army: selectedArmy.value.slug, armyName: selectedArmy.value.name, composition: composition.id, compositionName: composition.name, rule: settingsRule.value, points: Number(query.points), options: optionIds })
  settingsOpen.value = false
  await router.replace({ name: 'list-builder', query })
}
</script>

<template>
  <main class="page list-builder-page">
    <AppHeader compact back-to="/lists" prefer-back-to />

    <div class="builder-title-row">
      <div class="page-title-block builder-page-title">
        <p class="eyebrow">ARMY BUILDER</p>
        <h1>{{ listName }}</h1>
        <div class="builder-list-meta" aria-label="List setup summary">
          <span class="app-option-label">{{ selectedArmy.name }}</span><span class="app-option-label">{{ selectedComposition?.name || 'Grand Army' }}</span><span class="app-option-label">{{ compositionRule }}</span><span v-for="option in selectedOptions" :key="option.value" class="app-option-label composition-selected-label">{{ option.label }}</span>
        </div>
        <p v-if="description" class="builder-list-description">{{ description }}</p>
      </div>
      <div class="builder-points-orb" :class="{ over: remainingPoints < 0 }"><strong>{{ rosterPoints }}</strong><span>/ {{ points }}</span><small>{{ rosterPercentUsed }}% used</small><small>{{ remainingPoints >= 0 ? `${remainingPoints} remaining — ${remainingPercent}%` : `${Math.abs(remainingPoints)} over — ${remainingPercent}%` }}</small></div>
    </div>

    <section class="builder-command-strip card-surface">
      <div class="builder-toolbar" aria-label="List tools"><button type="button" class="builder-tool" disabled title="Import is not available in this build"><span>Import</span><small>Coming later</small></button><button type="button" class="builder-tool" disabled title="Export is not available in this build"><span>Export</span><small>Coming later</small></button><button type="button" class="builder-tool" @click="duplicateCurrentList"><span>Duplicate</span><small>Copy list</small></button><button type="button" class="builder-tool" :disabled="listLocked" @click="openSettings"><span>Settings</span><small>List setup</small></button><button type="button" class="builder-tool" disabled title="Game View is not available in this build"><span>Game View</span><small>Coming later</small></button><button type="button" class="builder-tool builder-lock-tool" :class="{ active: listLocked }" @click="toggleListLock"><span>{{ listLocked ? 'Unlock Editing' : 'Lock List' }}</span><small>{{ listLocked ? 'Editing off' : 'Editing on' }}</small></button></div>
      <div class="builder-validation-row"><span><strong>Army validation</strong><small>{{ validationIssues.length ? `${validationIssues.filter((issue) => issue.severity === 'error').length} rule issue${validationIssues.filter((issue) => issue.severity === 'error').length === 1 ? '' : 's'} to resolve.` : hasMagicAllowanceWarning ? `Roster is valid; ${untouchedMagicPools.length} magic-item allowance${untouchedMagicPools.length === 1 ? '' : 's'} remain completely unspent.` : 'General, category percentages and composition requirements are satisfied.' }}</small></span><span class="validation-state-text" :class="{ danger: validationState === 'OVER LIMIT' || validationState === 'INVALID', valid: validationState === 'VALID' && !hasMagicAllowanceWarning, warning: hasMagicAllowanceWarning }">{{ validationState }}</span></div>
      <div v-if="validationDataError" class="builder-validation-warning">{{ validationDataError }}</div>
      <ul v-if="validationIssues.length" class="builder-validation-list"><li v-for="(issue, index) in validationIssues" :key="`${issue.section}-${index}-${issue.message}`" :class="issue.severity"><span class="validation-section-label">{{ issue.section }}</span><span class="validation-issue-message">{{ issue.message }}</span></li></ul>
    </section>

    <section class="builder-roster-shell card-surface">
      <div class="builder-roster-toolbar"><div><p class="eyebrow roster-heading">ROSTER <span v-if="hasMagicAllowanceWarning" class="roster-validation-mark warning" aria-label="Roster valid with unspent magic-item allowance">!</span><span v-else-if="validationState === 'VALID'" class="roster-validation-mark valid" aria-label="Roster valid">✓</span><span v-else-if="validationState === 'INVALID' || validationState === 'OVER LIMIT'" class="roster-validation-mark invalid" aria-label="Roster invalid">×</span></p><h2>{{ selectedArmy.name }}</h2></div><span class="builder-roster-total">{{ roster.length }} unit{{ roster.length === 1 ? '' : 's' }} · {{ rosterPoints }} pts</span></div>
      <p v-if="catalogError" class="builder-data-note danger-note">{{ catalogError }}</p>
      <p v-else class="builder-data-note">Unit names, base costs, composition availability and option lists are loaded from the current Builder dataset for {{ selectedArmy.name }}.</p>

      <div class="builder-category-stack">
        <details v-for="category in categories" :key="category" class="builder-category-card" :open="unitsInCategory(category).length > 0 || category === 'Characters' || category === 'Core' || category === 'Custom Units'">
          <summary class="builder-category-summary"><span>{{ category }}</span><span v-if="!isRoleDisplayCategory(category)" class="builder-category-summary-meta"><small>{{ categorySelectedCount(category) }} selected</small><span class="category-meta-separator" aria-hidden="true">—</span><strong>{{ categoryPoints(category) }} pts — {{ categoryPercent(category) }}%</strong><template v-if="categoryAllowance(category)"><span class="category-meta-separator" aria-hidden="true">/</span><em class="category-allowance" :class="`is-${categoryAllowance(category)?.state}`">{{ categoryAllowance(category)?.text }}</em></template></span></summary>
          <div class="builder-category-body">
            <div v-if="unitsInCategory(category).length" class="builder-unit-stack">
              <BuilderUnitEntry v-for="row in unitsInCategory(category)" :key="row.instanceId" :row="row" :army-slug="selectedArmy.slug" :return-path="route.fullPath" :composition-id="selectedComposition.id" :locked="listLocked" :invalid="invalidInstanceIds.has(row.instanceId)" @remove="removeUnit(row.instanceId)" @duplicate="duplicateUnit(row)" />
            </div>
            <div v-else-if="category === 'Custom Units'" class="builder-category-empty custom-unit-placeholder">Custom unit creation will be added in a later build.</div>
            <div v-else class="builder-category-empty">No {{ category.toLowerCase() }} selected.</div>
            <button v-if="category !== 'General' && category !== 'Battle Standard Bearer' && category !== 'Custom Units'" type="button" class="builder-add-unit" :disabled="listLocked" @click="openPicker(category)">+ Add {{ category === 'Characters' ? 'character' : 'unit' }}</button>
          </div>
        </details>
      </div>
    </section>

    <div v-if="pickerCategory" class="unit-picker-backdrop" @click.self="closePicker">
      <section class="unit-picker-panel card-surface" role="dialog" aria-modal="true" :aria-label="`Add ${pickerCategory}`">
        <div class="unit-picker-heading"><div><p class="eyebrow">{{ pickerCategory }}</p><h2>Select Units</h2></div><button type="button" class="picker-close" @click="closePicker" aria-label="Close unit picker">×</button></div>
        <div class="unit-picker-controls"><label class="picker-search"><span>Search</span><input v-model="pickerSearch" type="search" placeholder="Search units" /></label><button type="button" :class="{ active: favoritesOnly }" @click="favoritesOnly = !favoritesOnly">★ Favorites</button><button type="button" @click="sortMode = sortMode === 'name' ? 'points' : 'name'">Sort: {{ sortMode === 'name' ? 'Name' : 'Points' }}</button></div>
        <div v-if="catalogLoading" class="picker-empty">Loading current army units…</div>
        <div v-else-if="filteredPickerUnits.length" class="unit-picker-list">
          <article v-for="unit in filteredPickerUnits" :key="unit.id" class="unit-picker-row" :class="{ 'is-selected': pickerUnitSelected(unit.id) }">
            <button type="button" class="unit-picker-favourite" :class="{ active: favoriteIds.has(unit.id) }" @click.stop="toggleFavorite(unit.id)" :aria-label="`Favorite ${unit.name}`">★</button>
            <button type="button" class="picker-unit-main" :disabled="pickerAdding" :aria-pressed="pickerUnitSelected(unit.id)" @click="togglePickerUnit(unit.id)"><span><strong>{{ unit.name }}</strong><small>{{ unit.unitSize }} · {{ unit.category }}</small><small v-if="unit.compositionNotes?.length" class="picker-composition-note">{{ unit.compositionNotes.join(' • ') }}</small></span></button><span class="unit-picker-points">{{ startingUnitPoints(unit) }} pts</span>
            <div class="unit-picker-actions"><button type="button" class="builder-mini-action primary icon-only-action" :class="{ selected: pickerUnitSelected(unit.id) }" :disabled="pickerAdding" :aria-label="`${pickerUnitSelected(unit.id) ? 'Remove' : 'Select'} ${unit.name}`" :title="pickerUnitSelected(unit.id) ? 'Selected' : 'Select'" @click="togglePickerUnit(unit.id)"><svg v-if="pickerUnitSelected(unit.id)" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg><svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button><RouterLink class="builder-mini-action icon-only-action" :to="`/army/${selectedArmy.slug}/unit/${unit.id}?return=${encodeURIComponent(route.fullPath)}&composition=${encodeURIComponent(selectedComposition.id)}&mode=view`" :aria-label="`View ${unit.name}`" title="View"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.6"/></svg></RouterLink></div>
          </article>
        </div>
        <div v-else class="picker-empty">No matching units.</div>
        <div class="unit-picker-batch-bar">
          <span>{{ pickerSelectedIds.size }} selected</span>
          <div><button type="button" class="secondary-button" :disabled="pickerAdding" @click="cancelPicker">Cancel</button><button type="button" class="primary-button" :disabled="pickerAdding" @click="pickerSelectedIds.size ? addSelectedUnits() : closePicker()">{{ pickerAdding ? 'Adding…' : 'Done' }}</button></div>
        </div>
      </section>
    </div>

    <div v-if="settingsOpen" class="unit-picker-backdrop" @click.self="settingsOpen = false">
      <section class="list-settings-panel card-surface" role="dialog" aria-modal="true" aria-label="Army list settings">
        <div class="unit-picker-heading"><div><p class="eyebrow">LIST SETTINGS</p><h2>Army List Setup</h2></div><button type="button" class="picker-close" @click="settingsOpen = false" aria-label="Close list settings">×</button></div>
        <div class="list-settings-fields">
          <label class="field-label">List name<input v-model="settingsName" class="field-control" type="text" maxlength="100" /></label>
          <label class="field-label">Army composition<select v-model="settingsComposition" class="field-control"><option v-for="composition in liveCompositions" :key="composition.id" :value="composition.id">{{ composition.name }}</option></select></label>
          <label class="field-label">Composition rule<select v-model="settingsRule" class="field-control"><option v-for="rule in compositionRules" :key="rule.value" :value="rule.value">{{ rule.label }}</option></select></label>
          <div class="points-field-wrap"><label class="field-label">Points limit<input v-model.number="settingsPoints" class="field-control" type="number" inputmode="numeric" :min="settingsRule === 'battle-march' ? 500 : 0" :max="settingsRule === 'battle-march' ? 750 : 10000" step="50" /></label><div class="point-presets" aria-label="Quick points presets"><button v-for="preset in settingsPointPresets" :key="preset" type="button" :class="['point-preset', { active: settingsPoints === preset }]" @click="settingsPoints = preset">{{ preset }}</button></div><p v-if="settingsRule === 'battle-march'" class="form-note points-rule-note">Battle March uses 500–750 point armies.</p></div>
          <fieldset class="composition-options" aria-label="Composition options"><legend>Composition options</legend><label v-for="option in compositionOptions" :key="option.value" class="composition-option" :class="{ locked: settingsOptionLocked(option.value), unavailable: !settingsOptionAvailable(option.value) }"><input type="checkbox" :checked="settingsOptionState[option.value]" :disabled="settingsOptionDisabled(option.value)" @change="handleSettingsOption(option.value, $event)" /><span>{{ option.label }}</span><small v-if="settingsOptionLocked(option.value)">Required</small><small v-else-if="!settingsOptionAvailable(option.value)">Not available</small></label></fieldset>
        </div>
        <div class="list-settings-actions"><button type="button" class="secondary-button" @click="settingsOpen = false">Cancel</button><button type="button" class="primary-button" @click="applySettings">Apply settings</button></div>
      </section>
    </div>
  </main>
</template>
