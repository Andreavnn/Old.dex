<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import {
  fetchRuleDocument,
  fetchRuleIndexHierarchy,
  type RuleDocument,
  type RuleIndexGroup,
} from '../services/ruleContent'
import { getRuleBreadcrumbs } from '../data/ruleNavigation'
import { hiddenRuleSourcePaths, nonReaderRuleSourcePaths } from '../data/rules'
import { ruleIndexGroupPath, ruleReaderPath } from '../data/ruleRepository'
import { getCoreFlowNavigation, getSequenceStepNavigation } from '../data/coreSequenceNavigation'
import { reportAppError } from '../services/appErrors'
import { pitchedBattleScenarioMaps, pitchedBattleScenarioSlugFromPath } from '../data/scenarioMaps'

const route = useRoute()
const router = useRouter()
const document = ref<RuleDocument | null>(null)
const indexGroups = ref<RuleIndexGroup[]>([])
const loading = ref(true)
const errorMessage = ref('')

const sourcePath = computed(() => {
  const raw = route.params.pathMatch
  const parts = Array.isArray(raw) ? raw : [raw]
  const value = parts.filter(Boolean).join('/')
  return `/${value}`
})

const displayTitle = computed(() => sourcePath.value === '/' ? 'Quick Reference' : (document.value?.title || 'Rules Reference'))
const scenarioFallbackImage = computed(() => {
  const slug = pitchedBattleScenarioSlugFromPath(sourcePath.value)
  if (!slug || /<img\b/i.test(document.value?.html || '')) return ''
  return pitchedBattleScenarioMaps[slug] || ''
})
const breadcrumbs = computed(() => getRuleBreadcrumbs(sourcePath.value, displayTitle.value, indexGroups.value))
const sequenceStepNavigation = computed(() => getSequenceStepNavigation(sourcePath.value))
const coreFlowNavigation = computed(() => getCoreFlowNavigation(sourcePath.value))
const coreNavigationItems = computed(() => {
  const items: Array<{ label: string; name: string; sourcePath: string; direction: 'previous' | 'next' }> = []
  const step = sequenceStepNavigation.value
  const core = coreFlowNavigation.value

  if (core?.previous) {
    items.push({
      label: core.isPhaseSequence ? 'Previous Sequence' : 'Previous Core Rule',
      name: core.previous.name,
      sourcePath: core.previous.sourcePath,
      direction: 'previous',
    })
  }
  if (step?.previous) {
    items.push({ label: 'Previous', name: step.previous.name, sourcePath: step.previous.sourcePath, direction: 'previous' })
  }
  if (step?.next) {
    items.push({ label: 'Next', name: step.next.name, sourcePath: step.next.sourcePath, direction: 'next' })
  }
  if (core?.next) {
    items.push({
      label: core.isPhaseSequence ? 'Next Sequence' : 'Next Core Rule',
      name: core.next.name,
      sourcePath: core.next.sourcePath,
      direction: 'next',
    })
  }

  return items
})

async function load(force = false) {
  if (hiddenRuleSourcePaths.has(sourcePath.value) || sourcePath.value.startsWith('/general-principles/')) {
    await router.replace('/rules')
    return
  }
  if (nonReaderRuleSourcePaths.has(sourcePath.value)) {
    await router.replace(ruleIndexGroupPath('advanced', sourcePath.value))
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const [ruleDocument, hierarchy] = await Promise.all([
      fetchRuleDocument(sourcePath.value, force),
      fetchRuleIndexHierarchy(false).catch((error) => { reportAppError(error, 'RULE_READER_INDEX', { sourcePath: sourcePath.value }); return indexGroups.value }),
    ])
    document.value = ruleDocument
    if (hierarchy.length) indexGroups.value = hierarchy
  } catch (error) {
    reportAppError(error, 'RULE_READER_LOAD', { sourcePath: sourcePath.value })
    document.value = null
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load this rule page.'
  } finally {
    loading.value = false
  }
}

function handleRuleClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  const appAnchor = target?.closest<HTMLAnchorElement>('a[data-app-path]')
  if (appAnchor?.dataset.appPath) {
    event.preventDefault()
    router.push(appAnchor.dataset.appPath)
    return
  }
  const anchor = target?.closest<HTMLAnchorElement>('a[data-rule-path]')
  if (!anchor?.dataset.rulePath) return
  event.preventDefault()
  router.push(ruleReaderPath(anchor.dataset.rulePath))
}


watch(sourcePath, () => load())
onMounted(() => load())
</script>

<template>
  <main class="page rule-reader-page">
    <AppHeader back-to="/rules" back-label="Back to Rules" />

    <nav class="rule-breadcrumb" aria-label="Rule path">
      <template v-for="(crumb, index) in breadcrumbs" :key="`${crumb.label}-${index}`">
        <RouterLink v-if="crumb.to" :to="crumb.to">{{ crumb.label }}</RouterLink>
        <span v-else class="rule-breadcrumb-current">{{ crumb.label }}</span>
        <span v-if="index < breadcrumbs.length - 1" class="rule-breadcrumb-separator" aria-hidden="true">/</span>
      </template>
    </nav>

    <section v-if="loading" class="rule-content-card rule-loading-card">
      <div class="rule-loading-line wide"></div>
      <div class="rule-loading-line"></div>
      <div class="rule-loading-line medium"></div>
      <div class="rule-loading-line"></div>
    </section>

    <section v-else-if="errorMessage" class="empty-state card-surface compact-empty">
      <div class="empty-icon">!</div>
      <h1>Rule content unavailable</h1>
      <p>{{ errorMessage }}</p>
      <button class="primary-button" type="button" @click="load(true)">Try again</button>
    </section>

    <template v-else-if="document">
      <div class="page-title-block rule-live-title">
        <h1>{{ displayTitle }}</h1>
      </div>

      <article class="rule-content-card" @click="handleRuleClick">
        <div class="rule-live-content" v-html="document.html"></div>
        <img v-if="scenarioFallbackImage" class="rule-imported-image scenario-rule-fallback-image" :src="scenarioFallbackImage" :alt="`${displayTitle} battlefield and deployment map`" loading="lazy" decoding="async" />

        <nav v-if="coreNavigationItems.length" class="rule-core-navigation" aria-label="Core rule navigation">
          <RouterLink
            v-for="item in coreNavigationItems"
            :key="`${item.label}-${item.sourcePath}`"
            :class="['rule-core-navigation-link', `rule-core-navigation-link-${item.direction}`]"
            :to="ruleReaderPath(item.sourcePath)"
          >
            <span class="rule-sequence-kicker">{{ item.label }}</span>
            <span>{{ item.name }}</span>
          </RouterLink>
        </nav>
      </article>

      <nav class="rule-breadcrumb rule-breadcrumb-bottom" aria-label="Rule path">
        <template v-for="(crumb, index) in breadcrumbs" :key="`bottom-${crumb.label}-${index}`">
          <RouterLink v-if="crumb.to" :to="crumb.to">{{ crumb.label }}</RouterLink>
          <span v-else class="rule-breadcrumb-current">{{ crumb.label }}</span>
          <span v-if="index < breadcrumbs.length - 1" class="rule-breadcrumb-separator" aria-hidden="true">/</span>
        </template>
      </nav>
    </template>
  </main>
</template>
