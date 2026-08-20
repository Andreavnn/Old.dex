<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import { deleteSavedArmyLists, duplicateSavedArmyList, getSavedArmyLists, savedArmyListRoute, type SavedArmyList } from '../services/savedLists'
import { compositionOptions } from '../data/listBuilder'

const savedLists = ref<SavedArmyList[]>([])
const deleteMode = ref(false)
const selectedForDelete = ref(new Set<string>())

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
function optionLabel(id: string) { return compositionOptions.find((option) => option.value === id)?.label || id }
</script>

<template>
  <main class="page home-page">
    <AppHeader />

    <div class="page-title-block">
      <p class="eyebrow">ARMY LISTS</p>
      <h1>Army Lists</h1>
      <p>Create, import and manage Old World army lists here. Army reference browsing remains under Rules → Army Rules.</p>
    </div>

    <section class="list-launch card-surface">
      <div>
        <strong>My Lists</strong>
        <p>{{ savedLists.length ? `${savedLists.length} saved list${savedLists.length === 1 ? '' : 's'}.` : 'No saved lists yet.' }}</p>
      </div>
      <div v-if="!deleteMode" class="list-launch-actions">
        <RouterLink to="/lists/create" class="primary-button">Create a list</RouterLink>
        <button class="secondary-button" type="button" disabled>Import list</button>
        <button class="list-delete-mode-button" type="button" aria-label="Select lists to delete" title="Delete lists" @click="toggleDeleteMode">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h17"/><path d="M9 6.5V4h6v2.5"/><path d="m6.5 6.5.9 13h9.2l.9-13"/><path d="M10 10.5v5.5M14 10.5v5.5"/></svg>
        </button>
      </div>
      <div v-else class="list-delete-actions">
        <button class="secondary-button" type="button" @click="toggleDeleteMode">Exit</button>
        <button class="danger-button" type="button" :disabled="!deleteCount" @click="deleteSelected">Delete {{ deleteCount || '' }} selected</button>
      </div>
    </section>

    <section v-if="savedLists.length" class="saved-list-stack" aria-label="Saved army lists">
      <article v-for="list in savedLists" :key="list.id" class="saved-list-card card-surface" :class="{ 'delete-select-mode': deleteMode, selected: selectedForDelete.has(list.id) }">
        <RouterLink v-if="!deleteMode" :to="savedArmyListRoute(list)" class="saved-list-open-area">
          <div><strong>{{ list.name }}</strong><div class="saved-list-labels"><span class="app-option-label">{{ list.armyName }}</span><span class="app-option-label">{{ list.compositionName }}</span><span v-for="option in list.options" :key="`${list.id}-${option}`" class="app-option-label composition-selected-label">{{ optionLabel(option) }}</span></div></div>
          <div class="saved-list-card-meta"><strong>{{ list.points }} pts</strong><small>{{ list.locked ? 'Locked' : 'Open' }}</small></div>
        </RouterLink>
        <button v-if="!deleteMode" type="button" class="saved-list-copy-button" aria-label="Copy list" title="Copy list" @click="copyList(list.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M16 8V5H5v11h3"/></svg></button>
        <button v-else type="button" class="saved-list-delete-row" :aria-pressed="selectedForDelete.has(list.id)" @click="toggleDeleteSelection(list.id)">
          <span class="saved-list-delete-check" aria-hidden="true">{{ selectedForDelete.has(list.id) ? '✓' : '' }}</span>
          <div><strong>{{ list.name }}</strong><div class="saved-list-labels"><span class="app-option-label">{{ list.armyName }}</span><span class="app-option-label">{{ list.compositionName }}</span></div></div>
          <strong class="saved-list-delete-points">{{ list.points }} pts</strong>
        </button>
      </article>
    </section>

    <section v-else class="empty-state card-surface compact-empty lists-empty-state">
      <div class="empty-icon">≡</div>
      <h2>Your lists will appear here</h2>
      <p>Lists are saved automatically on this device while you build them.</p>
    </section>
  </main>
</template>
