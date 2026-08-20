<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import SegmentTabs from '../components/SegmentTabs.vue'
import SearchBar from '../components/SearchBar.vue'
import SectionCard from '../components/SectionCard.vue'
import ListRow from '../components/ListRow.vue'
import { getArmy } from '../data/armies'
import { armySourcePath, ruleReaderPath } from '../data/ruleRepository'

const route = useRoute()
const army = computed(() => getArmy(String(route.params.armySlug)))
const tab = ref('Units')
const query = ref('')
const categories = ['Characters', 'Core', 'Special', 'Rare', 'Mercenaries', 'Allies']

const sampleRows = computed(() => {
  if (!army.value) return []
  const rows = army.value.sampleUnits || categories.slice(0, 4).map((category) => ({
    name: `${army.value!.name} ${category} entry`,
    category,
  }))
  const term = query.value.trim().toLowerCase()
  return rows.filter((row) => !term || row.name.toLowerCase().includes(term))
})
</script>

<template>
  <main v-if="army" class="page">
    <AppHeader compact back-to="/lists" back-label="Back to Army Lists" />

    <div class="page-title-block centered-title">
      <p class="eyebrow">ARMY</p>
      <h1>{{ army.name }}</h1>
      <p>Choose Units or Rules. Technical data-source details remain behind the interface.</p>
    </div>

    <SegmentTabs v-model="tab" :tabs="['Units', 'Rules']" />

    <template v-if="tab === 'Units'">
      <SearchBar v-model="query" placeholder="Filter units" />
      <div class="section-stack">
        <SectionCard
          v-for="category in categories"
          :key="category"
          :title="category"
          :count="sampleRows.filter((row) => row.category === category).length"
          :start-open="['Characters', 'Core', 'Special'].includes(category)"
        >
          <ListRow
            v-for="unit in sampleRows.filter((row) => row.category === category)"
            :key="unit.name"
            :title="unit.name"
            subtitle="GUI placeholder — live army data wiring comes next"
            :to="`/army/${army.slug}/unit/${encodeURIComponent(unit.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}`"
          />
          <div v-if="!sampleRows.some((row) => row.category === category)" class="empty-inline">No GUI sample rows in this category.</div>
        </SectionCard>
      </div>
    </template>

    <template v-else>
      <div class="section-stack army-rules-stack">
        <SectionCard title="Army Rules" :start-open="true">
          <ListRow title="Complete Army Reference" subtitle="Open this army inside the Old.dex repository reader." :to="ruleReaderPath(armySourcePath(army.slug))" badge="LIVE" />
          <ListRow title="Special Rules" subtitle="Open the detailed special-rules reference inside Old.dex." :to="ruleReaderPath('/special-rules/what-are-special-rules')" badge="LIVE" />
          <ListRow title="Magic Items" subtitle="Open the live magic-item index inside Old.dex." :to="ruleReaderPath('/magic-items')" badge="LIVE" />
          <ListRow title="The Lores of Magic" subtitle="Open the live spell-lore index inside Old.dex." :to="ruleReaderPath('/the-lores-of-magic')" badge="LIVE" />
        </SectionCard>
        <div class="info-card">
          <strong>GUI boundary</strong>
          <p>Unit-list data remains a placeholder in this build. Rules are now pulled into the Old.dex reader so the final text presentation and cross-reference behavior can be evaluated before deeper rules tooling is added.</p>
        </div>
      </div>
    </template>
  </main>

  <main v-else class="page">
    <AppHeader compact back-to="/lists" />
    <section class="empty-state card-surface">
      <h1>Army not found</h1>
      <RouterLink to="/lists" class="primary-button">Back to Army Lists</RouterLink>
    </section>
  </main>
</template>
