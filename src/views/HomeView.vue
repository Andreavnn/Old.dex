<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import { deleteSavedArmyLists, duplicateSavedArmyList, exportSavedArmyList, getSavedArmyLists, importSavedArmyListJson, savedArmyListRoute, type SavedArmyList } from '../services/savedLists'
import { compositionOptions } from '../data/listBuilder'

const savedLists = ref<SavedArmyList[]>([])
const deleteMode = ref(false)
const selectedForDelete = ref(new Set<string>())
const importInput = ref<HTMLInputElement | null>(null)
const importMessage = ref('')

function refreshLists() { savedLists.value = getSavedArmyLists() }
onMounted(refreshLists)

const deleteCount = computed(() => selectedForDelete.value.size)

function toggleDeleteMode() {
  deleteMode.value = !deleteMode.value
  selectedForDelete.value = new Set()
}
function toggleDeleteSelection(id: string) {
  const next = new Set(selectedForDelete.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selectedForDelete.value = next
}
function deleteSelected() {
  if (!deleteCount.value) return
  deleteSavedArmyLists([...selectedForDelete.value])
  selectedForDelete.value = new Set()
  deleteMode.value = false
  refreshLists()
}
function copyList(id: string) {
  duplicateSavedArmyList(id)
  refreshLists()
}
async function importListFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  importMessage.value = ''
  try {
    const rows = importSavedArmyListJson(await file.text())
    refreshLists()
    importMessage.value = `${rows.length} list${rows.length === 1 ? '' : 's'} imported.`
  } catch (error) {
    importMessage.value = error instanceof Error ? error.message : 'This army-list JSON could not be imported.'
  } finally {
    input.value = ''
  }
}
function optionLabel(id: string) { return compositionOptions.find((option) => option.value === id)?.label || id }
function actualPoints(list: SavedArmyList) { return list.actualPoints ?? (list.roster || []).reduce((sum, row) => sum + row.totalPoints, 0) }
function rosterState(list: SavedArmyList) { return list.validationStatus || 'warning' }
function exportList(list: SavedArmyList) { exportSavedArmyList(list) }
</script>

<template>
  <main class="page home-page">
    <AppHeader />

    <div class="page-title-block">
      <p class="eyebrow">ARMY ROSTERS</p>
      <h1>Army Rosters</h1>
      <p>Create, import and manage Old World army rosters here. Army reference browsing remains under Rules → Army Rules.</p>
    </div>

    <section class="list-launch card-surface">
      <div>
        <strong>My Rosters</strong>
        <p>{{ savedLists.length ? `${savedLists.length} saved roster${savedLists.length === 1 ? '' : 's'}.` : 'No saved rosters yet.' }}</p>
      </div>
      <div v-if="!deleteMode" class="list-launch-actions">
        <RouterLink to="/lists/create" class="primary-button">Create a roster</RouterLink>
        <button class="secondary-button" type="button" @click="importInput?.click()">Import roster</button><input ref="importInput" class="file-import-input" type="file" accept=".json,.owb.json,.owb.lists.json,application/json" @change="importListFile" />
        <button class="list-delete-mode-button" type="button" aria-label="Select lists to delete" title="Delete lists" @click="toggleDeleteMode">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h17"/><path d="M9 6.5V4h6v2.5"/><path d="m6.5 6.5.9 13h9.2l.9-13"/><path d="M10 10.5v5.5M14 10.5v5.5"/></svg>
        </button>
      </div>
      <div v-else class="list-delete-actions">
        <button class="secondary-button" type="button" @click="toggleDeleteMode">Exit</button>
        <button class="danger-button" type="button" :disabled="!deleteCount" @click="deleteSelected">Delete {{ deleteCount || '' }} selected</button>
      </div>
    <p v-if="importMessage" class="list-import-message" role="status">{{ importMessage }}</p>
    </section>

    <section v-if="savedLists.length" class="saved-list-stack" aria-label="Saved army lists">
      <article v-for="list in savedLists" :key="list.id" class="saved-list-card card-surface" :class="[{ 'delete-select-mode': deleteMode, selected: selectedForDelete.has(list.id) }, `roster-status-${rosterState(list)}`]">
        <button v-if="deleteMode" type="button" class="saved-list-select" :aria-pressed="selectedForDelete.has(list.id)" @click="toggleDeleteSelection(list.id)">
          <span aria-hidden="true">{{ selectedForDelete.has(list.id) ? '✓' : '' }}</span>
        </button>
        <RouterLink v-if="!deleteMode" :to="savedArmyListRoute(list)" class="saved-list-open-area">
          <div><strong>{{ list.name }}</strong><div class="saved-list-labels"><span class="app-option-label">{{ list.armyName }}</span><span class="app-option-label">{{ list.compositionName }}</span><span v-for="option in list.options" :key="`${list.id}-${option}`" class="app-option-label composition-selected-label">{{ optionLabel(option) }}</span></div></div>
          <div class="saved-list-card-meta"><strong>{{ actualPoints(list) }} / {{ list.points }} pts</strong><small>{{ rosterState(list).toUpperCase() }} · {{ list.locked ? 'Locked' : 'Open' }}</small></div>
        </RouterLink>
        <div v-if="!deleteMode" class="saved-list-row-actions">
          <RouterLink class="saved-list-action-button" :to="{ name: 'list-view', params: { listId: list.id } }" aria-label="View roster" title="View">View</RouterLink>
          <button type="button" class="saved-list-action-button" aria-label="Export roster" title="Export JSON" @click="exportList(list)">Export</button>
          <button type="button" class="saved-list-copy-button" aria-label="Copy roster" title="Copy roster" @click="copyList(list.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M16 8V5H5v11h3"/></svg></button>
        </div>
        <button v-else type="button" class="saved-list-delete-row" @click="toggleDeleteSelection(list.id)">
          <div><strong>{{ list.name }}</strong><div class="saved-list-labels"><span class="app-option-label">{{ list.armyName }}</span><span class="app-option-label">{{ list.compositionName }}</span></div></div>
          <strong>{{ list.points }} pts</strong>
        </button>
      </article>
    </section>

    <section v-else class="empty-state card-surface compact-empty lists-empty-state">
      <div class="empty-icon">≡</div>
      <h2>Your rosters will appear here</h2>
      <p>Rosters are saved automatically on this device while you build them.</p>
    </section>
  </main>
</template>
