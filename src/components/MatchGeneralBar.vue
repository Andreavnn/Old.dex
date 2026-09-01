<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SavedGame } from '../services/games'
import { createMatchShareCode, exportSavedMatch } from '../services/matchTransfer'

const props = withDefaults(defineProps<{
  game: SavedGame
  active?: 'roster' | 'charts' | 'reference' | ''
}>(), { active: '' })

const exportOpen = ref(false)
const shareBusy = ref(false)
const shareCode = ref('')
const exportMessage = ref('')
const shareCodePreview = computed(() => shareCode.value.length <= 54 ? shareCode.value : `${shareCode.value.slice(0, 30)}…${shareCode.value.slice(-14)}`)

function openExport() { exportOpen.value = true; shareCode.value = ''; exportMessage.value = '' }
function closeExport() { if (!shareBusy.value) exportOpen.value = false }
function downloadJson() { exportSavedMatch(props.game); exportMessage.value = 'Match JSON exported.' }
async function prepareShareCode() {
  if (shareBusy.value) return
  shareBusy.value = true; exportMessage.value = ''
  try { shareCode.value = await createMatchShareCode(props.game) }
  catch (error) { exportMessage.value = error instanceof Error ? error.message : 'The Match Share Code could not be created.' }
  finally { shareBusy.value = false }
}
async function copyShareCode() {
  if (!shareCode.value) return
  try { await navigator.clipboard.writeText(shareCode.value); exportMessage.value = 'Match Share Code copied.' }
  catch { exportMessage.value = 'Copy failed. Open the full code and copy it manually.' }
}
</script>

<template>
  <nav class="match-general-bar card-surface" aria-label="General's Bar">
    <RouterLink class="match-general-tool" :class="{ active: props.active === 'reference' }" :to="`/games/${props.game.id}/reference-sheet`">Reference Sheet</RouterLink>
    <RouterLink class="match-general-tool" :class="{ active: props.active === 'charts' }" :to="`/games/${props.game.id}/battle-charts`">Battle Charts</RouterLink>
    <RouterLink class="match-general-tool" :class="{ active: props.active === 'roster' }" :to="`/games/${props.game.id}/roster`">Roster</RouterLink>
    <button type="button" class="match-general-tool" @click="openExport">Export</button>
    <span class="match-round-tracker" aria-label="Round tracker"><small>Round</small><strong>{{ props.game.round }} / {{ props.game.roundLimit }}</strong></span>
  </nav>

  <div v-if="exportOpen" class="roster-share-backdrop" role="presentation" @click.self="closeExport">
    <section class="roster-share-modal match-export-modal card-surface" role="dialog" aria-modal="true" aria-labelledby="match-export-title">
      <header><div><p class="eyebrow">EXPORT MATCH</p><h2 id="match-export-title">{{ props.game.name }}</h2></div><button type="button" class="icon-button" aria-label="Close match export" :disabled="shareBusy" @click="closeExport">×</button></header>
      <p>Export the complete match snapshot and tracking state as a JSON file, or create a compact Match Share Code.</p>
      <div class="roster-transfer-options match-export-options"><button type="button" class="secondary-button" @click="downloadJson">Download .json</button><button type="button" class="primary-button" :disabled="shareBusy" @click="prepareShareCode">{{ shareBusy ? 'Preparing…' : 'Share Code' }}</button></div>
      <div v-if="shareCode" class="share-code-preview"><span>Match Share Code</span><code>{{ shareCodePreview }}</code><small>The full match state is contained in the code.</small></div>
      <details v-if="shareCode" class="share-code-full"><summary>Show full Match Share Code</summary><textarea class="roster-share-link" readonly :value="shareCode" rows="6"></textarea></details>
      <div v-if="shareCode" class="roster-share-actions"><button type="button" class="primary-button" @click="copyShareCode">Copy Share Code</button></div>
      <p v-if="exportMessage" class="list-import-message" role="status">{{ exportMessage }}</p>
    </section>
  </div>
</template>
