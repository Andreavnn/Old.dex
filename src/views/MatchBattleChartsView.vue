<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import MatchGeneralBar from '../components/MatchGeneralBar.vue'
import { shootingToHit } from '../core/shootingToHit'
import { getSavedGame } from '../services/games'

const route = useRoute()
const game = ref(getSavedGame(String(route.params.gameId || '')))
const ballisticChartRef = ref<HTMLElement | null>(null)
const values = Array.from({ length: 10 }, (_, index) => index + 1)
const meleeToHit = (attacker: number, defender: number) => attacker > defender * 2 ? '2+' : attacker > defender ? '3+' : defender > attacker * 2 ? '5+' : '4+'
const toWound = (strength: number, toughness: number) => strength >= toughness * 2 ? '2+' : strength > toughness ? '3+' : strength === toughness ? '4+' : strength * 2 <= toughness ? '6+' : '5+'
const ballisticRows = computed(() => values.map((bs) => ({ bs, result: shootingToHit(bs).label })))
function scrollBallistic(direction: -1 | 1) {
  const element = ballisticChartRef.value
  if (!element) return
  element.scrollBy({ left: direction * Math.max(220, Math.round(element.clientWidth * .72)), behavior: 'smooth' })
}
</script>

<template>
  <main class="page match-reference-page">
    <AppHeader compact :back-to="game ? `/games/${game.id}` : '/games'" prefer-back-to />
    <template v-if="game">
      <MatchGeneralBar :game="game" active="charts" />
      <header class="match-tool-page-heading card-surface"><div><p class="eyebrow">MATCH REFERENCE</p><h1>Battle Charts</h1><p>Quick-reference Weapon Skill, Ballistic Skill, and To Wound tables.</p></div><RouterLink class="secondary-button" :to="`/games/${game.id}`">Back to Match</RouterLink></header>
      <section class="battle-chart-card card-surface"><header><h2>Weapon Skill - To Hit</h2><p>Cross-reference the attacker's WS on the left with the defender's WS across the top.</p></header><div class="battle-chart-scroll"><table><thead><tr><th>Attacker WS</th><th v-for="defender in values" :key="`ws-head-${defender}`">{{ defender }}</th></tr></thead><tbody><tr v-for="attacker in values" :key="`ws-${attacker}`"><th>{{ attacker }}</th><td v-for="defender in values" :key="`ws-${attacker}-${defender}`">{{ meleeToHit(attacker, defender) }}</td></tr></tbody></table></div></section>
      <section class="battle-chart-card card-surface"><header><h2>Ballistic Skill - To Hit</h2><p>The unmodified shooting roll. Natural rolls and modifiers still follow the normal shooting rules.</p></header><div class="battle-chart-arrow-shell"><button type="button" class="battle-chart-arrow left" aria-label="Scroll Ballistic Skill chart left" @click="scrollBallistic(-1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5 8.5 12l7 7" /></svg></button><div ref="ballisticChartRef" class="battle-chart-scroll compact-chart ballistic-chart-scroll"><table><thead><tr><th>BS</th><th v-for="row in ballisticRows" :key="`bs-head-${row.bs}`">{{ row.bs }}</th></tr></thead><tbody><tr><th>To Hit</th><td v-for="row in ballisticRows" :key="`bs-${row.bs}`">{{ row.result }}</td></tr></tbody></table></div><button type="button" class="battle-chart-arrow right" aria-label="Scroll Ballistic Skill chart right" @click="scrollBallistic(1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8.5 5 7 7-7 7" /></svg></button></div></section>
      <section class="battle-chart-card card-surface"><header><h2>Strength vs Toughness - To Wound</h2><p>Cross-reference the attack's Strength on the left with the target's Toughness across the top.</p></header><div class="battle-chart-scroll"><table><thead><tr><th>Strength</th><th v-for="toughness in values" :key="`t-head-${toughness}`">T{{ toughness }}</th></tr></thead><tbody><tr v-for="strength in values" :key="`s-${strength}`"><th>S{{ strength }}</th><td v-for="toughness in values" :key="`wound-${strength}-${toughness}`">{{ toWound(strength, toughness) }}</td></tr></tbody></table></div></section>
    </template>
    <section v-else class="empty-state card-surface"><h1>Match not found</h1><RouterLink to="/games" class="primary-button">Back to Games</RouterLink></section>
  </main>
</template>
