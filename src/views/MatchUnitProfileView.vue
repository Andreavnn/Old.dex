<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import CharacteristicIcon from '../components/CharacteristicIcon.vue'
import type { ProfileKey } from '../data/builderPrototype'
import { getSavedGame } from '../services/games'
import { getSavedArmyList } from '../services/savedLists'
import { loadMatchRosterProfile, type MatchUnitProfileSnapshot } from '../services/matchRosterProfiles'

const route = useRoute()
const game = computed(() => getSavedGame(String(route.params.gameId || '')))
const rosterRow = computed(() => {
  const current = game.value
  if (!current) return null
  const id = String(route.params.instanceId || '')
  const snapshot = current.playerRoster?.find((row) => row.instanceId === id)
  if (snapshot) return snapshot
  return getSavedArmyList(current.playerListId)?.roster.find((row) => row.instanceId === id) || null
})
const profile = ref<MatchUnitProfileSnapshot | null>(null)
const loading = ref(true)
const backPath = computed(() => {
  const candidate = String(route.query.return || '')
  return candidate.startsWith('/') && !candidate.startsWith('//') ? candidate : (game.value ? `/games/${game.value.id}` : '/games')
})
const statOrder: ProfileKey[] = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld', 'Sv', 'Ward', 'Rn']
function visibleStats(row: Record<string, string>) {
  return statOrder.filter((stat) => stat !== 'Ward' && stat !== 'Rn' ? true : Boolean(row[stat] && row[stat] !== '—'))
}
function statLabel(stat: ProfileKey) { return stat === 'Ward' ? 'Wd' : stat }

onMounted(async () => {
  try {
    if (game.value && rosterRow.value) profile.value = await loadMatchRosterProfile(game.value, rosterRow.value)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="page match-snapshot-profile-page">
    <AppHeader compact :back-to="backPath" prefer-back-to />
    <section v-if="game && rosterRow" class="match-snapshot-profile-shell">
      <header class="unit-heading">
        <p class="eyebrow">MATCH ROSTER SNAPSHOT</p>
        <h1>{{ rosterRow.name }}</h1>
        <span class="prototype-pill">{{ profile?.troopType || rosterRow.troopType || 'Unit' }}</span>
      </header>

      <p v-if="loading" class="setup-inline-status">Building the profile from the roster snapshot used to start this match...</p>
      <template v-else-if="profile">
        <section v-for="row in profile.rows" :key="row.name" class="match-profile-row card-surface">
          <h2>{{ row.name }}</h2>
          <div class="stat-grid match-profile-stat-grid">
            <div v-for="stat in visibleStats(row.profile)" :key="`${row.name}-${stat}`" class="stat-circle">
              <CharacteristicIcon :stat="stat" />
              <span class="stat-value">{{ row.profile[stat] || '—' }}</span>
              <span class="stat-label">{{ statLabel(stat) }}</span>
            </div>
          </div>
        </section>

        <section v-if="profile.weapons.length" class="card-surface match-profile-section">
          <p class="eyebrow">EQUIPPED WEAPONS</p>
          <div class="weapon-table-wrap"><table class="weapon-table"><thead><tr><th>Weapon</th><th>Range</th><th>S</th><th>AP</th><th>Rules</th></tr></thead>
          <tbody><tr v-for="weapon in profile.weapons" :key="weapon.id"><td>{{ weapon.name }}<small v-if="weapon.count > 1"> ×{{ weapon.count }}</small></td><td>{{ weapon.range }}</td><td>{{ weapon.strength }}</td><td>{{ weapon.ap }}</td><td>{{ weapon.rules.join(', ') || '—' }}</td></tr></tbody></table></div>
        </section>

        <section v-if="profile.equipment.length" class="card-surface match-profile-section">
          <p class="eyebrow">EQUIPMENT & UPGRADES</p>
          <div class="profile-loadout-chips"><span v-for="item in profile.equipment" :key="item" class="profile-loadout-chip">{{ item }}</span></div>
        </section>

        <section v-if="rosterRow.magicItems?.length" class="card-surface match-profile-section">
          <p class="eyebrow">MAGICAL ITEMS</p>
          <div class="match-profile-magic-list"><article v-for="item in rosterRow.magicItems" :key="item.id"><strong>{{ item.name }}</strong><span>{{ item.type }}<template v-if="item.count > 1"> · ×{{ item.count }}</template></span></article></div>
        </section>

        <section v-if="profile.rules.length" class="card-surface match-profile-section">
          <p class="eyebrow">SPECIAL RULES</p>
          <div class="old-rule-keywords match-profile-rules"><RouterLink v-for="rule in profile.rules" :key="`${rule.label}-${rule.path}`" :to="`/rules/read${rule.path}`">{{ rule.label }}</RouterLink></div>
        </section>
      </template>
      <section v-else class="empty-state card-surface"><h2>Profile unavailable</h2><p>The match still retains this roster entry, but its canonical profile source could not be loaded.</p></section>
    </section>
    <section v-else class="empty-state card-surface"><h2>Match roster entry not found</h2><p>This profile is only available from the roster snapshot stored with the match.</p></section>
  </main>
</template>
