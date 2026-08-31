<script setup lang="ts">
import { computed } from 'vue'
import type { PrototypeUnit } from '../data/builderPrototype'
import type { GameMagicChoice } from '../services/games'
import RuleAbilityCard from './RuleAbilityCard.vue'

const props = withDefaults(defineProps<{
  choice: GameMagicChoice
  selected?: boolean
  disabled?: boolean
  selectable?: boolean
  kindLabel?: string
  sourceLabel?: string
  trackResult?: boolean
  result?: 'success' | 'fail' | ''
}>(), {
  selected: false,
  disabled: false,
  selectable: true,
  kindLabel: 'Spell',
  sourceLabel: '',
  trackResult: false,
  result: '',
})

const emit = defineEmits<{
  toggle: [selected: boolean]
  result: [result: 'success' | 'fail' | '']
}>()

const spellNumber = computed(() => props.choice.signature ? '' : String(props.choice.id || '').match(/^(\d+)-/)?.[1] || '')

const rule = computed(() => {
  const meta = [
    props.choice.castingValue ? `Casting Value ${props.choice.castingValue}` : '',
    props.choice.range ? `Range ${props.choice.range}` : '',
  ].filter(Boolean).join(' · ')
  const summary = [meta ? `${meta}.` : '', props.choice.summary || ''].filter(Boolean).join(' ')
  const path = props.choice.path || '/the-lores-of-magic'
  return {
    name: spellNumber.value ? `${spellNumber.value}. ${props.choice.name}` : props.choice.name,
    path,
    timing: props.choice.type || props.kindLabel,
    tone: 'magic',
    summary,
    keywords: props.choice.signature ? [{ label: 'Signature Spell', path }] : [],
  } as PrototypeUnit['specialRules'][number]
})
</script>

<template>
  <div class="match-spell-choice-shell" :class="{ selected: props.selected, unavailable: props.disabled }">
    <RuleAbilityCard class="match-spell-choice-card" :rule="rule" :kind-label="props.kindLabel" />
    <label v-if="props.selectable" class="match-spell-select" @click.stop>
      <input type="checkbox" :checked="props.selected" :disabled="props.disabled" @change="emit('toggle', ($event.target as HTMLInputElement).checked)" />
      <span>Select</span>
    </label>
    <div v-if="props.sourceLabel || props.trackResult" class="match-spell-tracking-footer">
      <small v-if="props.sourceLabel" class="match-spell-source">{{ props.sourceLabel }}</small>
      <div v-if="props.trackResult" class="match-spell-result-controls" role="group" :aria-label="`${props.choice.name} casting result`">
        <label :class="{ selected: props.result === 'success' }">
          <input type="checkbox" :checked="props.result === 'success'" :disabled="props.disabled" @change="emit('result', ($event.target as HTMLInputElement).checked ? 'success' : '')" />
          <span>Successful</span>
        </label>
        <label :class="{ selected: props.result === 'fail' }">
          <input type="checkbox" :checked="props.result === 'fail'" :disabled="props.disabled" @change="emit('result', ($event.target as HTMLInputElement).checked ? 'fail' : '')" />
          <span>Failed</span>
        </label>
      </div>
    </div>
  </div>
</template>
