<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { battleScenarioEntries, nonReaderRuleSourcePaths, ruleSections, slugify } from '../data/rules'
import { ruleReaderPath } from '../data/ruleRepository'
import { fetchRuleIndexHierarchy, type RuleIndexGroup } from '../services/ruleContent'
import { reportAppError } from '../services/appErrors'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const group = ref<RuleIndexGroup | null>(null)
const errorMessage = ref('')

const kind = computed<'advanced' | 'scenarios'>(() => route.params.kind === 'scenarios' ? 'scenarios' : 'advanced')
const sourcePath = computed(() => {
  const raw = route.params.pathMatch
  const parts = Array.isArray(raw) ? raw : [raw]
  const value = parts.filter(Boolean).join('/')
  return `/${value}`
})

const parentLabel = computed(() => kind.value === 'scenarios' ? 'Battle Scenarios' : 'Advanced Rules')
const parentRoute = computed(() => `/rules?group=${kind.value}`)

function fallbackGroup(path: string): RuleIndexGroup | null {
  const section = ruleSections.find((item) => item.sourcePath === path)
  if (!section) return null
  const scenario = battleScenarioEntries.find((item) => item.sourcePath === path)
  const entries = [
    ...(nonReaderRuleSourcePaths.has(section.sourcePath) ? [] : [{ name: scenario?.name || section.name, sourcePath: section.sourcePath }]),
    ...section.topics.map((topic) => ({
      name: topic,
      sourcePath: `${section.sourcePath}/${slugify(topic)}`.replace(/\/+/g, '/'),
    })),
  ].filter((entry, index, all) => all.findIndex((item) => item.sourcePath === entry.sourcePath) === index)

  return {
    name: scenario?.name || section.name,
    sourcePath: section.sourcePath,
    entries,
  }
}

async function load(force = false) {
  loading.value = true
  errorMessage.value = ''
  try {
    const groups = await fetchRuleIndexHierarchy(force)
    const live = groups.find((item) => item.sourcePath === sourcePath.value)
    group.value = live || fallbackGroup(sourcePath.value)
    if (!group.value) throw new Error('This rule section is not available in the current index.')
  } catch (error) {
    reportAppError(error, 'RULE_INDEX_GROUP_LOAD', { sourcePath: sourcePath.value })
    group.value = fallbackGroup(sourcePath.value)
    if (!group.value) errorMessage.value = error instanceof Error ? error.message : 'Unable to load this rule section.'
  } finally {
    loading.value = false
  }
}


watch([sourcePath, kind], () => load())
onMounted(() => load())
</script>

<template>
  <main class="page rule-reader-page rule-index-group-page">
    <AppHeader :back-to="parentRoute" :back-label="`Back to ${parentLabel}`" />

    <nav class="rule-breadcrumb" aria-label="Rule path">
      <RouterLink to="/rules">Rules</RouterLink>
      <span class="rule-breadcrumb-separator" aria-hidden="true">/</span>
      <RouterLink :to="parentRoute">{{ parentLabel }}</RouterLink>
      <template v-if="group">
        <span class="rule-breadcrumb-separator" aria-hidden="true">/</span>
        <span class="rule-breadcrumb-current">{{ group.name }}</span>
      </template>
    </nav>

    <section v-if="loading" class="rule-content-card rule-loading-card">
      <div class="rule-loading-line wide"></div>
      <div class="rule-loading-line"></div>
      <div class="rule-loading-line medium"></div>
    </section>

    <section v-else-if="errorMessage" class="empty-state card-surface compact-empty">
      <div class="empty-icon">!</div>
      <h1>Rule index unavailable</h1>
      <p>{{ errorMessage }}</p>
      <button class="primary-button" type="button" @click="load(true)">Try again</button>
    </section>

    <template v-else-if="group">
      <div class="page-title-block rule-live-title">
        <h1>{{ group.name }}</h1>
      </div>

      <article class="rule-content-card rule-index-group-card">
        <div class="rule-live-content rule-index-group-content">
          <ul class="rule-section-link-list">
            <li v-for="entry in group.entries" :key="entry.sourcePath">
              <RouterLink :to="ruleReaderPath(entry.sourcePath)">{{ entry.name }}</RouterLink>
            </li>
          </ul>
          <p v-if="!group.entries.length" class="empty-inline">No detailed links are currently listed for this section.</p>
        </div>
      </article>

      <nav class="rule-breadcrumb rule-breadcrumb-bottom" aria-label="Rule path">
        <RouterLink to="/rules">Rules</RouterLink>
        <span class="rule-breadcrumb-separator" aria-hidden="true">/</span>
        <RouterLink :to="parentRoute">{{ parentLabel }}</RouterLink>
        <span class="rule-breadcrumb-separator" aria-hidden="true">/</span>
        <span class="rule-breadcrumb-current">{{ group.name }}</span>
      </nav>
    </template>
  </main>
</template>
