<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import { getSavedGames, type SavedGame } from '../services/games'

const games = ref<SavedGame[]>([])
function refreshGames() { games.value = getSavedGames() }
onMounted(refreshGames)

const openGames = computed(() => games.value.filter((game) => game.status === 'open'))
const history = computed(() => games.value.filter((game) => game.status === 'complete'))
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
      <p>Create a match from a saved army list, continue an open battle, or review completed match history.</p>
    </div>

    <RouterLink to="/games/new" class="game-start-card card-surface">
      <span class="game-start-icon">⚔</span>
      <span><strong>Start New Match</strong><small>Choose your army list and prepare a new Old World battle.</small></span>
      <span class="game-start-arrow">›</span>
    </RouterLink>

    <section class="games-section card-surface">
      <div class="games-section-heading"><div><p class="eyebrow">OPEN MATCHES</p><h2>Open Matches</h2></div><span class="section-count">{{ openGames.length }}</span></div>
      <div v-if="openGames.length" class="game-list">
        <RouterLink v-for="game in openGames" :key="game.id" :to="`/games/${game.id}`" class="game-list-row">
          <span><strong>{{ game.name }}</strong><small>{{ game.scenario }} · Round {{ game.round }} · {{ game.activeSide === 'player' ? game.playerListName : game.opponentName }} turn</small></span>
          <span class="game-list-meta"><strong>{{ game.points }} pts</strong><small>Continue</small></span>
        </RouterLink>
      </div>
      <div v-else class="games-empty-inline">No open matches.</div>
    </section>

    <section class="games-section card-surface">
      <div class="games-section-heading"><div><p class="eyebrow">MATCH HISTORY</p><h2>Match History</h2></div><span class="section-count">{{ history.length }}</span></div>
      <div v-if="history.length" class="game-list history-list">
        <RouterLink v-for="game in history" :key="game.id" :to="`/games/${game.id}`" class="game-list-row">
          <span><strong>{{ game.name }}</strong><small>{{ game.scenario }} · {{ new Date(game.completedAt || game.updatedAt).toLocaleDateString() }}</small></span>
          <span class="game-list-meta"><strong>{{ resultLabel(game) }}</strong><small>Review</small></span>
        </RouterLink>
      </div>
      <div v-else class="games-empty-inline">Completed matches will appear here.</div>
    </section>
  </main>
</template>
