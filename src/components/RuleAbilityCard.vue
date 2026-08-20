<script setup lang="ts">
import { computed } from 'vue'
import type { PrototypeUnit } from '../data/builderPrototype'
import { ruleCalloutLabel, splitRuleCallout } from '../domain/rulePresentation'
import RuleToneIcon from './RuleToneIcon.vue'

const props = defineProps<{ rule: PrototypeUnit['specialRules'][number]; kindLabel?: 'Special Rule' | 'Magical Item' }>()

const displayRule = computed(() => splitRuleCallout(props.rule.name))
const ownRulePath = computed(() => props.rule.path || props.rule.keywords[0]?.path || '')
const displayedKeywords = computed(() => {
  const ownPath = ownRulePath.value || '/special-rules'
  const rows = props.rule.keywords.map((keyword) => {
    const split = splitRuleCallout(keyword.label)
    return { ...keyword, label: split.title }
  })
  if (displayRule.value.callout) rows.push({ label: ruleCalloutLabel(displayRule.value.callout), path: ownPath })
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = `${row.label.toLowerCase()}:${row.path}`
    if (!row.label || seen.has(key)) return false
    seen.add(key)
    return true
  })
})
</script>

<template>
  <article class="old-rule-card static-rule-card" :class="`tone-${props.rule.tone}`">
    <div class="old-rule-summary static-rule-summary">
      <span class="old-rule-pill-row"><span class="old-rule-phase">{{ props.rule.timing }}</span></span>
      <span class="old-rule-title-row"><RuleToneIcon :tone="props.rule.tone" :label="`${props.rule.timing} ${displayRule.title}`" /><span class="old-rule-name">{{ displayRule.title }}</span></span>
    </div>
    <div class="old-rule-body">
      <p v-if="props.rule.summary">{{ props.rule.summary }}</p>
      <p v-else class="rule-effect-loading">Rule text is loading from the rules index.</p>
      <div class="old-rule-keywords" aria-label="Related rules">
        <RouterLink v-if="ownRulePath" class="rule-kind-pill" :to="`/rules/read${ownRulePath}`">{{ props.kindLabel || 'Special Rule' }}</RouterLink>
        <span v-else class="rule-kind-pill">{{ props.kindLabel || 'Special Rule' }}</span>
        <RouterLink v-for="keyword in displayedKeywords" :key="`${keyword.label}-${keyword.path}`" :to="`/rules/read${keyword.path}`">{{ keyword.label }}</RouterLink>
      </div>
    </div>
  </article>
</template>
