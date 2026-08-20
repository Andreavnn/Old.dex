<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import SearchBar from '../components/SearchBar.vue'
import SectionCard from '../components/SectionCard.vue'
import ListRow from '../components/ListRow.vue'
import { armies, armyFamilyOrder, type ArmyFamily } from '../data/armies'
import { battleScenarioEntries, coreRuleEntrypoints, nonReaderRuleSourcePaths, ruleSections, slugify, supportPages } from '../data/rules'
import { armySourcePath, ruleIndexGroupPath, ruleReaderPath } from '../data/ruleRepository'
import {
  fetchRuleIndexHierarchy,
  fetchRuleRepositoryVersion,
  type RuleIndexGroup,
} from '../services/ruleContent'
import { getRuleSearchHistory, recordRuleSearchSelection } from '../services/ruleSearchHistory'
import { reportAppError } from '../services/appErrors'

const route = useRoute()
const query = ref('')
const openGroup = ref<string | null>('updates')
const openArmyFamily = ref<ArmyFamily | null>(null)
const currentVersion = ref('')
const ruleIndexLoading = ref(false)
const searchHistory = ref(getRuleSearchHistory())
const q = computed(() => query.value.trim().toLowerCase())

const coreSlugs = [
  'the-strategy-phase',
  'the-movement-phase',
  'the-shooting-phase',
  'the-combat-phase',
  'magic',
  'special-rules',
  'weapons-of-war',
]

const frequentSlugs = [
  'the-strategy-phase',
  'the-movement-phase',
  'the-shooting-phase',
  'the-combat-phase',
  'magic',
  'special-rules',
  'weapons-of-war',
]

const scenarioLabels = new Map(battleScenarioEntries.map((entry) => [entry.sourcePath, entry.name]))
const scenarioPaths = new Set(battleScenarioEntries.map((entry) => entry.sourcePath))
const advancedExcludedNames = new Set(['Frequently Asked Questions', 'Errata & Amendments', 'Army Index', 'General Principles'])

function fallbackEntryPath(sectionPath: string, topic: string) {
  return `${sectionPath}/${slugify(topic)}`.replace(/\/+/g, '/')
}

function fallbackRuleIndexHierarchy(): RuleIndexGroup[] {
  return ruleSections
    .filter((section) => section.sourcePath !== '/' && !scenarioPaths.has(section.sourcePath) && !advancedExcludedNames.has(section.name))
    .map((section) => ({
      name: section.name,
      sourcePath: section.sourcePath,
      entries: [
        ...(nonReaderRuleSourcePaths.has(section.sourcePath) ? [] : [{ name: section.name, sourcePath: section.sourcePath }]),
        ...section.topics.map((topic) => ({ name: topic, sourcePath: fallbackEntryPath(section.sourcePath, topic) })),
      ].filter((entry, index, entries) => entries.findIndex((item) => item.sourcePath === entry.sourcePath) === index),
    }))
}

const ruleIndexGroups = ref<RuleIndexGroup[]>(fallbackRuleIndexHierarchy())

const coreRules = computed(() => coreSlugs.flatMap((slug) => {
  const rule = ruleSections.find((item) => item.slug === slug)
  return rule ? [{ ...rule, to: ruleReaderPath(coreRuleEntrypoints[rule.slug] || rule.sourcePath) }] : []
}))

const referenceUpdates = computed(() => {
  const items = [] as Array<{ name: string; to: string }>
  const quick = ruleSections.find((rule) => rule.slug === 'quick-reference')
  const faq = supportPages.find((page) => page.slug === 'faq')
  const errata = supportPages.find((page) => page.slug === 'errata')
  if (quick) items.push({ name: quick.name, to: ruleReaderPath(quick.sourcePath) })
  if (faq) items.push({ name: faq.name, to: ruleReaderPath(faq.sourcePath) })
  if (errata) items.push({ name: errata.name, to: ruleReaderPath(errata.sourcePath) })
  return items
})

const defaultFrequentRules = computed(() => {
  const entries = frequentSlugs.flatMap((slug) => {
    const rule = ruleSections.find((item) => item.slug === slug)
    return rule ? [{ name: rule.name, to: ruleReaderPath(coreRuleEntrypoints[rule.slug] || rule.sourcePath) }] : []
  })
  const faq = supportPages.find((page) => page.slug === 'faq')
  if (faq) entries.push({ name: faq.name, to: ruleReaderPath(faq.sourcePath) })
  return entries
})

const frequentRules = computed(() => {
  const seen = new Set<string>()
  return [...searchHistory.value, ...defaultFrequentRules.value]
    .filter((entry) => {
      if ([...nonReaderRuleSourcePaths].some((path) => entry.to === ruleReaderPath(path))) return false
      if (seen.has(entry.to)) return false
      seen.add(entry.to)
      return true
    })
    .slice(0, 8)
})

const armyFamilies = computed(() => armyFamilyOrder.map((family) => ({
  family,
  armies: armies.filter((army) => army.family === family),
})))

const battleScenarioGroups = computed(() => battleScenarioEntries.map((scenario) => {
  const liveGroup = ruleIndexGroups.value.find((group) => group.sourcePath === scenario.sourcePath)
  return liveGroup
    ? { ...liveGroup, name: scenarioLabels.get(scenario.sourcePath) || liveGroup.name }
    : { name: scenario.name, sourcePath: scenario.sourcePath, entries: [] }
}))

const advancedRuleGroups = computed(() => ruleIndexGroups.value.filter((group) => {
  if (scenarioPaths.has(group.sourcePath)) return false
  if (group.sourcePath === '/faq' || group.sourcePath === '/errata' || group.sourcePath === '/army-index') return false
  if (advancedExcludedNames.has(group.name)) return false
  return true
}))

const searchResults = computed(() => {
  if (!q.value) return []
  const results: Array<{ name: string; to: string }> = []
  const seen = new Set<string>()

  const push = (name: string, to: string) => {
    const key = to
    if (seen.has(key)) return
    seen.add(key)
    results.push({ name, to })
  }

  // Search the detailed Quick Reference hierarchy. Section landing pages are deliberately
  // excluded here so searches do not return both a light overview and its actual sequence/rule.
  for (const group of ruleIndexGroups.value) {
    if (advancedExcludedNames.has(group.name) || group.sourcePath === '/army-index') continue
    for (const entry of group.entries) {
      if (entry.sourcePath === group.sourcePath) continue
      if (entry.name.toLowerCase().includes(q.value)) push(`${entry.name} — ${group.name}`, ruleReaderPath(entry.sourcePath))
    }
  }

  // Core phase names resolve directly to the useful sequence/profile/rule page.
  for (const item of ruleSections.filter((rule) => coreSlugs.includes(rule.slug))) {
    if (item.name.toLowerCase().includes(q.value)) {
      push(item.name, ruleReaderPath(coreRuleEntrypoints[item.slug] || item.sourcePath))
    }
  }

  for (const item of supportPages) {
    if (item.name.toLowerCase().includes(q.value)) push(item.name, ruleReaderPath(item.sourcePath))
  }

  for (const army of armies) {
    if (`${army.name} ${army.family}`.toLowerCase().includes(q.value)) {
      push(army.name, ruleReaderPath(armySourcePath(army.slug)))
    }
  }

  return results
})

function rememberSearchResult(name: string, to: string) {
  const shortcutName = name.replace(/\s+—\s+.*$/, '')
  recordRuleSearchSelection(shortcutName, to)
  searchHistory.value = getRuleSearchHistory()
}

function applyRouteState() {
  const requestedGroup = String(route.query.group || '')
  if (['updates', 'core', 'armies', 'scenarios', 'advanced'].includes(requestedGroup)) openGroup.value = requestedGroup
  else if (!requestedGroup) openGroup.value = 'updates'
}

function toggleGroup(group: string) {
  openGroup.value = openGroup.value === group ? null : group
  if (group !== 'armies') openArmyFamily.value = null
}

function toggleArmyFamily(family: ArmyFamily) {
  openArmyFamily.value = openArmyFamily.value === family ? null : family
}

async function loadRuleIndex(force = false) {
  ruleIndexLoading.value = true
  try {
    const loaded = await fetchRuleIndexHierarchy(force)
    ruleIndexGroups.value = loaded.length ? loaded : fallbackRuleIndexHierarchy()
  } catch (error) {
    reportAppError(error, 'RULE_INDEX_LOAD')
    ruleIndexGroups.value = fallbackRuleIndexHierarchy()
  } finally {
    ruleIndexLoading.value = false
  }
}

watch(() => route.query, applyRouteState, { deep: true })

onMounted(async () => {
  applyRouteState()
  await Promise.all([
    loadRuleIndex(),
    (async () => {
      currentVersion.value = await fetchRuleRepositoryVersion(true) || await fetchRuleRepositoryVersion() || 'Unavailable'
    })(),
  ])
  applyRouteState()
})
</script>

<template>
  <main class="page rules-index-page">
    <AppHeader />

    <div class="page-title-block rules-title-block">
      <h1>Rules</h1>
      <div class="rules-intro-copy">
        <p>
          Welcome to the Old.dex army builder for the Warhammer: The Old World. This project is unofficial and not affiliated with Games Workshop Limited. This website contains an easily searchable index of the core rules and army-specific rules for The Old World integrated with official errata. The complete index of unofficial rules
          <a href="https://tow.whfb.app/" target="_blank" rel="noreferrer"><strong>Warhammer: The Old World Online Rules Index</strong></a>, and official
          <RouterLink to="/rules/read/faq"><strong>Frequently Asked Questions</strong></RouterLink>
          and
          <RouterLink to="/rules/read/errata"><strong>Errata &amp; Amendments</strong></RouterLink>
          are also available.
        </p>
        <p class="rules-version-note" aria-live="polite">
          <strong>Current Version: {{ currentVersion || 'Checking…' }}</strong> — This index contains all the officially released frequently asked questions and errata &amp; amendments. Official Games Workshop PDFs are available from
          <a href="https://www.warhammer-community.com/en-gb/downloads/warhammer-the-old-world/" target="_blank" rel="noreferrer">The Old World Downloads</a>.
        </p>
      </div>
    </div>

    <SearchBar v-model="query" placeholder="Search rules, topics, and armies" />

    <div v-if="!q" class="quick-actions rules-quick-actions" aria-label="Frequently searched rules">
      <RouterLink
        v-for="rule in frequentRules"
        :key="rule.to"
        :to="rule.to"
        class="quick-action rules-quick-action"
      >
        <span>{{ rule.name }}</span>
      </RouterLink>
    </div>

    <SectionCard v-if="q" title="Search Results" :open="true">
      <ListRow
        v-for="item in searchResults"
        :key="`${item.name}-${item.to}`"
        :title="item.name"
        :to="item.to"
        @click="rememberSearchResult(item.name, item.to)"
      />
      <div v-if="!searchResults.length" class="empty-inline">No matching rules, topics, or armies.</div>
    </SectionCard>

    <div v-else class="section-stack rules-accordion-stack">
      <SectionCard title="Reference Updates" :open="openGroup === 'updates'" @toggle="toggleGroup('updates')">
        <ListRow
          v-for="item in referenceUpdates"
          :key="item.to"
          :title="item.name"
          :to="item.to"
        />
      </SectionCard>

      <SectionCard title="Core Rules" :open="openGroup === 'core'" @toggle="toggleGroup('core')">
        <ListRow
          v-for="rule in coreRules"
          :key="rule.slug"
          :title="rule.name"
          :to="rule.to"
        />
      </SectionCard>

      <SectionCard title="Army Rules" :open="openGroup === 'armies'" @toggle="toggleGroup('armies')">
        <div class="nested-army-groups">
          <section
            v-for="group in armyFamilies"
            :key="group.family"
            class="nested-army-group"
            :class="{ open: openArmyFamily === group.family }"
          >
            <button class="nested-army-heading" type="button" :aria-expanded="openArmyFamily === group.family" @click="toggleArmyFamily(group.family)">
              <span>{{ group.family }}</span>
              <span class="nested-army-meta">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </span>
            </button>
            <div v-if="openArmyFamily === group.family" class="nested-army-content">
              <ListRow
                v-for="army in group.armies"
                :key="army.slug"
                :title="army.name"
                :to="ruleReaderPath(armySourcePath(army.slug))"
              />
            </div>
          </section>
        </div>
      </SectionCard>

      <SectionCard title="Battle Scenarios" :open="openGroup === 'scenarios'" @toggle="toggleGroup('scenarios')">
        <ListRow
          v-for="group in battleScenarioGroups"
          :key="group.sourcePath"
          :title="group.name"
          :to="ruleIndexGroupPath('scenarios', group.sourcePath)"
        />
      </SectionCard>

      <SectionCard title="Advanced Rules" :open="openGroup === 'advanced'" @toggle="toggleGroup('advanced')">
        <div v-if="ruleIndexLoading && !advancedRuleGroups.length" class="empty-inline">Loading rule index…</div>
        <template v-else>
          <ListRow
            v-for="group in advancedRuleGroups"
            :key="group.sourcePath"
            :title="group.name"
            :to="ruleIndexGroupPath('advanced', group.sourcePath)"
          />
        </template>
      </SectionCard>
    </div>
  </main>
</template>
