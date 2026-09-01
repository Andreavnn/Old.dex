<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import MatchGeneralBar from '../components/MatchGeneralBar.vue'
import CharacteristicIcon from '../components/CharacteristicIcon.vue'
import type { ProfileKey } from '../data/builderPrototype'
import type { BuilderRosterSelection } from '../domain/rosterTypes'
import { getSavedGame, type SavedGame } from '../services/games'
import { isGameLocked } from '../services/gameLocks'
import { loadMatchTracking, saveMatchTracking, type MatchTrackingState } from '../services/matchTracking'
import { loadMatchRosterProfile, type MatchUnitProfileSnapshot } from '../services/matchRosterProfiles'

const route = useRoute()
const game = ref<SavedGame | null>(getSavedGame(String(route.params.gameId || '')))
const tracking = ref<MatchTrackingState>(loadMatchTracking(game.value?.id || ''))
const profiles = ref<Record<string, MatchUnitProfileSnapshot | null>>({})
const loading = ref(true)
const readOnly = computed(() => !game.value || game.value.status === 'complete' || isGameLocked(game.value.id))
const roster = computed(() => game.value?.playerRoster?.length ? game.value.playerRoster : [])
const points = computed(() => roster.value.reduce((sum, row) => sum + Number(row.totalPoints || 0), 0))
const categories = computed(() => {
  const order = ['General', 'Characters', 'Core', 'Special', 'Rare', 'Mercenaries', 'Allies']
  const grouped = new Map<string, BuilderRosterSelection[]>()
  for (const row of roster.value) {
    const key = String(row.category || 'Other')
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(row)
  }
  return [...grouped.entries()].map(([category, rows]) => ({ category, rows })).sort((a, b) => {
    const ai = order.findIndex((value) => a.category.toLowerCase().includes(value.toLowerCase()))
    const bi = order.findIndex((value) => b.category.toLowerCase().includes(value.toLowerCase()))
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.category.localeCompare(b.category)
  })
})
const statOrder: ProfileKey[] = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld', 'Sv', 'Ward', 'Rn']
function visibleStats(row: Record<string, string>) { return statOrder.filter((stat) => stat !== 'Ward' && stat !== 'Rn' ? true : Boolean(row[stat] && row[stat] !== '—')) }
function statLabel(stat: ProfileKey) { return stat === 'Ward' ? 'Wd' : stat }
function profileFor(id: string) { return profiles.value[id] }
function lost(row: BuilderRosterSelection) { return Math.max(0, Number(tracking.value.units?.[row.instanceId]?.casualties || 0)) }
function woundLimit(row: BuilderRosterSelection) {
  if (Number(row.modelCount || 1) > 1) return Math.max(1, Number(row.modelCount || 1))
  const profile = profileFor(row.instanceId)
  const values = (profile?.rows || []).map((entry) => Number.parseInt(String(entry.profile.W || ''), 10)).filter((value) => Number.isFinite(value) && value > 0)
  return values.length ? Math.max(...values) : 1
}
function remaining(row: BuilderRosterSelection) { return Math.max(0, woundLimit(row) - lost(row)) }
function lossLabel(row: BuilderRosterSelection) { return Number(row.modelCount || 1) > 1 ? 'Models destroyed' : 'Wounds lost' }
function adjustLoss(row: BuilderRosterSelection, delta: number) {
  if (!game.value || readOnly.value) return
  const value = Math.max(0, Math.min(woundLimit(row), lost(row) + delta))
  tracking.value.units[row.instanceId] = { ...(tracking.value.units[row.instanceId] || {}), casualties: value }
  tracking.value = { ...tracking.value, units: { ...tracking.value.units } }
  saveMatchTracking(game.value.id, tracking.value)
}
function profileRoute(row: BuilderRosterSelection) { return game.value ? { path: `/games/${game.value.id}/unit/${row.instanceId}`, query: { return: `/games/${game.value.id}/roster` } } : '/games' }

onMounted(async () => {
  try {
    if (!game.value) return
    const rows = await Promise.all(roster.value.map(async (row) => [row.instanceId, await loadMatchRosterProfile(game.value!, row)] as const))
    profiles.value = Object.fromEntries(rows)
  } finally { loading.value = false }
})
</script>

<template>
  <main class="page match-roster-page">
    <AppHeader compact :back-to="game ? `/games/${game.id}` : '/games'" prefer-back-to />
    <template v-if="game">
      <MatchGeneralBar :game="game" active="roster" />
      <header class="match-roster-heading card-surface">
        <div><p class="eyebrow">MATCH ROSTER</p><h1>{{ game.playerListName }}</h1><p>{{ game.playerArmyName }} · {{ game.playerCompositionName || 'Army Roster' }}</p></div>
        <div class="match-roster-heading-actions"><strong>{{ points }} pts</strong><RouterLink class="secondary-button" :to="`/games/${game.id}`">Back to Match</RouterLink></div>
      </header>
      <p v-if="loading" class="setup-inline-status card-surface">Building the match roster from the saved battle snapshot…</p>
      <section v-for="group in categories" :key="group.category" class="match-roster-category card-surface">
        <header><h2>{{ group.category }}</h2><strong>{{ group.rows.reduce((sum, row) => sum + Number(row.totalPoints || 0), 0) }} pts</strong></header>
        <article v-for="row in group.rows" :key="row.instanceId" class="match-roster-unit">
          <div class="match-roster-unit-heading">
            <RouterLink :to="profileRoute(row)"><strong>{{ Number(row.modelCount || 1) > 1 ? `${row.modelCount} ` : '' }}{{ row.name }}</strong></RouterLink>
            <strong>{{ row.totalPoints }} pts</strong>
          </div>
          <p class="match-roster-loadout">{{ [...(row.includedEquipment || []), ...(row.optionalSelections || [])].join(' · ') || 'No additional equipment recorded.' }}</p>
          <p v-if="row.magicItems?.length" class="match-roster-rules"><strong>Magical Items:</strong> {{ row.magicItems.map((item) => item.name).join(' · ') }}</p>
          <p v-if="row.specialRules?.length" class="match-roster-rules"><strong>Special Rules:</strong> <RouterLink v-for="rule in row.specialRules" :key="`${row.instanceId}-${rule.label}`" :to="`/rules/read${rule.path}`">{{ rule.label }}</RouterLink></p>
          <div v-if="profileFor(row.instanceId)?.rows.length" class="match-roster-profile-stack">
            <div v-for="profileRow in profileFor(row.instanceId)?.rows" :key="`${row.instanceId}-${profileRow.name}`" class="match-roster-profile-row">
              <div class="match-roster-model-name"><strong>{{ profileRow.name }}</strong><small>×{{ profileRow.count }}</small></div>
              <div class="match-roster-stat-grid"><span v-for="stat in visibleStats(profileRow.profile)" :key="`${profileRow.name}-${stat}`"><CharacteristicIcon :stat="stat"/><strong>{{ profileRow.profile[stat] || '—' }}</strong><small>{{ statLabel(stat) }}</small></span></div>
            </div>
          </div>
          <div class="match-roster-loss-control" :class="{ depleted: remaining(row) === 0 }">
            <span><strong>{{ lossLabel(row) }}</strong><small v-if="Number(row.modelCount || 1) > 1">{{ remaining(row) }} models remaining</small><small v-else>{{ remaining(row) }} wounds remaining</small></span>
            <button type="button" :disabled="readOnly || lost(row) <= 0" @click="adjustLoss(row, -1)">−</button><strong>{{ lost(row) }}</strong><button type="button" :disabled="readOnly || lost(row) >= woundLimit(row)" @click="adjustLoss(row, 1)">+</button>
          </div>
        </article>
      </section>
    </template>
    <section v-else class="empty-state card-surface"><h1>Match not found</h1></section>
  </main>
</template>
