<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import MatchGeneralBar from '../components/MatchGeneralBar.vue'
import { getSavedGame } from '../services/games'

const route = useRoute()
const game = ref(getSavedGame(String(route.params.gameId || '')))
const referenceSheetUrl = '/reference/old-world-reference-sheet.pdf#page=1&view=FitH'
</script>

<template>
  <main class="page match-reference-page">
    <AppHeader compact :back-to="game ? `/games/${game.id}` : '/games'" prefer-back-to />
    <template v-if="game">
      <MatchGeneralBar :game="game" active="reference" />
      <header class="match-tool-page-heading card-surface"><div><p class="eyebrow">MATCH REFERENCE</p><h1>Reference Sheet</h1><p>Jay's Wargaming Madness Old World reference sheet. Spell pages 21-24 are intentionally excluded.</p></div><div class="match-tool-heading-actions"><RouterLink class="secondary-button" :to="`/games/${game.id}`">Back to Match</RouterLink><a class="primary-button" href="/reference/old-world-reference-sheet.pdf" target="_blank" rel="noopener noreferrer">Open PDF</a></div></header>
      <section class="match-pdf-panel card-surface"><iframe :src="referenceSheetUrl" title="Warhammer: The Old World reference sheet, pages 1 through 20"></iframe><p>PDF preview unavailable. <a href="/reference/old-world-reference-sheet.pdf" target="_blank" rel="noopener noreferrer">Open the reference sheet</a>.</p></section>
    </template>
    <section v-else class="empty-state card-surface"><h1>Match not found</h1><RouterLink to="/games" class="primary-button">Back to Games</RouterLink></section>
  </main>
</template>
