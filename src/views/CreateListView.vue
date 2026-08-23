<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { createSavedArmyList } from '../services/savedLists'
import { armies, getArmy, type ArmyComposition } from '../data/armies'
import { loadLiveArmyCompositions } from '../data/liveBuilderUnits'
import {
  battleMarchLockedOptions,
  compositionOptionDescription,
  compositionOptions,
  emptyCompositionOptionState,
  compositionRules,
  normalizePointsForRule,
  pointPresetsForRule,
  type CompositionOptionId,
  type CompositionRuleId,
} from '../data/listBuilder'
import { loadCompositionRules, type CompositionRuleCatalog } from '../services/armyData'
import { reportAppError } from '../services/appErrors'

const route = useRoute()
const router = useRouter()
const requestedArmy = String(route.query.army || '')
const initialArmy = armies.some((item) => item.slug === requestedArmy) ? requestedArmy : ''

const army = ref(initialArmy)
const listName = ref('')
const description = ref('')
const compositionRule = ref<CompositionRuleId | ''>('')
const points = ref<number | null>(null)
const armyComposition = ref('')
const compositionOptionState = ref<Record<CompositionOptionId, boolean>>(emptyCompositionOptionState())
const compositionRuleData = ref<CompositionRuleCatalog | null>(null)

const selectedArmy = computed(() => getArmy(army.value))
const availableCompositions = ref<ArmyComposition[]>(selectedArmy.value?.compositions || [])
const pointPresets = computed(() => compositionRule.value ? pointPresetsForRule(compositionRule.value) : [])
const pointMinimum = computed(() => compositionRule.value === 'battle-march' ? 500 : 0)
const pointMaximum = computed(() => compositionRule.value === 'battle-march' ? 750 : 10000)
const listNamePlaceholder = computed(() => selectedArmy.value?.name || 'My Old World Army')
const selectedCompositionOptions = computed(() => compositionOptions.filter((option) => compositionOptionState.value[option.value]))
const selectedCompositionOptionDetails = computed(() => selectedCompositionOptions.value.map((option) => ({ ...option, description: compositionOptionDescription(option.value) })).filter((option) => option.description))
const displayCompositions = computed(() => {
  const seen = new Set<string>()
  return availableCompositions.value.filter((item) => {
    const key = item.name.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
})
const activeCompositionRules = computed(() => {
  const direct = compositionRuleData.value?.[armyComposition.value]
  if (direct) return direct
  const selected = displayCompositions.value.find((item) => item.id === armyComposition.value)
  return selected?.name === 'Grand Army' ? (compositionRuleData.value?.['grand-army'] || null) : null
})
function optionAvailable(option: CompositionOptionId) {
  if (option === 'allow-allies') return Boolean(activeCompositionRules.value?.allies)
  if (option === 'allow-mercenaries') return Boolean(activeCompositionRules.value?.mercenaries)
  if (option === 'allow-custom-units') return true
  return true
}
function normalizeCompositionAvailability() {
  for (const option of ['allow-allies', 'allow-mercenaries'] as CompositionOptionId[]) {
    if (!optionAvailable(option)) compositionOptionState.value[option] = false
  }
}
onMounted(async () => {
  try { compositionRuleData.value = await loadCompositionRules() } catch (error) { reportAppError(error, 'CREATE_LIST_COMPOSITION_RULES'); compositionRuleData.value = null }
  normalizeCompositionAvailability()
})

let armyLoadGeneration = 0
watch(army, async (nextArmy, previousArmy) => {
  const generation = ++armyLoadGeneration
  const selected = getArmy(nextArmy)

  // Reset dependent controls immediately. Previously this happened after the
  // async composition lookup, so a slow response could wipe out a selection
  // the user had already made and make the form appear to lock itself.
  if (nextArmy !== previousArmy) {
    armyComposition.value = ''
    compositionRule.value = ''
    points.value = null
    compositionOptionState.value = emptyCompositionOptionState()
  }

  availableCompositions.value = selected?.compositions || []
  if (!selected) return

  try {
    const live = await loadLiveArmyCompositions(selected.dataKey, selected.compositions)
    if (generation === armyLoadGeneration && army.value === nextArmy) availableCompositions.value = live
  } catch (error) {
    reportAppError(error, 'CREATE_LIST_COMPOSITIONS', { army: selected.slug })
    // Keep the static composition list and, importantly, leave the current
    // form state untouched if the remote lookup is slow or unavailable.
  }
}, { immediate: true })

watch(armyComposition, () => {
  compositionRule.value = ''
  points.value = null
  compositionOptionState.value = emptyCompositionOptionState()
  normalizeCompositionAvailability()
})

watch(compositionRule, (rule) => {
  if (!rule) {
    points.value = null
    return
  }
  const current = Number(points.value) || 0
  points.value = current > 0
    ? normalizePointsForRule(rule, current)
    : (rule === 'battle-march' ? 500 : 2000)
  for (const option of battleMarchLockedOptions) compositionOptionState.value[option] = rule === 'battle-march'
  normalizeCompositionAvailability()
})

function optionLocked(option: CompositionOptionId) {
  return compositionRule.value === 'battle-march' && battleMarchLockedOptions.has(option)
}
function optionDisabled(option: CompositionOptionId) { return optionLocked(option) || !optionAvailable(option) }


function setCompositionOption(option: CompositionOptionId, checked: boolean) {
  if (optionDisabled(option)) return
  compositionOptionState.value[option] = checked
  if (checked && option === 'limit-magical-items-75') compositionOptionState.value['limit-magical-items-50'] = false
  if (checked && option === 'limit-magical-items-50') compositionOptionState.value['limit-magical-items-75'] = false
}

function handleCompositionOptionEvent(option: CompositionOptionId, event: Event) {
  const input = event.target as HTMLInputElement | null
  setCompositionOption(option, Boolean(input?.checked))
}

function choosePoints(value: number) {
  points.value = value
}

function createList() {
  if (!selectedArmy.value || !armyComposition.value || !compositionRule.value) return

  const effectiveName = listName.value.trim() || selectedArmy.value.name
  const composition = availableCompositions.value.find((item) => item.id === armyComposition.value)
  const saved = createSavedArmyList({
    name: effectiveName,
    army: selectedArmy.value.slug,
    armyName: selectedArmy.value.name,
    composition: armyComposition.value,
    compositionName: composition?.name || armyComposition.value,
    rule: compositionRule.value,
    points: points.value || 0,
    options: selectedCompositionOptions.value.map((option) => option.value),
    description: description.value.trim(),
    roster: [],
  })
  router.push({
    name: 'list-builder',
    query: {
      list: saved.id,
      army: saved.army,
      composition: saved.composition,
      rule: saved.rule,
      points: String(saved.points),
      name: saved.name,
      ...(saved.options.length ? { options: saved.options.join(',') } : {}),
      ...(saved.description ? { description: saved.description } : {}),
    },
  })
}
</script>

<template>
  <main class="page create-list-page">
    <AppHeader compact back-to="/lists" />

    <div class="page-title-block">
      <p class="eyebrow">NEW ROSTER</p>
      <h1>Create Army Roster</h1>
      <p>Choose the army, composition, battle composition and points limit. Create roster opens the army builder.</p>
    </div>

    <form class="form-card list-setup-card" @submit.prevent="createList">
      <div class="form-section-title">
        <strong>Roster setup</strong>
        <span class="value-chip">SETUP</span>
      </div>

      <label class="field-label">Roster name
        <input
          v-model="listName"
          class="field-control"
          type="text"
          maxlength="100"
          :placeholder="listNamePlaceholder"
          autocomplete="off"
        />
      </label>

      <div class="field-grid two-column-fields">
        <label class="field-label">Army
          <select v-model="army" class="field-control" required>
            <option value="" disabled>Select an army</option>
            <option v-for="item in armies" :key="item.slug" :value="item.slug">{{ item.name }}</option>
          </select>
        </label>

        <label class="field-label">Army composition
          <select v-model="armyComposition" class="field-control" :disabled="!selectedArmy" required>
            <option value="" disabled>{{ selectedArmy ? 'Select an army composition' : 'Select an army first' }}</option>
            <option v-for="composition in displayCompositions" :key="composition.id" :value="composition.id">
              {{ composition.name }}
            </option>
          </select>
        </label>
      </div>

      <label class="field-label">Battle Composition
        <select v-model="compositionRule" class="field-control" :disabled="!armyComposition" required>
          <option value="" disabled>{{ armyComposition ? 'Select a battle composition' : 'Select Army Composition first' }}</option>
          <option v-for="rule in compositionRules" :key="rule.value" :value="rule.value">{{ rule.label }}</option>
        </select>
      </label>

      <fieldset v-if="compositionRule" class="composition-options" aria-label="Battle Composition Options">
        <legend>Battle Composition Options</legend>
        <label v-for="option in compositionOptions" :key="option.value" class="composition-option" :class="{ locked: optionLocked(option.value), unavailable: !optionAvailable(option.value) }">
          <input
            type="checkbox"
            :checked="compositionOptionState[option.value]"
            :disabled="optionDisabled(option.value)"
            @change="handleCompositionOptionEvent(option.value, $event)"
          />
          <span>{{ option.label }}</span>
          <small v-if="optionLocked(option.value)">Required</small><small v-else-if="!optionAvailable(option.value)">Not available</small>
        </label>
      </fieldset>

      <section v-if="selectedCompositionOptionDetails.length" class="composition-option-details permanent-option-details">
        <div class="composition-option-details-heading">Selected option details <span>{{ selectedCompositionOptionDetails.length }}</span></div>
        <div class="composition-option-detail-list"><article v-for="option in selectedCompositionOptionDetails" :key="option.value"><strong>{{ option.label }}</strong><p>{{ option.description }}</p></article></div>
      </section>

      <div class="points-field-wrap">
        <label class="field-label">Points limit
          <input
            v-model.number="points"
            class="field-control"
            type="number"
            inputmode="numeric"
            :min="pointMinimum"
            :max="pointMaximum"
            step="50"
            :disabled="!compositionRule"
            :placeholder="compositionRule ? '' : 'Select Battle Composition first'"
          />
        </label>
        <div v-if="compositionRule" class="point-presets" aria-label="Quick points presets">
          <button
            v-for="preset in pointPresets"
            :key="preset"
            type="button"
            :class="['point-preset', { active: points === preset }]"
            @click="choosePoints(preset)"
          >{{ preset }}</button>
        </div>
        <p v-if="compositionRule === 'battle-march'" class="form-note points-rule-note">Battle March uses 500–750 point armies.</p>
      </div>

      <label class="field-label">Description / notes
        <textarea v-model="description" class="field-control field-textarea" maxlength="255" rows="3" placeholder="Optional list notes"></textarea>
      </label>

      <RouterLink to="/lists" class="secondary-button create-list-cancel">Cancel</RouterLink>
      <button type="submit" class="primary-button create-list-button" :disabled="!selectedArmy || !armyComposition || !compositionRule">Create roster</button>
    </form>
  </main>
</template>
