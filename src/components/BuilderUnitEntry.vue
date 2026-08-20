<script setup lang="ts">
import { computed } from 'vue'
import type { BuilderRosterSelection } from '../services/builderRoster'

const props = defineProps<{ row: BuilderRosterSelection; armySlug: string; returnPath: string; compositionId: string; locked?: boolean; invalid?: boolean }>()
const emit = defineEmits<{ remove: []; duplicate: [] }>()
const basePath = computed(() => `/army/${props.armySlug}/unit/${props.row.unitId}?return=${encodeURIComponent(props.returnPath)}&composition=${encodeURIComponent(props.compositionId)}&instance=${encodeURIComponent(props.row.instanceId)}`)
const viewPath = computed(() => `${basePath.value}&mode=view`)
const editPath = computed(() => `${basePath.value}&mode=edit`)

function compactKey(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
const displayUnitSize = computed(() => {
  const clean = String(props.row.unitSize || '').replace(/\s+/g, ' ').trim()
  if (clean === '1') return '1 model'
  if (/^\d+$/.test(clean) || /^\d+\+$/.test(clean) || /^\d+\s*[–-]\s*\d+$/.test(clean)) return `${clean} models`
  return clean
})
function cleanDisplayOption(value: string) {
  let clean = String(value || '').trim()
  const wizard = clean.match(/(?:Level\s*(\d+)\s*Wizard|Wizard\s*Level\s*(\d+))/i)
  if (wizard) clean = `Wizard Level ${Number(wizard[1] || wizard[2])}`
  const handWeapon = clean.match(/^Hand weapons?\s*(?:[×x]\s*)?\(?\s*(\d+)\s*\)?$/i)
  if (handWeapon) clean = `${Number(handWeapon[1])} – (Hand Weapon)`
  if (/\b(?:armour|armor|shield|stubborn|veteran)\b/i.test(clean)) return clean.replace(/\s*[×x]\s*\d+\s*$/i, '')
  return clean
}
function uniqueLabels(values: string[]) { return [...new Set(values.map(cleanDisplayOption).filter(Boolean))] }
const classifiedLabelsAvailable = computed(() => props.row.includedEquipment !== undefined || props.row.optionalSelections !== undefined)
const rawDisplayIncluded = computed(() => {
  if (classifiedLabelsAvailable.value) return uniqueLabels(props.row.includedEquipment || [])
  return uniqueLabels((props.row.options || []).filter((value) => /\bhand weapons?\b|\b(?:light|heavy|full plate) (?:armour|armor)\b|^on foot$/i.test(String(value))))
})
const rawDisplayOptional = computed(() => {
  if (classifiedLabelsAvailable.value) return uniqueLabels(props.row.optionalSelections || [])
  const included = new Set(rawDisplayIncluded.value.map(compactKey))
  return uniqueLabels((props.row.options || []).filter((value) => !included.has(compactKey(cleanDisplayOption(String(value))))))
})
function wizardLevelValue(value: string) { const match = String(value).match(/^Wizard Level (\d+)$/i); return match ? Number(match[1]) : 0 }
const currentWizardLabel = computed(() => {
  const labels = [...rawDisplayIncluded.value, ...rawDisplayOptional.value]
  const level = Math.max(0, ...labels.map(wizardLevelValue))
  return level ? `Wizard Level ${level}` : ''
})
const wizardLevelIsOptional = computed(() => Boolean(currentWizardLabel.value && rawDisplayOptional.value.some((value) => wizardLevelValue(value) === wizardLevelValue(currentWizardLabel.value))))
const displayIncluded = computed(() => {
  const rows = rawDisplayIncluded.value.filter((value) => !wizardLevelValue(value))
  if (currentWizardLabel.value && !wizardLevelIsOptional.value) rows.push(currentWizardLabel.value)
  return rows
})
const displayOptional = computed(() => {
  const rows = rawDisplayOptional.value.filter((value) => !wizardLevelValue(value))
  if (currentWizardLabel.value && wizardLevelIsOptional.value) rows.push(currentWizardLabel.value)
  return rows
})
const displayOptions = computed(() => [...displayIncluded.value, ...displayOptional.value])
const displayRules = computed(() => {
  const optionKeys = new Set(displayOptions.value.map(compactKey))
  const seen = new Set<string>()
  return (props.row.specialRules || []).filter((rule) => {
    const key = compactKey(rule.label || '')
    if (!key || optionKeys.has(key) || seen.has(key)) return false
    seen.add(key)
    return true
  })
})
</script>

<template>
  <article class="builder-unit-entry configured-unit-entry" :class="{ invalid }">
    <div class="builder-unit-main">
      <div class="builder-unit-name-row">
        <RouterLink class="builder-unit-name" :to="viewPath">{{ row.name }}</RouterLink>
      </div>
      <div class="builder-unit-subline" aria-label="Unit summary">
        <span>{{ displayUnitSize }}</span>
        <span>{{ row.category }}</span>
        <span v-if="row.totalPoints !== row.basePoints">{{ row.basePoints }} base</span>
      </div>
      <div v-if="displayOptions.length" class="configured-option-line" aria-label="Selected equipment and options">
        <span v-for="option in displayIncluded" :key="`included-${option}`" class="roster-included-chip">{{ option }}</span>
        <span v-for="option in displayOptional" :key="`optional-${option}`" class="roster-option-chip">{{ option }}</span>
      </div>
      <div v-if="displayRules.length" class="configured-option-line configured-rule-line" aria-label="Special rules">
        <RouterLink v-for="rule in displayRules" :key="`${rule.label}-${rule.path}`" :to="`/rules/read${rule.path}`">{{ rule.label }}</RouterLink>
      </div>
    </div>
    <div class="builder-unit-control-column">
      <span class="builder-unit-points-box">{{ row.totalPoints }} pts</span>
      <div class="builder-unit-actions" aria-label="Unit controls">
        <RouterLink v-if="!locked" class="builder-mini-action primary" :to="editPath">Edit</RouterLink><span v-else class="builder-mini-action disabled" aria-disabled="true">Edit</span>
        <RouterLink class="builder-mini-action icon-only-action" :to="viewPath" aria-label="View unit" title="View"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.6"/></svg></RouterLink>
        <button type="button" class="builder-mini-action icon-only-action" :disabled="locked" aria-label="Copy unit" title="Copy" @click="emit('duplicate')"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M16 8V5H5v11h3"/></svg></button>
        <button type="button" class="builder-mini-action danger" :disabled="locked" @click="emit('remove')">Remove</button>
      </div>
    </div>
  </article>
</template>
