<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import { getSavedGames, type SavedGame } from '../services/games'

const games = ref<SavedGame[]>([])
const openFilter = ref('all')
const historyFilter = ref('all')
const openSearch = ref('')
const historySearch = ref('')
const openSearchVisible = ref(false)
const historySearchVisible = ref(false)

function refreshGames() { games.value = getSavedGames() }
onMounted(refreshGames)

const openGames = computed(() => games.value.filter((game) => game.status === 'open'))
const history = computed(() => games.value.filter((game) => game.status === 'complete'))

function filterOptions(rows: SavedGame[]) {
  const options = [{ value: 'all', label: 'All' }]
  const armies = [...new Set(rows.flatMap((game) => [game.playerArmyName, game.opponentArmyName || '']).filter(Boolean))].sort()
  const points = [...new Set(rows.map((game) => Number(game.points)).filter((value) => Number.isFinite(value) && value > 0))].sort((a, b) => a - b)
  const scenarios = [...new Set(rows.map((game) => game.scenario).filter(Boolean))].sort()
  armies.forEach((army) => options.push({ value: `army:${army}`, label: army }))
  points.forEach((value) => options.push({ value: `points:${value}`, label: `${value} pts` }))
  scenarios.forEach((scenario) => options.push({ value: `scenario:${scenario}`, label: scenario }))
  return options
}

function matchesFilter(game: SavedGame, filter: string) {
  if (!filter || filter === 'all') return true
  const [type, ...rest] = filter.split(':')
  const value = rest.join(':')
  if (type === 'army') return [game.playerArmyName, game.opponentArmyName].some((army) => String(army || '').toLowerCase() === value.toLowerCase())
  if (type === 'points') return Number(game.points) === Number(value)
  if (type === 'scenario') return game.scenario.toLowerCase() === value.toLowerCase()
  return true
}
function matchesSearch(game: SavedGame, query: string) {
  const wanted = query.trim().toLowerCase()
  if (!wanted) return true
  return [
    game.name,
    game.playerName,
    game.playerListName,
    game.opponentListName,
    game.opponentName,
    game.playerArmyName,
    game.opponentArmyName,
    game.scenario,
    String(game.points),
  ].some((value) => String(value || '').toLowerCase().includes(wanted))
}
function visibleRows(rows: SavedGame[], filter: string, query: string) {
  const filtered = rows.filter((game) => matchesFilter(game, filter) && matchesSearch(game, query))
  return filter !== 'all' || query.trim() ? filtered : filtered.slice(0, 3)
}
const openVisible = computed(() => visibleRows(openGames.value, openFilter.value, openSearch.value))
const historyVisible = computed(() => visibleRows(history.value, historyFilter.value, historySearch.value))
const openOptions = computed(() => filterOptions(openGames.value))
const historyOptions = computed(() => filterOptions(history.value))

function toggleSearch(kind: 'open' | 'history') {
  if (kind === 'open') {
    openSearchVisible.value = !openSearchVisible.value
    if (!openSearchVisible.value) openSearch.value = ''
  } else {
    historySearchVisible.value = !historySearchVisible.value
    if (!historySearchVisible.value) historySearch.value = ''
  }
}
function resultLabel(game: SavedGame) {
  if (game.playerScore === game.opponentScore) return `Draw · ${game.playerScore}-${game.opponentScore}`
  return `${game.playerScore > game.opponentScore ? 'Win' : 'Loss'} · ${game.playerScore}-${game.opponentScore}`
}
</script>

<template>
  <main class="page games-page">
    <AppHeader />
    <div class="page-title-block games-title-block">
      <p class="eyebrow">GAMES</p>
      <h1>Games</h1>
      <p>Create a match from a saved army roster, continue an open battle, or review completed match history.</p>
    </div>

    <RouterLink to="/games/new" class="game-start-card card-surface">
      <span class="game-start-icon">⚔</span>
      <span><strong>Start New Match</strong><small>Choose your army roster and prepare a new Old World battle.</small></span>
      <span class="game-start-arrow">›</span>
    </RouterLink>

    <section class="games-section card-surface">
      <div class="games-section-heading">
        <h2>Open Matches</h2>
        <div class="games-section-tools">
          <span class="section-count">{{ openGames.length }}</span>
          <details class="games-filter-menu"><summary aria-label="Filter matches" title="Filter"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg></summary><label class="games-filter-control"><span class="sr-only">Filter</span><select v-model="openFilter" @click.stop><option v-for="option in openOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label></details>
          <button type="button" class="games-search-toggle" :class="{ active: openSearchVisible }" aria-label="Search open matches" @click="toggleSearch('open')"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg></button>
        </div>
      </div>
      <label v-if="openSearchVisible" class="games-inline-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg><input v-model="openSearch" type="search" placeholder="Search name, roster, faction or points" /></label>
      <div v-if="openVisible.length" class="game-list">
        <RouterLink v-for="game in openVisible" :key="game.id" :to="`/games/${game.id}`" class="game-list-row">
          <span><strong>{{ game.name }}</strong><small>{{ game.playerArmyName }} vs {{ game.opponentArmyName || game.opponentName }} · {{ game.scenario }} · Round {{ game.round }}</small></span>
          <span class="game-list-meta"><strong>{{ game.points }} pts</strong><small>Continue</small></span>
        </RouterLink>
      </div>
      <div v-else class="games-empty-inline">No matching open matches.</div>
      <div v-if="openGames.length > 3 && openFilter === 'all' && !openSearch.trim()" class="games-truncated-note">Showing the 3 most recent. Use Filter or Search to see more.</div>
    </section>

    <section class="games-section card-surface">
      <div class="games-section-heading">
        <h2>Match History</h2>
        <div class="games-section-tools">
          <span class="section-count">{{ history.length }}</span>
          <details class="games-filter-menu"><summary aria-label="Filter matches" title="Filter"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg></summary><label class="games-filter-control"><span class="sr-only">Filter</span><select v-model="historyFilter" @click.stop><option v-for="option in historyOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label></details>
          <button type="button" class="games-search-toggle" :class="{ active: historySearchVisible }" aria-label="Search match history" @click="toggleSearch('history')"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg></button>
        </div>
      </div>
      <label v-if="historySearchVisible" class="games-inline-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg><input v-model="historySearch" type="search" placeholder="Search name, roster, faction or points" /></label>
      <div v-if="historyVisible.length" class="game-list history-list">
        <RouterLink v-for="game in historyVisible" :key="game.id" :to="`/games/${game.id}`" class="game-list-row">
          <span><strong>{{ game.name }}</strong><small>{{ game.playerArmyName }} vs {{ game.opponentArmyName || game.opponentName }} · {{ game.scenario }} · {{ new Date(game.completedAt || game.updatedAt).toLocaleDateString() }}</small></span>
          <span class="game-list-meta"><strong>{{ resultLabel(game) }}</strong><small>Review</small></span>
        </RouterLink>
      </div>
      <div v-else class="games-empty-inline">No matching completed matches.</div>
      <div v-if="history.length > 3 && historyFilter === 'all' && !historySearch.trim()" class="games-truncated-note">Showing the 3 most recent. Use Filter or Search to see more.</div>
    </section>
  </main>
</template>
