<script setup lang="ts">
import type { PrototypeUnit } from '../data/builderPrototype'
import RuleToneIcon from './RuleToneIcon.vue'

defineProps<{ rule: PrototypeUnit['specialRules'][number]; kindLabel?: 'Special Rule' | 'Magical Item' }>()
</script>

<template>
  <article class="old-rule-card static-rule-card" :class="`tone-${rule.tone}`">
    <div class="old-rule-summary static-rule-summary">
      <span class="old-rule-pill-row"><span class="rule-kind-pill">{{ kindLabel || 'Special Rule' }}</span><span class="old-rule-phase">{{ rule.timing }}</span></span>
      <span class="old-rule-title-row"><RuleToneIcon :tone="rule.tone" /><span class="old-rule-name">{{ rule.name }}</span></span>
    </div>
    <div class="old-rule-body">
      <p v-if="rule.summary">{{ rule.summary }}</p>
      <p v-else class="rule-effect-loading">Rule text is loading from the rules index.</p>
      <div class="old-rule-keywords" aria-label="Related rules">
        <RouterLink v-for="keyword in rule.keywords" :key="keyword.label" :to="`/rules/read${keyword.path}`">{{ keyword.label }}</RouterLink>
      </div>
    </div>
  </article>
</template>
