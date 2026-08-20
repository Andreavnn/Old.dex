<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { PrototypeUnit } from '../data/builderPrototype'
import { ruleCalloutLabel, splitRuleCallout } from '../domain/rulePresentation'
import { fetchRuleDocument } from '../services/ruleContent'
import { extractMechanicalRuleText } from '../services/ruleText'
import { reportAppError } from '../services/appErrors'
import RuleToneIcon from './RuleToneIcon.vue'

const props = defineProps<{ rule: PrototypeUnit['specialRules'][number]; kindLabel?: 'Special Rule' | 'Magical Item' }>()

const displayRule = computed(() => splitRuleCallout(props.rule.name))
const ownRulePath = computed(() => props.rule.path || props.rule.keywords[0]?.path || '')
const loadedSummary = ref('')

function fallbackDocumentText(html: string) {
  const dom = new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html')
  dom.querySelectorAll('script,style,nav,header,footer,table').forEach((node) => node.remove())
  const title = displayRule.value.title.toLowerCase()
  const rows = Array.from(dom.querySelectorAll('p, li'))
    .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() || '')
    .filter((text) => text.length >= 18 && text.toLowerCase() !== title && !/^(publication|source|page)\b/i.test(text))
  const seen = new Set<string>()
  return rows.filter((text) => { const key = text.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true }).slice(0, 4).join(' ').slice(0, 1800)
}

watch(() => [props.rule.summary, ownRulePath.value], async () => {
  loadedSummary.value = ''
  if (props.rule.summary || !ownRulePath.value) return
  try {
    const document = await fetchRuleDocument(ownRulePath.value)
    loadedSummary.value = extractMechanicalRuleText(document.html) || fallbackDocumentText(document.html)
  } catch (error) {
    reportAppError(error, 'RULE_CARD_DETAIL', { rule: props.rule.name, path: ownRulePath.value })
  }
}, { immediate: true })

const ruleSummary = computed(() => props.rule.summary || loadedSummary.value)
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
      <p v-if="props.rule.fluff" class="old-rule-fluff">{{ props.rule.fluff }}</p>
      <p v-if="ruleSummary">{{ ruleSummary }}</p>
      <div class="old-rule-keywords" aria-label="Related rules">
        <RouterLink v-if="ownRulePath" class="rule-kind-pill" :to="`/rules/read${ownRulePath}`">{{ props.kindLabel || 'Special Rule' }}</RouterLink>
        <span v-else class="rule-kind-pill">{{ props.kindLabel || 'Special Rule' }}</span>
        <RouterLink v-for="keyword in displayedKeywords" :key="`${keyword.label}-${keyword.path}`" :to="`/rules/read${keyword.path}`">{{ keyword.label }}</RouterLink>
      </div>
    </div>
  </article>
</template>
