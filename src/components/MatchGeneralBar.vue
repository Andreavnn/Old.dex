<script setup lang="ts">
import type { SavedGame } from '../services/games'

const props = withDefaults(defineProps<{
  game: SavedGame
  active?: 'roster' | ''
}>(), { active: '' })
</script>

<template>
  <nav class="match-general-bar card-surface" aria-label="General's Bar">
    <button type="button" class="match-general-tool" disabled title="Reference Sheet is reserved for a later build">Reference Sheet</button>
    <button type="button" class="match-general-tool" disabled title="Battle Charts is reserved for a later build">Battle Charts</button>
    <RouterLink class="match-general-tool" :class="{ active: props.active === 'roster' }" :to="`/games/${props.game.id}/roster`">Roster</RouterLink>
    <button type="button" class="match-general-tool" disabled title="Match sharing is reserved for a later build">Share</button>
    <span class="match-round-tracker" aria-label="Round tracker"><small>Round</small><strong>{{ props.game.round }} / {{ props.game.roundLimit }}</strong></span>
  </nav>
</template>
