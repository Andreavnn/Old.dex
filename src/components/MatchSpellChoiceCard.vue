<script setup lang="ts">
import RuleToneIcon from './RuleToneIcon.vue'
import type { GameMagicChoice } from '../services/games'

const props = withDefaults(defineProps<{
  choice: GameMagicChoice
  selected?: boolean
  disabled?: boolean
  selectable?: boolean
  kindLabel?: string
}>(), {
  selected: false,
  disabled: false,
  selectable: true,
  kindLabel: 'Spell',
})

const emit = defineEmits<{ toggle: [selected: boolean] }>()
</script>

<template>
  <article class="old-rule-card static-rule-card match-spell-choice-card tone-magic" :class="{ selected: props.selected, unavailable: props.disabled }">
    <div class="match-spell-card-head">
      <div class="match-spell-pills">
        <span class="old-rule-phase">{{ props.choice.type || props.kindLabel }}</span>
        <span v-if="props.choice.signature" class="value-chip">Signature Spell</span>
      </div>
      <label v-if="props.selectable" class="match-spell-select" @click.stop>
        <input type="checkbox" :checked="props.selected" :disabled="props.disabled" @change="emit('toggle', ($event.target as HTMLInputElement).checked)" />
        <span>Select</span>
      </label>
    </div>
    <div class="match-spell-title-row">
      <RuleToneIcon tone="magic" :label="`${props.choice.type || props.kindLabel} ${props.choice.name}`" />
      <strong>{{ props.choice.name }}</strong>
    </div>
    <div class="old-rule-body match-spell-rule-body">
      <dl v-if="props.choice.castingValue || props.choice.range" class="spell-rule-meta match-spell-meta">
        <div v-if="props.choice.castingValue"><dt>Casting Value</dt><dd>{{ props.choice.castingValue }}</dd></div>
        <div v-if="props.choice.range"><dt>Range</dt><dd>{{ props.choice.range }}</dd></div>
      </dl>
      <p v-if="props.choice.summary">{{ props.choice.summary }}</p>
      <RouterLink v-if="props.choice.path" :to="`/rules/read${props.choice.path}`">{{ props.kindLabel === 'Prayer' ? 'Open prayer rules' : 'Open spell rules' }}</RouterLink>
    </div>
  </article>
</template>
